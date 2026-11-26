import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import usePageSetup from '../../shared/hooks/usePageSetup.js';
import { ROLE_ALLOWED_PAGES } from '../../shared/lib/dashboard/constants.js';
import { CSS, FONTS } from '../../shared/lib/pageAssets.js';
import { getAuthToken } from '../../shared/lib/http.js';
import {
  buildOrderPayload,
  findByCode,
  getSessionContext,
  searchCatalog,
} from './lib/dataStore.js';
import { validateCustomerStep } from './lib/validation.js';
import {
  formatRupees,
  getCheckoutModeConfig,
  getPlanBadge,
  getTerminalCopy,
  sanitizePhone,
} from './lib/posHelpers.js';
import printReceipt from '../../shared/lib/printReceipt.js';
import { selectMyCompany } from '../companies/companiesSlice.js';
import {
  clearCustomerLookup,
  lookupCustomerByPhoneThunk,
} from './customersSlice.js';
import {
  addToCart as addToCartAction,
  bootPosThunk,
  clearFieldError,
  clearQuoteError,
  EMPTY_ERRORS,
  placePosOrderThunk,
  quotePosOrderThunk,
  reloadCatalogThunk,
  removeFromCart,
  removePromo,
  resetPosSession,
  selectCartQtyMap,
  selectCartSubtotal,
  selectCartTotals,
  selectCatalogCategories,
  selectFilteredCatalog,
  selectPosState,
  setAmountTendered,
  setCartExactQty,
  setCategory,
  setCheckoutModeAction,
  setCustomerFields,
  setDeliveryCharge,
  setErrors,
  setModeError,
  setNotice,
  setPartnerField,
  setPaymentMethod,
  setPaymentRef,
  setPromoCodeInput,
  setPromoError,
  setSearchQuery,
  setStep,
  setWalkInCustomer,
  updateCartQty,
  validatePromoThunk,
} from './posCartSlice.js';
import Header from './components/Header.jsx';
import CustomerStep from './components/CustomerStep.jsx';
import SearchBar from './components/SearchBar.jsx';
import CategoryFilters from './components/CategoryFilters.jsx';
import ProductGrid from './components/ProductGrid.jsx';
import CartSidebar from './components/CartSidebar.jsx';
import FulfillmentStep from './components/FulfillmentStep.jsx';
import PaymentStep from './components/PaymentStep.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import MySalesModal from './components/MySalesModal.jsx';
import Receipt, { receiptFromOrder } from './components/Receipt.jsx';

const HIDDEN_MENU = { open: false, x: null, y: null, product: null, measure: false };
const PHONE_RE = /^[6-9]\d{9}$/;

