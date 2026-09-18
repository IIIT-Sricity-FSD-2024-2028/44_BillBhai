import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import usePageSetup from '../hooks/usePageSetup.js';
import { CSS, FONTS } from '../lib/pageAssets.js';
import {
  applyPromo,
  createDataStore,
  getCategories,
  getSessionContext,
  searchCatalog,
} from '../lib/cashier/dataStore.js';
import { validateCustomerStep } from '../lib/cashier/validation.js';
import { runCheckout } from '../lib/cashier/submitOrder.js';
import {
  getCartSubtotal,
  getCartTotals,
  getCheckoutModeConfig,
  getDeliveryChargeAmount,
  getPlanBadge,
  getTerminalCopy,
  recomputeDiscount,
  sanitizePhone,
} from '../lib/cashier/posHelpers.js';
import Header from '../components/cashier/Header.jsx';
import CustomerStep from '../components/cashier/CustomerStep.jsx';
import SearchBar from '../components/cashier/SearchBar.jsx';
import CategoryFilters from '../components/cashier/CategoryFilters.jsx';
import ProductGrid from '../components/cashier/ProductGrid.jsx';
import CartSidebar from '../components/cashier/CartSidebar.jsx';
import FulfillmentStep from '../components/cashier/FulfillmentStep.jsx';
import PaymentStep from '../components/cashier/PaymentStep.jsx';
import ContextMenu from '../components/cashier/ContextMenu.jsx';

// React port of cashier.html + scripts/data.js, validation.js, ui.js, app.js.

const EMPTY_CUSTOMER = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  deliveryPartner: '',
  deliveryPartnerPhone: '',
};
const EMPTY_ERRORS = { name: '', phone: '', email: '', address: '', deliveryPartnerPhone: '' };
const INACTIVE_DISCOUNT = { active: false, discount: 0 };
const INITIAL_CART_STATE = { cart: [], discount: INACTIVE_DISCOUNT };
const HIDDEN_MENU = { open: false, x: null, y: null, product: null, measure: false };

function hintFor(type, text) {
  let className = 'text-sm text-muted';
  if (type === 'existing') className = 'text-sm lookup-existing';
  else if (type === 'new') className = 'text-sm lookup-new';
  return { className, text };
}

// Cart + discount move together: every cart change re-runs ui.js updateCartTotal(),
// which re-derives an active promo discount from the new subtotal.
function cartReducer(state, action) {
  let { cart, discount } = state;
  switch (action.type) {
    case 'add': {
      const { product } = action;
      const opt = action.option || product.options[0];
      const cartId = `${product.id}-${opt.label}`;
      if (cart.some((c) => c.cartId === cartId)) {
        cart = cart.map((c) => (c.cartId === cartId ? { ...c, qty: c.qty + 1 } : c));
      } else {
        cart = [...cart, { cartId, id: product.id, name: `${product.name} (${opt.label})`, price: opt.price, qty: 1 }];
      }
      break;
    }
    case 'qty':
      cart = cart
        .map((c) => (c.cartId === action.cartId ? { ...c, qty: c.qty + action.delta } : c))
        .filter((c) => c.cartId !== action.cartId || c.qty > 0);
      break;
    case 'discount':
      discount = action.discount;
      break;
    case 'reset':
      return INITIAL_CART_STATE;
    default:
      return state;
  }
  return { cart, discount: recomputeDiscount(discount, getCartSubtotal(cart)) };
}

