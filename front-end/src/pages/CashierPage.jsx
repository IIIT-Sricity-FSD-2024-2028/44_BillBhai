import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import usePageSetup from '../hooks/usePageSetup.js';
import { ROLE_ALLOWED_PAGES } from '../lib/dashboard/constants.js';
import { CSS, FONTS } from '../lib/pageAssets.js';
import { getAuthToken } from '../lib/http.js';
import {
  announceSale,
  buildOrderPayload,
  findByCode,
  getCategories,
  getSessionContext,
  loadBusinessProfile,
  loadCatalog,
  lookupCustomer,
  placeOrder,
  quoteOrder,
  searchCatalog,
  validateCoupon,
} from '../lib/cashier/dataStore.js';
import { validateCustomerStep } from '../lib/cashier/validation.js';
import {
  formatRupees,
  getCartSubtotal,
  getCartTotals,
  getCheckoutModeConfig,
  getPlanBadge,
  getTerminalCopy,
  recomputeDiscount,
  sanitizePhone,
} from '../lib/cashier/posHelpers.js';
import printReceipt from '../lib/printReceipt.js';
import Header from '../components/cashier/Header.jsx';
import CustomerStep from '../components/cashier/CustomerStep.jsx';
import SearchBar from '../components/cashier/SearchBar.jsx';
import CategoryFilters from '../components/cashier/CategoryFilters.jsx';
import ProductGrid from '../components/cashier/ProductGrid.jsx';
import CartSidebar from '../components/cashier/CartSidebar.jsx';
import FulfillmentStep from '../components/cashier/FulfillmentStep.jsx';
import PaymentStep from '../components/cashier/PaymentStep.jsx';
import ContextMenu from '../components/cashier/ContextMenu.jsx';
import MySalesModal from '../components/cashier/MySalesModal.jsx';
import Receipt, { receiptFromOrder } from '../components/cashier/Receipt.jsx';

const EMPTY_CUSTOMER = { name: '', phone: '', email: '', address: '', notes: '', walkIn: false };
const EMPTY_ERRORS = { name: '', phone: '', email: '', address: '', deliveryPartnerPhone: '' };
const INACTIVE_DISCOUNT = { active: false, discount: 0 };
const INITIAL_CART_STATE = { cart: [], discount: INACTIVE_DISCOUNT };
const HIDDEN_MENU = { open: false, x: null, y: null, product: null, measure: false };
const PHONE_RE = /^[6-9]\d{9}$/;

function hintFor(type, text) {
  let className = 'text-sm text-muted';
  if (type === 'existing') className = 'text-sm lookup-existing';
  else if (type === 'new') className = 'text-sm lookup-new';
  return { className, text };
}

/**
 * Cart lines carry the stock the till last saw. Quantities can never go above
 * it; the server checks again when the bill is quoted and saved.
 */