function hintFor(type, text) {
  let className = 'text-sm text-muted';
  if (type === 'existing') className = 'text-sm lookup-existing';
  else if (type === 'new') className = 'text-sm lookup-new';
  return { className, text };
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
  const dispatch = useDispatch();
  const [redirectTo] = useState(posRedirect);
  const [session] = useState(() => getSessionContext());
  const isCustomerTerminal = Boolean(session.isCustomerTerminal);

  const pos = useSelector(selectPosState);
  const business = useSelector(selectMyCompany);
  const subtotal = useSelector(selectCartSubtotal);
  const totals = useSelector(selectCartTotals);
  const cartQty = useSelector(selectCartQtyMap);
  const categories = useSelector(selectCatalogCategories);
  const filteredProducts = useSelector(selectFilteredCatalog);

  const {
    booted,
    bootError,
    catalog,
    step,
    items: cart,
    customer,
    errors,
    checkoutMode,
    paymentMethod,
    paymentRef,
    amountTendered,
    deliveryCharge,
    partner,
    modeError,
    notice,
    category,
    catClassesNormalized,
    searchQuery,
    promoCode,
    promoAppliedCode,
    promoError,
    quote,
    quoting,
    quoteError,
    checkoutBusy,
    completedOrder,
    completedTendered,
  } = pos;

  const [planBadge, setPlanBadge] = useState(null);
  const [lookupHint, setLookupHint] = useState(() => hintFor('info', getTerminalCopy(false).lookupInfo));
  const customerLookupRequestId = useRef(0);
  const autofilledFromLookup = useRef(false);
  const [menu, setMenu] = useState(HIDDEN_MENU);
  const [salesOpen, setSalesOpen] = useState(false);
  const [reprint, setReprint] = useState(null);

  const ct = booted && isCustomerTerminal;
  const activePlanKey = String(localStorage.getItem('activeBusinessPlan') || '').toLowerCase();
  const isStarterPlan = activePlanKey === 'starter' || activePlanKey.includes('free');
  const modeConfig = getCheckoutModeConfig(checkoutMode, isCustomerTerminal);
  const isDelivery = modeConfig.deliveryOption === 'delivery';

  usePageSetup({
    title: ct ? 'BillBhai - Self Checkout' : 'BillBhai - POS Terminal',
    styles: [CSS.dashboard, CSS.cashier],
    fonts: FONTS.app,
    bodyClass: 'no-sidebar',
    bodyAttrs: { 'data-page': 'cashier', 'data-app-ready': 'true' },
  });

  const reloadCatalog = useCallback(() => dispatch(reloadCatalogThunk()), [dispatch]);

  const resetPOS = useCallback(() => {
    autofilledFromLookup.current = false;
    setLookupHint(hintFor('info', getTerminalCopy(isCustomerTerminal).lookupInfo));
    dispatch(clearCustomerLookup());
    dispatch(resetPosSession(isCustomerTerminal));
  }, [dispatch, isCustomerTerminal]);

  useEffect(() => {
    dispatch(bootPosThunk()).finally(() => {
      setPlanBadge(getPlanBadge());
      resetPOS();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep stock on the cards current while the till is open.
  useEffect(() => {
    if (!booted) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && step < 4) reloadCatalog();
    }, 30000);
    return () => clearInterval(timer);
  }, [booted, step, reloadCatalog]);

  // Warn before closing/reloading if there is an active cart.
  useEffect(() => {
    if (!cart.length || step >= 4) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [cart.length, step]);

  // Focus the search box when entering step 2 (Walk-in or Begin).
  useEffect(() => {
    if (step !== 2) return undefined;
    const timer = setTimeout(() => {
      const el = document.getElementById('posSearch');
      if (el) el.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [step]);

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

  // A coupon is re-checked by the server whenever the bill changes.
  useEffect(() => {
    if (!promoAppliedCode || !cart.length) return undefined;
    const timer = setTimeout(() => {
      dispatch(
        validatePromoThunk({
          code: promoAppliedCode,
          subtotal,
          phone: customer.phone,
        }),
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [dispatch, subtotal, promoAppliedCode, customer.phone, cart.length]);

  async function runCustomerLookup(rawPhone) {
    const phone = sanitizePhone(rawPhone);
    if (customer.phone !== phone) {
      dispatch(setCustomerFields({ phone }));
    }
    const requestId = ++customerLookupRequestId.current;
    const copy = getTerminalCopy(isCustomerTerminal);

    if (phone.length < 10) {
      dispatch(clearCustomerLookup());
      setLookupHint(hintFor('info', copy.lookupInfo));
      return;
    }

    let profile = null;
    let knownOnly = false;
    try {
      const res = await dispatch(lookupCustomerByPhoneThunk(phone)).unwrap();
      const found = res ? res.profile : null;
      profile = found && found.known === undefined ? found : null;
      knownOnly = Boolean(found && found.known === true);
    } catch {
      profile = null;
    }
    if (requestId !== customerLookupRequestId.current) return;

    const hadExistingProfile = autofilledFromLookup.current;
    autofilledFromLookup.current = Boolean(profile);
    if (profile) {
      dispatch(
        setCustomerFields({
          name: String(profile.name || '').trim(),
          email: String(profile.email || '').trim(),
          address: String(profile.address || '').trim(),
        }),
      );
      setLookupHint(hintFor('existing', copy.lookupExisting(profile.name)));
    } else if (knownOnly) {
      setLookupHint(hintFor('existing', 'Saved profile found. Enter your details to continue.'));
    } else {
      if (hadExistingProfile) {
        dispatch(setCustomerFields({ name: '', email: '', address: '' }));
      }
      setLookupHint(hintFor('new', copy.lookupNew));
    }
  }

  function handleFieldChange(field, value) {
    dispatch(setCustomerFields({ [field]: value }));
    dispatch(clearFieldError(field));
    dispatch(setModeError(''));
  }

  function handleWalkIn() {
    dispatch(setWalkInCustomer());
  }

  function handleCustomerSubmit(e) {
    e.preventDefault();
    const validation = validateCustomerStep({ ...customer, deliveryOption: 'pickup' });
    dispatch(setErrors({ ...EMPTY_ERRORS, ...validation.errors, address: '' }));
    if (validation.isValid) dispatch(setStep(2));
  }

  function addToCart(product) {
    const inCart = cartQty[product.id] || 0;
    if (product.stock <= 0) {
      dispatch(setNotice(`${product.name} is out of stock.`));
      return;
    }
    if (inCart >= product.stock) {
      dispatch(setNotice(`Only ${product.stock} ${product.name} in stock.`));
      return;
    }
    dispatch(addToCartAction(product));
  }

  function handleScan(code) {
    const product = findByCode(catalog, code);
    if (product) {
      addToCart(product);
      dispatch(setSearchQuery(''));
    } else if (code.trim()) {
      const matches = searchCatalog(catalog, code, category);
      if (matches.length === 1) {
        addToCart(matches[0]);
        dispatch(setSearchQuery(''));
      } else if (!matches.length) {
        dispatch(setNotice(`No product with code or name "${code.trim()}".`));
      }
    }
  }

  async function handleApplyPromo() {
    const code = promoCode.trim();
    if (!code) return;
    dispatch(setPromoError(''));
    if (!cart.length) {
      dispatch(setPromoError('Add items before applying a coupon.'));
      return;
    }
    await dispatch(validatePromoThunk({ code, subtotal, phone: customer.phone }));
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
    const timer = setTimeout(async () => {
      const payload = orderPayload();
      try {
        await dispatch(quotePosOrderThunk({ ...payload, amountTendered: undefined })).unwrap();
      } catch (err) {
        if (err && err.status === 409) reloadCatalog();
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, step, cart, promoAppliedCode, checkoutMode, deliveryCharge, reloadCatalog]);

  function handleGoFulfillment() {
    if (!cart.length) return;
    dispatch(setModeError(''));
    dispatch(setStep(3));
  }

  function validateCheckout() {
    const next = { ...EMPTY_ERRORS };
    const phone = sanitizePhone(customer.phone);
    if (isDelivery) {
      if (!PHONE_RE.test(phone)) next.phone = 'Enter the customer’s 10-digit mobile number.';
      const name = customer.walkIn && customer.name === 'Walk-in Customer' ? '' : customer.name.trim();
      if (name.length < 2) next.name = 'Enter the customer’s name.';
      if (customer.address.trim().length < 8) next.address = 'Enter the full delivery address.';
      if (partner.name.trim() && !PHONE_RE.test(partner.phone)) {
        next.deliveryPartnerPhone = 'Enter the partner’s 10-digit number.';
      }
      const charge = Number(deliveryCharge);
      if (!Number.isFinite(charge) || charge < 0 || charge > 500) {
        return { errors: next, message: 'Delivery charge must be between ₹0 and ₹500.' };
      }
    }
    if (paymentMethod === 'Cash' && checkoutMode === 'takeaway_now' && String(amountTendered).trim() === '') {
      return {
        errors: next,
        message: 'Enter the cash received from the customer.',
      };
    }
    if (paymentMethod === 'Cash' && amountTendered !== '' && quote && Number(amountTendered) < quote.total) {
      return {
        errors: next,
        message: `Cash received is less than the bill (${formatRupees(quote.total)}).`,
      };
    }
    const hasErrors = Object.values(next).some(Boolean);
    return { errors: next, message: hasErrors ? 'Fill in the delivery details above.' : '' };
  }

  async function handleCheckout() {
    if (!cart.length) {
      dispatch(setStep(2));
      return;
    }
    const check = validateCheckout();
    dispatch(setErrors(check.errors));
    if (check.message) {
      dispatch(setModeError(check.message));
      return;
    }
    const payload = orderPayload();
    if (paymentRef && (paymentMethod === 'UPI' || paymentMethod === 'Card')) {
      payload.notes = [payload.notes, `${paymentMethod} Ref: ${paymentRef.trim()}`].filter(Boolean).join(' · ');
    }
    if (isDelivery && customer.walkIn && customer.name === 'Walk-in Customer') {
      payload.customer.name = undefined;
    }
    try {
      await dispatch(
        placePosOrderThunk({ payload, tendered: payload.amountTendered }),
      ).unwrap();
    } catch (err) {
      if (err && err.status === 409) reloadCatalog();
    }
  }

  const outcome = useMemo(() => {
    if (!completedOrder) return null;
    const order = completedOrder;
    return {
      title: modeConfig.successTitle,
      subtitle: modeConfig.successSubtitle,
      rows: [
        { label: 'Bill', value: `${order.bill ? order.bill.billNo : ''} · ${order.id}` },
        { label: 'Customer', value: order.customerName || '-' },
        { label: 'Mode', value: modeConfig.summaryLabel },
        {
          label: 'Payment',
          value:
            order.paymentStatus === 'Pending'
              ? `${order.paymentMethod} (collect on delivery)`
              : order.paymentMethod,
        },
        ...(order.discountAmount > 0
          ? [{ label: `Coupon ${order.promoCode}`, value: `- ${formatRupees(order.discountAmount)}` }]
          : []),
        ...(order.deliveryCharge > 0
          ? [{ label: 'Delivery charge', value: formatRupees(order.deliveryCharge) }]
          : []),
        { label: 'Total', value: formatRupees(order.total) },
        { label: 'GST included', value: formatRupees(order.taxAmount) },
        ...(order.changeDue !== undefined
          ? [{ label: 'Change to return', value: formatRupees(order.changeDue) }]
          : []),
        ...(order.delivery
          ? [
              {
                label: 'Delivery',
                value: `${order.delivery.id} · ${order.delivery.status}${
                  order.delivery.partnerName ? ` (${order.delivery.partnerName})` : ''
                }`,
              },
            ]
          : []),
      ],
      receipt: receiptFromOrder(
        order,
        business,
        completedTendered !== undefined
          ? { tendered: completedTendered, change: order.changeDue }
          : {},
      ),
    };
  }, [completedOrder, completedTendered, business, modeConfig]);

  function handleReprint(order) {
    setReprint(receiptFromOrder(order, business, { isDuplicate: true }));
  }

  useEffect(() => {
    if (!reprint) return undefined;
    const timer = setTimeout(() => {
      printReceipt();
      setReprint(null);
    }, 50);
    return () => clearTimeout(timer);
  }, [reprint]);

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
              dispatch(clearFieldError('phone'));
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
                  <SearchBar
                    searchQuery={searchQuery}
                    onSearchChange={(q) => dispatch(setSearchQuery(q))}
                    onSubmitCode={handleScan}
                  />
                  <CategoryFilters
                    categories={categories}
                    selectedCategory={category}
                    normalized={catClassesNormalized}
                    onSelectCategory={(c) => dispatch(setCategory(c))}
                  />
                </div>
                <ProductGrid
                  products={filteredProducts}
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
                  onPromoCodeChange: (value) => dispatch(setPromoCodeInput(value)),
                  onApply: handleApplyPromo,
                  onRemove: () => dispatch(removePromo()),
                }}
                allowPromo={!isStarterPlan}
                goFulfillmentLabel={ct ? 'Continue to checkout' : isStarterPlan ? 'Continue to payment' : 'Continue to delivery & payment'}
                goFulfillmentDisabled={!hasItems}
                onUpdateQty={(cartId, delta) => dispatch(updateCartQty({ cartId, delta }))}
                onSetQty={(cartId, qty) => dispatch(setCartExactQty({ cartId, qty }))}
                onRemove={(cartId) => dispatch(removeFromCart(cartId))}
                onGoFulfillment={handleGoFulfillment}
                onBackToCustomer={() => dispatch(setStep(1))}
                onCancelBill={resetPOS}
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
            allowDelivery={!isStarterPlan}
            isDelivery={isDelivery}
            customer={customer}
            errors={errors}
            deliveryCharge={deliveryCharge}
            partner={partner}
            paymentMethods={modeConfig.paymentMethods}
            paymentMethod={checkoutMode === 'cod_delivery' ? 'COD' : paymentMethod}
            paymentRef={paymentRef}
            amountTendered={amountTendered}
            modeError={modeError}
            checkoutLabel={checkoutBusy ? 'Saving…' : modeConfig.buttonLabel}
            checkoutDisabled={!booted || !hasItems || checkoutBusy || quoting || Boolean(quoteError)}
            onModeChange={(mode) => dispatch(setCheckoutModeAction({ mode, isCustomerTerminal }))}
            onFieldChange={handleFieldChange}
            onDeliveryChargeChange={(v) => dispatch(setDeliveryCharge(v))}
            onPartnerChange={(field, value) => dispatch(setPartnerField({ field, value }))}
            onPaymentMethodChange={(m) => dispatch(setPaymentMethod(m))}
            onPaymentRefChange={(v) => dispatch(setPaymentRef(v))}
            onAmountTenderedChange={(v) => dispatch(setAmountTendered(v))}
            onBack={() => {
              dispatch(setModeError(''));
              dispatch(clearQuoteError());
              dispatch(setStep(2));
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