export default function CashierPage() {
  const [store] = useState(() => createDataStore());
  const [session] = useState(() => getSessionContext());
  const [booted, setBooted] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [checkoutSettings, setCheckoutSettings] = useState({ deliveryCharge: 0 });
  const [planBadge, setPlanBadge] = useState(null);

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [lookupHint, setLookupHint] = useState(() => hintFor('info', getTerminalCopy(false).lookupInfo));
  const currentCustomerProfile = useRef(null);
  const customerLookupRequestId = useRef(0);

  const [checkoutMode, setCheckoutModeState] = useState('takeaway_now');
  const [modeError, setModeError] = useState('');
  const [{ cart, discount }, dispatchCart] = useReducer(cartReducer, INITIAL_CART_STATE);

  const [catalogShown, setCatalogShown] = useState(false);
  const [category, setCategory] = useState('All');
  const [catClassesNormalized, setCatClassesNormalized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [promoCode, setPromoCode] = useState('');
  const [promoAppliedCode, setPromoAppliedCode] = useState('');
  const [promoError, setPromoError] = useState('');

  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [menu, setMenu] = useState(HIDDEN_MENU);

  // Terminal-specific copy only applies once app.js has booted (after DataStore.init()).
  const isCustomerTerminal = Boolean(session.isCustomerTerminal);
  const ct = booted && isCustomerTerminal;

  usePageSetup({
    title: ct ? 'BillBhai - Self Checkout' : 'BillBhai - POS Terminal',
    styles: [CSS.dashboard, CSS.cashier],
    fonts: FONTS.app,
    bodyClass: 'no-sidebar',
    bodyAttrs: { 'data-page': 'cashier', 'data-app-ready': 'true' },
  });

  const clearError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));

  function setCheckoutMode(mode) {
    const config = getCheckoutModeConfig(mode, isCustomerTerminal);
    setCheckoutModeState(config.mode);
    setModeError('');
    if (config.deliveryOption !== 'delivery') clearError('address');
  }

  function resetPOS() {
    setCustomer(EMPTY_CUSTOMER);
    setErrors(EMPTY_ERRORS);
    currentCustomerProfile.current = null;
    setCheckoutMode('takeaway_now');
    setLookupHint(hintFor('info', getTerminalCopy(isCustomerTerminal).lookupInfo));
    dispatchCart({ type: 'reset' });
    setCategory('All');
    setSearchQuery('');
    setPromoCode('');
    setPromoError('');
    setPromoAppliedCode('');
    setModeError('');
    setOutcome(null);
    setStep(1);
  }

  // app.js DOMContentLoaded: DataStore.init() -> session copy -> UI.init().
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await store.init();
      } catch (error) {
        console.error('POS bootstrap failed, continuing with fallback UI init:', error);
      }
      if (cancelled) return;
      setCatalog(store.getCatalog());
      setCheckoutSettings(store.getCheckoutSettings());
      setPlanBadge(getPlanBadge());
      resetPOS();
      setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // bindContextMenuGlobal(): any click or scroll hides the size picker.
  useEffect(() => {
    const hide = () => setMenu((m) => (m.open ? { ...m, open: false } : m));
    document.addEventListener('click', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('click', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  const repositionMenu = useCallback((x, y) => {
    setMenu((m) => ({ ...m, x, y, measure: false }));
  }, []);

  // ---- Step 1: customer details --------------------------------------------------
  function buildCustomerPayload() {
    const modeConfig = getCheckoutModeConfig(checkoutMode, isCustomerTerminal);
    return {
      name: String(customer.name || '').trim(),
      phone: sanitizePhone(customer.phone || ''),
      email: String(customer.email || '').trim(),
      address: String(customer.address || '').trim(),
      notes: String(customer.notes || '').trim(),
      deliveryOption: modeConfig.deliveryOption,
      deliveryPartner: String(customer.deliveryPartner || '').trim(),
      deliveryPartnerPhone: sanitizePhone(customer.deliveryPartnerPhone || ''),
      isExistingCustomer: Boolean(currentCustomerProfile.current),
    };
  }

  async function runCustomerLookup(rawPhone) {
    const phone = sanitizePhone(rawPhone);
    setCustomer((c) => (c.phone === phone ? c : { ...c, phone }));
    const requestId = ++customerLookupRequestId.current;
    const copy = getTerminalCopy(isCustomerTerminal);

    if (phone.length < 10) {
      currentCustomerProfile.current = null;
      setLookupHint(hintFor('info', copy.lookupInfo));
      return;
    }

    let profile = null;
    try {
      profile = await store.getCustomerByPhoneAsync(phone);
    } catch {
      profile = store.getCustomerByPhone(phone);
    }

    // Ignore stale async responses from older lookups.
    if (requestId !== customerLookupRequestId.current) return;

    const hadExistingProfile = Boolean(currentCustomerProfile.current);
    currentCustomerProfile.current = profile;

    if (profile) {
      setCustomer((c) => ({
        ...c,
        name: String(profile.name || '').trim(),
        email: String(profile.email || '').trim(),
        address: String(profile.address || '').trim(),
        notes: String(profile.notes || '').trim(),
        deliveryPartner: String(profile.deliveryPartner || '').trim(),
        deliveryPartnerPhone: String(profile.deliveryPartnerPhone || '').trim(),
      }));
      if (getCheckoutModeConfig(checkoutMode).deliveryOption !== 'delivery') clearError('address');
      setLookupHint(hintFor('existing', copy.lookupExisting(profile.name)));
    } else {
      if (hadExistingProfile) {
        setCustomer((c) => ({ ...c, email: '', address: '', notes: '', deliveryPartner: '', deliveryPartnerPhone: '' }));
        setCheckoutMode('takeaway_now');
      }
      setLookupHint(hintFor('new', copy.lookupNew));
    }
  }

  function handleFieldChange(field, value) {
    if (field === 'deliveryPartnerPhone') {
      setCustomer((c) => ({ ...c, deliveryPartnerPhone: sanitizePhone(value) }));
      clearError('deliveryPartnerPhone');
      setModeError('');
      return;
    }
    setCustomer((c) => ({ ...c, [field]: value }));
    if (field === 'name') clearError('name');
    if (field === 'email') clearError('email');
    if (field === 'address') {
      clearError('address');
      setModeError('');
    }
  }

  function handlePhoneChange(value) {
    clearError('phone');
    void runCustomerLookup(value);
  }

  function handleCustomerSubmit(e) {
    e.preventDefault();
    const validation = validateCustomerStep({ ...buildCustomerPayload(), deliveryOption: 'pickup' });
    setErrors({
      name: validation.errors.name || '',
      phone: validation.errors.phone || '',
      email: validation.errors.email || '',
      address: '',
      deliveryPartnerPhone: validation.errors.deliveryPartnerPhone || '',
    });

    if (validation.isValid) {
      setCatalogShown(true);
      setCatClassesNormalized(false);
      setStep(2);
    }
  }

  // ---- Step 2: catalog + cart ----------------------------------------------------
  function handleSelectCategory(c) {
    setCategory(c);
    setCatClassesNormalized(true);
  }

  function showContextMenu(x, y, product) {
    setMenu({ open: true, x, y, product, measure: true });
  }

  function handlePickOption(product, option) {
    dispatchCart({ type: 'add', product, option });
    setMenu((m) => ({ ...m, open: false }));
  }

  async function handleApplyPromo() {
    const code = promoCode.trim();
    if (!code) return;

    setPromoError('');

    if (cart.length === 0) {
      setPromoError('Add items to the cart before applying a promo code.');
      return;
    }

    const res = await applyPromo(code, getCartSubtotal(cart));

    if (res.active) {
      dispatchCart({ type: 'discount', discount: res });
      setPromoAppliedCode(code.toUpperCase());
      return;
    }

    setPromoError(res.error || 'Invalid Code');
    dispatchCart({ type: 'discount', discount: INACTIVE_DISCOUNT });
  }

  function handleRemovePromo() {
    dispatchCart({ type: 'discount', discount: INACTIVE_DISCOUNT });
    setPromoCode('');
    setPromoError('');
    setPromoAppliedCode('');
  }

  function handleGoFulfillment() {
    if (!cart.length) return;
    setModeError('');
    setStep(3);
  }

  // ---- Step 3: fulfillment + checkout --------------------------------------------
  function buildCheckoutCustomerPayload() {
    const config = getCheckoutModeConfig(checkoutMode, isCustomerTerminal);
    const payload = buildCustomerPayload();
    payload.checkoutMode = config.mode;
    payload.deliveryOption = config.deliveryOption;
    payload.paymentMethod = config.paymentMethod;
    payload.orderStatus = config.orderStatus;
    payload.deliveryCharge = getDeliveryChargeAmount(checkoutMode, checkoutSettings);

    if (config.deliveryOption !== 'delivery') {
      payload.address = '';
      payload.deliveryPartner = '';
      payload.deliveryPartnerPhone = '';
    }

    return payload;
  }

  async function handleCheckout() {
    if (cart.length === 0) {
      setStep(2);
      return;
    }

    const customerPayload = buildCheckoutCustomerPayload();
    const validation = validateCustomerStep(customerPayload);
    if (!validation.isValid) {
      const errs = validation.errors;
      setErrors({
        name: errs.name || '',
        phone: errs.phone || '',
        email: errs.email || '',
        address: errs.address || '',
        deliveryPartnerPhone: errs.deliveryPartnerPhone || '',
      });
      const hasCustomerFieldErrors = Boolean(errs.name || errs.phone || errs.email);
      setModeError(errs.address || errs.deliveryPartnerPhone
        ? 'Delivery needs valid details before payment.'
        : 'Please complete customer details before payment.');
      setStep(hasCustomerFieldErrors ? 1 : 3);
      return;
    }

    setModeError('');

    let createdOrder = null;
    setCheckoutBusy(true);
    try {
      createdOrder = (await runCheckout(store, { customer: customerPayload, cart, discount })) || null;
    } catch (error) {
      console.error('Checkout failed:', error);
      setModeError('Could not save this order right now. Please try again.');
      return;
    } finally {
      setCheckoutBusy(false);
    }

    if (createdOrder) {
      const config = getCheckoutModeConfig(customerPayload.checkoutMode, isCustomerTerminal);
      const detailAddress = customerPayload.deliveryOption === 'delivery'
        ? (customerPayload.address || 'Address to be confirmed')
        : 'Counter pickup';
      setOutcome({
        title: config.successTitle,
        subtitle: config.successSubtitle,
        rows: [
          { label: 'Order ID', value: createdOrder.id },
          { label: 'Customer', value: createdOrder.customer || '-' },
          { label: 'Mode', value: config.summaryLabel },
          { label: 'Payment', value: createdOrder.paymentMethod || config.paymentMethod },
          { label: 'Delivery Charges', value: `Rs ${Math.max(0, Number(createdOrder.deliveryCharge || 0)).toFixed(2)}` },
          { label: 'Total', value: `Rs ${Math.max(0, Number(createdOrder.total || 0)).toFixed(2)}` },
          { label: 'Destination', value: detailAddress },
        ],
      });
    }
    setStep(4);
  }

  // ---- Render ----------------------------------------------------------------------
  const modeConfig = getCheckoutModeConfig(checkoutMode, isCustomerTerminal);
  const totals = getCartTotals(cart, discount, getDeliveryChargeAmount(checkoutMode, checkoutSettings));
  const hasItems = cart.length > 0;

  const stepCopy = {
    stepTitle: ct ? 'Start Self Checkout' : 'Start New Order',
    stepSubtitle: ct
      ? 'Add your details once. Saved shoppers auto-fill when you enter your phone number.'
      : 'Capture customer details first. Existing customers auto-fill when you enter their phone number.',
    submitLabel: ct ? 'Begin Shopping' : 'Begin Scanning / Manual Entry',
  };
  const defaultPaymentTitle = ct ? 'Ready for Payment' : 'Routing to Gateway...';
  const defaultPaymentSubtitle = ct
    ? 'Your order is prepared. Complete payment to confirm the self-checkout.'
    : 'The payload has been sent successfully. The user chooses Card, UPI, etc., on their device/interface. Webhook triggers upon completion.';

  return (
    <>
      <main className="main-content" id="mainContent">
        <Header session={booted ? session : null} planBadge={planBadge} />

        <div className="content-area" id="contentArea">
          <CustomerStep
            active={step === 1}
            copy={stepCopy}
            lookupHint={lookupHint}
            customer={customer}
            errors={errors}
            onFieldChange={handleFieldChange}
            onPhoneChange={handlePhoneChange}
            onPhoneBlur={() => void runCustomerLookup(customer.phone)}
            onSubmit={handleCustomerSubmit}
          />

          {/* STEP 2: POS Terminal Grid */}
          <div id="step-2-pos" className={`step-container${step === 2 ? ' active' : ''}`}>
            <div className="pos-layout">
              {/* Products Area */}
              <div className="pos-main">
                <div className="pos-controls">
                  <SearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
                  <CategoryFilters
                    categories={catalogShown ? getCategories(catalog) : []}
                    selectedCategory={category}
                    normalized={catClassesNormalized}
                    onSelectCategory={handleSelectCategory}
                  />
                </div>
                <ProductGrid
                  products={catalogShown ? searchCatalog(catalog, searchQuery, category) : null}
                  onAddToCart={(product) => dispatchCart({ type: 'add', product })}
                  onShowOptions={showContextMenu}
                />
              </div>

              <CartSidebar
                cart={cart}
                totals={totals}
                promo={{
                  promoCode,
                  appliedCode: promoAppliedCode,
                  error: promoError,
                  onPromoCodeChange: (value) => {
                    setPromoCode(value);
                    setPromoError('');
                  },
                  onApply: handleApplyPromo,
                  onRemove: handleRemovePromo,
                }}
                goFulfillmentLabel={ct ? 'Continue to Fulfillment' : 'Continue to Fulfillment & Payment'}
                goFulfillmentDisabled={!hasItems}
                onUpdateQty={(cartId, delta) => dispatchCart({ type: 'qty', cartId, delta })}
                onGoFulfillment={handleGoFulfillment}
              />
            </div>
          </div>

          <FulfillmentStep
            active={step === 3}
            heading={ct ? 'How would you like to receive this order?' : 'How should this order go out?'}
            totals={totals}
            checkoutMode={checkoutMode}
            isDelivery={modeConfig.deliveryOption === 'delivery'}
            customer={customer}
            errors={errors}
            modeError={modeError}
            checkoutLabel={modeConfig.buttonLabel}
            checkoutDisabled={booted && (!hasItems || checkoutBusy)}
            onModeChange={setCheckoutMode}
            onFieldChange={handleFieldChange}
            onBack={() => {
              setModeError('');
              setStep(2);
            }}
            onCheckout={handleCheckout}
          />

          <PaymentStep
            active={step === 4}
            title={outcome ? outcome.title : defaultPaymentTitle}
            subtitle={outcome ? outcome.subtitle : defaultPaymentSubtitle}
            summary={outcome ? outcome.rows : null}
            resetLabel={ct ? 'Start Another Checkout' : 'Next Customer (Reset POS)'}
            onReset={resetPOS}
          />
        </div>
      </main>

      <ContextMenu menu={menu} onPick={handlePickOption} onReposition={repositionMenu} />
    </>
  );
}