function cartReducer(state, action) {
  let { cart, discount } = state;
  switch (action.type) {
    case 'add': {
      const { product } = action;
      const existing = cart.find((c) => c.cartId === product.id);
      if (existing) {
        cart = cart.map((c) => (c.cartId === product.id ? { ...c, qty: Math.min(c.stock, c.qty + 1) } : c));
      } else if (product.stock > 0) {
        cart = [
          ...cart,
          {
            cartId: product.id,
            id: product.id,
            name: `${product.name}${product.size ? ` (${product.size})` : ''}`,
            price: product.price,
            qty: 1,
            stock: product.stock,
          },
        ];
      }
      break;
    }
    case 'qty':
      cart = cart
        .map((c) => (c.cartId === action.cartId ? { ...c, qty: Math.min(c.stock, c.qty + action.delta) } : c))
        .filter((c) => c.qty > 0);
      break;
    case 'setQty':
      cart = cart.map((c) => (c.cartId === action.cartId ? { ...c, qty: Math.max(1, Math.min(c.stock, action.qty)) } : c));
      break;
    case 'remove':
      cart = cart.filter((c) => c.cartId !== action.cartId);
      break;
    case 'sync': {
      // Fresh catalogue from the server: update prices and stock, drop what is gone.
      const byId = new Map(action.catalog.map((p) => [p.id, p]));
      cart = cart
        .map((c) => {
          const p = byId.get(c.id);
          if (!p) return null;
          return { ...c, price: p.price, stock: p.stock, qty: Math.min(c.qty, p.stock) };
        })
        .filter((c) => c && c.qty > 0);
      break;
    }
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

// Logged-out visitors go to login; roles without the POS go to their dashboard.
function posRedirect() {
  const role = String(localStorage.getItem('userRole') || '')
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!role || !localStorage.getItem('userName') || !getAuthToken()) return '/login';
  return (ROLE_ALLOWED_PAGES[role] || []).includes('cashier') ? null : '/dashboard';
}

export default function CashierPage() {
  const [redirectTo] = useState(posRedirect);
  const [session] = useState(() => getSessionContext());
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [business, setBusiness] = useState(null);
  const [planBadge, setPlanBadge] = useState(null);

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [lookupHint, setLookupHint] = useState(() => hintFor('info', getTerminalCopy(false).lookupInfo));
  const customerLookupRequestId = useRef(0);
  const autofilledFromLookup = useRef(false);

  const [checkoutMode, setCheckoutModeState] = useState('takeaway_now');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [partner, setPartner] = useState({ name: '', phone: '' });
  const [modeError, setModeError] = useState('');
  const [{ cart, discount }, dispatchCart] = useReducer(cartReducer, INITIAL_CART_STATE);
  const [notice, setNotice] = useState('');

  const [category, setCategory] = useState('All');
  const [catClassesNormalized, setCatClassesNormalized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [promoCode, setPromoCode] = useState('');
  const [promoAppliedCode, setPromoAppliedCode] = useState('');
  const [promoError, setPromoError] = useState('');

  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [menu, setMenu] = useState(HIDDEN_MENU);
  const [salesOpen, setSalesOpen] = useState(false);
  const [reprint, setReprint] = useState(null);

  const isCustomerTerminal = Boolean(session.isCustomerTerminal);
  const ct = booted && isCustomerTerminal;
  const modeConfig = getCheckoutModeConfig(checkoutMode, isCustomerTerminal);
  const isDelivery = modeConfig.deliveryOption === 'delivery';

  usePageSetup({
    title: ct ? 'BillBhai - Self Checkout' : 'BillBhai - POS Terminal',
    styles: [CSS.dashboard, CSS.cashier],
    fonts: FONTS.app,
    bodyClass: 'no-sidebar',
    bodyAttrs: { 'data-page': 'cashier', 'data-app-ready': 'true' },
  });

  const clearError = (key) => setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));

  const reloadCatalog = useCallback(async () => {
    const fresh = await loadCatalog();
    setCatalog(fresh);
    dispatchCart({ type: 'sync', catalog: fresh });
    return fresh;
  }, []);

  function setCheckoutMode(mode) {
    const config = getCheckoutModeConfig(mode, isCustomerTerminal);
    setCheckoutModeState(config.mode);
    setPaymentMethod((current) => (config.paymentMethods.includes(current) ? current : config.paymentMethods[0]));
    setModeError('');
    if (config.deliveryOption !== 'delivery') clearError('address');
  }

  function resetPOS() {
    setCustomer(EMPTY_CUSTOMER);
    setErrors(EMPTY_ERRORS);
    autofilledFromLookup.current = false;
    setCheckoutModeState('takeaway_now');
    setPaymentMethod(isCustomerTerminal ? 'UPI' : 'Cash');
    setAmountTendered('');
    setDeliveryCharge('0');
    setPartner({ name: '', phone: '' });
    setLookupHint(hintFor('info', getTerminalCopy(isCustomerTerminal).lookupInfo));
    dispatchCart({ type: 'reset' });
    setCategory('All');
    setSearchQuery('');
    setPromoCode('');
    setPromoError('');
    setPromoAppliedCode('');
    setModeError('');
    setNotice('');
    setQuote(null);
    setQuoteError('');
    setOutcome(null);
    setStep(1);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [items, profile] = await Promise.all([loadCatalog(), loadBusinessProfile()]);
        if (cancelled) return;
        setCatalog(items);
        setBusiness(profile);
        if (profile && profile.plan) localStorage.setItem('activeBusinessPlan', profile.plan);
      } catch (error) {
        if (!cancelled) setBootError(error.message || 'Could not load the product list.');
      }
      if (cancelled) return;
      setPlanBadge(getPlanBadge());
      resetPOS();
      setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep stock on the cards current while the till is open.
  useEffect(() => {
    if (!booted) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && step < 4) reloadCatalog().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [booted, step, reloadCatalog]);

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

  const subtotal = getCartSubtotal(cart);
  const cartQty = useMemo(() => Object.fromEntries(cart.map((c) => [c.id, c.qty])), [cart]);

  // A coupon is re-checked by the server whenever the bill changes.
  useEffect(() => {
    if (!promoAppliedCode || !cart.length) return undefined;
    const timer = setTimeout(async () => {
      const res = await validateCoupon(promoAppliedCode, subtotal, customer.phone);
      if (res.active) dispatchCart({ type: 'discount', discount: res });
      else {
        dispatchCart({ type: 'discount', discount: INACTIVE_DISCOUNT });
        setPromoAppliedCode('');
        setPromoError(res.error || 'Coupon no longer applies');
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [subtotal, promoAppliedCode, customer.phone, cart.length]);

  async function runCustomerLookup(rawPhone) {
    const phone = sanitizePhone(rawPhone);
    setCustomer((c) => (c.phone === phone ? c : { ...c, phone }));
    const requestId = ++customerLookupRequestId.current;
    const copy = getTerminalCopy(isCustomerTerminal);

    if (phone.length < 10) {
      setLookupHint(hintFor('info', copy.lookupInfo));
      return;
    }
    let profile = null;
    try {
      profile = await lookupCustomer(phone);
    } catch {
      profile = null;
    }
    if (requestId !== customerLookupRequestId.current) return;

    const hadExistingProfile = autofilledFromLookup.current;
    autofilledFromLookup.current = Boolean(profile);
    if (profile) {
      setCustomer((c) => ({
        ...c,
        name: String(profile.name || '').trim(),
        email: String(profile.email || '').trim(),
        address: String(profile.address || '').trim(),
      }));
      setLookupHint(hintFor('existing', copy.lookupExisting(profile.name)));
    } else {
      if (hadExistingProfile) setCustomer((c) => ({ ...c, name: '', email: '', address: '' }));
      setLookupHint(hintFor('new', copy.lookupNew));
    }
  }

  function handleFieldChange(field, value) {
    setCustomer((c) => ({ ...c, [field]: value }));
    clearError(field);
    setModeError('');
  }

  function handleWalkIn() {
    setCustomer({ ...EMPTY_CUSTOMER, name: 'Walk-in Customer', walkIn: true });
    setErrors(EMPTY_ERRORS);
    setStep(2);
  }

  function handleCustomerSubmit(e) {
    e.preventDefault();
    const validation = validateCustomerStep({ ...customer, deliveryOption: 'pickup' });
    setErrors({ ...EMPTY_ERRORS, ...validation.errors, address: '' });
    if (validation.isValid) setStep(2);
  }

  function addToCart(product) {
    const inCart = cartQty[product.id] || 0;
    if (product.stock <= 0) {
      setNotice(`${product.name} is out of stock.`);
      return;
    }
    if (inCart >= product.stock) {
      setNotice(`Only ${product.stock} ${product.name} in stock.`);
      return;
    }
    setNotice('');
    dispatchCart({ type: 'add', product });
  }

  function handleScan(code) {
    const product = findByCode(catalog, code);
    if (product) {
      addToCart(product);
      setSearchQuery('');
    } else if (code.trim()) {
      const matches = searchCatalog(catalog, code, category);
      if (matches.length === 1) {
        addToCart(matches[0]);
        setSearchQuery('');
      } else if (!matches.length) setNotice(`No product with code or name "${code.trim()}".`);
    }
  }

  async function handleApplyPromo() {
    const code = promoCode.trim();
    if (!code) return;
    setPromoError('');
    if (!cart.length) {
      setPromoError('Add items before applying a coupon.');
      return;
    }
    const res = await validateCoupon(code, subtotal, customer.phone);
    if (res.active) {
      dispatchCart({ type: 'discount', discount: res });
      setPromoAppliedCode(res.code);
      return;
    }
    setPromoError(res.error || 'This coupon cannot be used');
    dispatchCart({ type: 'discount', discount: INACTIVE_DISCOUNT });
  }

  function handleRemovePromo() {
    dispatchCart({ type: 'discount', discount: INACTIVE_DISCOUNT });
    setPromoCode('');
    setPromoError('');
    setPromoAppliedCode('');
  }

  const orderPayload = useCallback(
    () =>
      buildOrderPayload({
        cart,
        couponCode: promoAppliedCode,
        checkoutMode,
        paymentMethod,
        customer,
        deliveryCharge,
        partner,
        amountTendered,
      }),
    [cart, promoAppliedCode, checkoutMode, paymentMethod, customer, deliveryCharge, partner, amountTendered],
  );

  // Step 3 always shows the server's own figures for this bill.
  useEffect(() => {
    if (step !== 3 || !cart.length) return undefined;
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(async () => {
      try {
        const payload = orderPayload();
        const result = await quoteOrder({ ...payload, amountTendered: undefined });
        if (!cancelled) {
          setQuote(result);
          setQuoteError('');
        }
      } catch (error) {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(error.message || 'Could not check the bill with the server.');
        if (error.status === 409) reloadCatalog().catch(() => {});
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Customer typing does not change prices; only these do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cart, promoAppliedCode, checkoutMode, deliveryCharge, reloadCatalog]);

  function handleGoFulfillment() {
    if (!cart.length) return;
    setModeError('');
    setStep(3);
  }

  function validateCheckout() {
    const next = { ...EMPTY_ERRORS };
    const phone = sanitizePhone(customer.phone);
    if (isDelivery) {
      if (!PHONE_RE.test(phone)) next.phone = 'Enter the customer’s 10-digit mobile number.';
      const name = customer.walkIn && customer.name === 'Walk-in Customer' ? '' : customer.name.trim();
      if (name.length < 2) next.name = 'Enter the customer’s name.';
      if (customer.address.trim().length < 8) next.address = 'Enter the full delivery address.';
      if (partner.name.trim() && !PHONE_RE.test(partner.phone)) next.deliveryPartnerPhone = 'Enter the partner’s 10-digit number.';
      const charge = Number(deliveryCharge);
      if (!Number.isFinite(charge) || charge < 0 || charge > 500) return { errors: next, message: 'Delivery charge must be between ₹0 and ₹500.' };
    }
    if (paymentMethod === 'Cash' && amountTendered !== '' && quote && Number(amountTendered) < quote.total) {
      return { errors: next, message: `Cash received is less than the bill (${formatRupees(quote.total)}).` };
    }
    const hasErrors = Object.values(next).some(Boolean);
    return { errors: next, message: hasErrors ? 'Fill in the delivery details above.' : '' };
  }

  async function handleCheckout() {
    if (!cart.length) {
      setStep(2);
      return;
    }
    const check = validateCheckout();
    setErrors(check.errors);
    if (check.message) {
      setModeError(check.message);
      return;
    }
    setModeError('');
    setCheckoutBusy(true);
    try {
      const payload = orderPayload();
      if (isDelivery && customer.walkIn && customer.name === 'Walk-in Customer') payload.customer.name = undefined;
      const order = await placeOrder(payload);
      const tendered = payload.amountTendered;
      setOutcome({
        title: modeConfig.successTitle,
        subtitle: modeConfig.successSubtitle,
        rows: [
          { label: 'Bill', value: `${order.bill ? order.bill.billNo : ''} · ${order.id}` },
          { label: 'Customer', value: order.customerName || '-' },
          { label: 'Mode', value: modeConfig.summaryLabel },
          {
            label: 'Payment',
            value: order.paymentStatus === 'Pending' ? `${order.paymentMethod} (collect on delivery)` : order.paymentMethod,
          },
          ...(order.discountAmount > 0 ? [{ label: `Coupon ${order.promoCode}`, value: `- ${formatRupees(order.discountAmount)}` }] : []),
          ...(order.deliveryCharge > 0 ? [{ label: 'Delivery charge', value: formatRupees(order.deliveryCharge) }] : []),
          { label: 'Total', value: formatRupees(order.total) },
          { label: 'GST included', value: formatRupees(order.taxAmount) },
          ...(order.changeDue !== undefined ? [{ label: 'Change to return', value: formatRupees(order.changeDue) }] : []),
          ...(order.delivery
            ? [{ label: 'Delivery', value: `${order.delivery.id} · ${order.delivery.status}${order.delivery.partnerName ? ` (${order.delivery.partnerName})` : ''}` }]
            : []),
        ],
        receipt: receiptFromOrder(order, business, tendered !== undefined ? { tendered, change: order.changeDue } : {}),
      });
      announceSale(order.companyId);
      reloadCatalog().catch(() => {});
      setStep(4);
    } catch (error) {
      setModeError(error.message || 'Could not save this bill. Please try again.');
      if (error.status === 409) reloadCatalog().catch(() => {});
    } finally {
      setCheckoutBusy(false);
    }
  }

  function handleReprint(order) {
    setReprint(receiptFromOrder(order, business));
  }

  useEffect(() => {
    if (!reprint) return undefined;
    const timer = setTimeout(() => {
      printReceipt();
      setReprint(null);
    }, 50);
    return () => clearTimeout(timer);
  }, [reprint]);

  const totals = getCartTotals(cart, discount, 0);
  const hasItems = cart.length > 0;

  const stepCopy = {
    stepTitle: ct ? 'Start Self Checkout' : 'Start New Order',
    stepSubtitle: ct
      ? 'Add your details once. Saved shoppers auto-fill when you enter your phone number.'
      : 'Capture customer details first. Existing customers auto-fill when you enter their phone number.',
    submitLabel: ct ? 'Begin Shopping' : 'Begin Scanning / Manual Entry',
  };

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <>
      <main className="main-content" id="mainContent">
        <Header session={booted ? session : null} planBadge={planBadge} onShowSales={() => setSalesOpen(true)} />

        <div className="content-area" id="contentArea">
          {bootError && (
            <div className="cart-notice" role="alert" style={{ margin: '0 0 16px' }}>
              {bootError}
            </div>
          )}
          <CustomerStep
            active={step === 1}
            copy={stepCopy}
            lookupHint={lookupHint}
            customer={customer}
            errors={errors}
            onFieldChange={handleFieldChange}
            onPhoneChange={(value) => {
              clearError('phone');
              void runCustomerLookup(value);
            }}
            onPhoneBlur={() => void runCustomerLookup(customer.phone)}
            onSubmit={handleCustomerSubmit}
            onWalkIn={ct ? null : handleWalkIn}
          />

          <div id="step-2-pos" className={`step-container${step === 2 ? ' active' : ''}`}>
            <div className="pos-layout">
              <div className="pos-main">
                <div className="pos-controls">
                  <SearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} onSubmitCode={handleScan} />
                  <CategoryFilters
                    categories={getCategories(catalog)}
                    selectedCategory={category}
                    normalized={catClassesNormalized}
                    onSelectCategory={(c) => {
                      setCategory(c);
                      setCatClassesNormalized(true);
                    }}
                  />
                </div>
                <ProductGrid
                  products={searchCatalog(catalog, searchQuery, category)}
                  cartQty={cartQty}
                  onAddToCart={addToCart}
                  onShowOptions={(x, y, product) => setMenu({ open: true, x, y, product, measure: true })}
                />
              </div>

              <CartSidebar
                cart={cart}
                totals={totals}
                notice={notice}
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
                goFulfillmentLabel={ct ? 'Continue to checkout' : 'Continue to delivery & payment'}
                goFulfillmentDisabled={!hasItems}
                onUpdateQty={(cartId, delta) => {
                  const line = cart.find((c) => c.cartId === cartId);
                  if (line && delta > 0 && line.qty >= line.stock) setNotice(`Only ${line.stock} in stock.`);
                  else setNotice('');
                  dispatchCart({ type: 'qty', cartId, delta });
                }}
                onSetQty={(cartId, qty) => {
                  const line = cart.find((c) => c.cartId === cartId);
                  if (line && qty > line.stock) setNotice(`Only ${line.stock} ${line.name} in stock; quantity set to ${line.stock}.`);
                  else setNotice('');
                  dispatchCart({ type: 'setQty', cartId, qty });
                }}
                onRemove={(cartId) => dispatchCart({ type: 'remove', cartId })}
                onGoFulfillment={handleGoFulfillment}
              />
            </div>
          </div>

          <FulfillmentStep
            active={step === 3}
            heading={ct ? 'How would you like to receive this order?' : 'How should this order go out?'}
            quote={quote}
            quoting={quoting}
            quoteError={quoteError}
            checkoutMode={checkoutMode}
            isDelivery={isDelivery}
            customer={customer}
            errors={errors}
            deliveryCharge={deliveryCharge}
            partner={partner}
            paymentMethods={modeConfig.paymentMethods}
            paymentMethod={checkoutMode === 'cod_delivery' ? 'COD' : paymentMethod}
            amountTendered={amountTendered}
            modeError={modeError}
            checkoutLabel={checkoutBusy ? 'Saving…' : modeConfig.buttonLabel}
            checkoutDisabled={!booted || !hasItems || checkoutBusy || quoting || Boolean(quoteError)}
            onModeChange={setCheckoutMode}
            onFieldChange={handleFieldChange}
            onDeliveryChargeChange={(v) => {
              setDeliveryCharge(v);
              setModeError('');
            }}
            onPartnerChange={(field, value) => {
              setPartner((p) => ({ ...p, [field]: value }));
              clearError('deliveryPartnerPhone');
            }}
            onPaymentMethodChange={setPaymentMethod}
            onAmountTenderedChange={(v) => {
              setAmountTendered(v);
              setModeError('');
            }}
            onBack={() => {
              setModeError('');
              setQuoteError('');
              setStep(2);
            }}
            onCheckout={handleCheckout}
          />

          <PaymentStep
            active={step === 4}
            title={outcome ? outcome.title : ''}
            subtitle={outcome ? outcome.subtitle : ''}
            summary={outcome ? outcome.rows : null}
            receipt={outcome && !reprint ? outcome.receipt : null}
            resetLabel={ct ? 'Start another checkout' : 'Next customer'}
            onReset={resetPOS}
          />
        </div>
      </main>

      {reprint && <Receipt receipt={reprint} />}
      <MySalesModal open={salesOpen} userId={session.userId} onClose={() => setSalesOpen(false)} onReprint={handleReprint} />
      <ContextMenu
        menu={menu}
        onPick={(product) => {
          addToCart(product);
          setMenu((m) => ({ ...m, open: false }));
        }}
        onReposition={repositionMenu}
      />
    </>
  );
}
