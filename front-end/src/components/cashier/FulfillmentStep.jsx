import { formatRupees } from '../../lib/cashier/posHelpers.js';

const ERROR_STYLE = { display: 'block', color: 'var(--red)', fontSize: '0.8rem', marginTop: '4px' };

const MODES = [
  { value: 'takeaway_now', title: 'Take away now', copy: 'Customer pays and takes the items now.' },
  {
    value: 'prepaid_delivery',
    title: 'Delivery, paid now',
    copy: 'Take payment now; the order goes to the delivery desk.',
  },
  {
    value: 'cod_delivery',
    title: 'Delivery, cash on delivery',
    copy: 'The delivery partner collects the cash at the door.',
  },
];

/**
 * Step 3: how the order goes out and how it is paid. The amounts shown are the
 * server's quote (prices from the catalogue, coupon checked, GST worked out),
 * so what the customer sees here is exactly what the bill will say.
 */
export default function FulfillmentStep({
  active,
  heading,
  quote,
  quoting,
  quoteError,
  checkoutMode,
  isDelivery,
  customer,
  errors,
  deliveryCharge,
  partner,
  paymentMethods,
  paymentMethod,
  amountTendered,
  modeError,
  checkoutLabel,
  checkoutDisabled,
  onModeChange,
  onFieldChange,
  onDeliveryChargeChange,
  onPartnerChange,
  onPaymentMethodChange,
  onAmountTenderedChange,
  onBack,
  onCheckout,
}) {
  const total = quote ? quote.total : 0;
  const tendered = Number(amountTendered);
  const showChange = paymentMethod === 'Cash' && amountTendered !== '' && Number.isFinite(tendered);
  const change = showChange ? tendered - total : 0;

  return (
    <div id="step-3-fulfillment" className={`step-container${active ? ' active' : ''}`}>
      <div className="wizard-centered fulfillment-centered">
        <h3 id="checkoutModeHeading">{heading}</h3>
        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
          Choose how the order goes out, then take the payment.
        </p>

        <div className="checkout-summary-card" id="fulfillmentSummary" style={{ marginBottom: '16px' }}>
          {quote ? (
            <>
              <div className="checkout-summary-row">
                <span>Items ({quote.lines.reduce((s, l) => s + l.quantity, 0)})</span>
                <strong id="fulfillmentSubSpan">{formatRupees(quote.subtotal)}</strong>
              </div>
              {quote.discountAmount > 0 && (
                <div className="checkout-summary-row">
                  <span>Coupon {quote.promoCode}</span>
                  <strong id="fulfillmentDiscSpan">{`- ${formatRupees(quote.discountAmount)}`}</strong>
                </div>
              )}
              {isDelivery && (
                <div className="checkout-summary-row">
                  <span>Delivery charge</span>
                  <strong id="fulfillmentDeliverySpan">{formatRupees(quote.deliveryCharge)}</strong>
                </div>
              )}
              <div className="checkout-summary-row">
                <span>Amount payable</span>
                <strong id="fulfillmentTotSpan">{formatRupees(quote.total)}</strong>
              </div>
              <div className="quote-note">
                Includes GST of {formatRupees(quote.taxAmount)}. Prices and stock checked with the server
                {quoting ? '…' : '.'}
              </div>
            </>
          ) : (
            <div className="checkout-summary-row">
              <span>{quoting ? 'Checking prices and stock…' : 'Totals unavailable'}</span>
            </div>
          )}
        </div>
        {quoteError && (
          <div className="cart-notice" role="alert" style={{ margin: '0 0 12px' }}>
            {quoteError}
          </div>
        )}

        <div className="checkout-mode-block" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          <div className="checkout-mode-grid" id="checkoutModeGrid">
            {MODES.map((mode) => (
              <label key={mode.value} className={`checkout-mode-card${checkoutMode === mode.value ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="checkoutMode"
                  value={mode.value}
                  checked={checkoutMode === mode.value}
                  onChange={(e) => {
                    if (e.target.checked) onModeChange(mode.value);
                  }}
                />
                <span className="checkout-mode-title">{mode.title}</span>
                <span className="checkout-mode-copy">{mode.copy}</span>
              </label>
            ))}
          </div>

          <div
            id="deliveryPartnerFields"
            className="delivery-details-block"
            style={{ display: isDelivery ? 'block' : 'none', marginTop: '12px' }}
          >
            <div className="form-row delivery-contact-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cDeliveryPhone">
                  Customer phone *
                </label>
                <input
                  type="tel"
                  className="form-control"
                  id="cDeliveryPhone"
                  placeholder="10-digit mobile"
                  maxLength={10}
                  inputMode="numeric"
                  value={customer.phone}
                  onChange={(e) => onFieldChange('phone', e.target.value.replace(/\D/g, ''))}
                />
                <div className="form-error" style={ERROR_STYLE}>
                  {errors.phone}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cDeliveryName">
                  Customer name *
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="cDeliveryName"
                  value={customer.walkIn && customer.name === 'Walk-in Customer' ? '' : customer.name}
                  onChange={(e) => onFieldChange('name', e.target.value)}
                />
                <div className="form-error" style={ERROR_STYLE}>
                  {errors.name}
                </div>
              </div>
            </div>
            <label className="form-label" htmlFor="cAddress">
              Delivery address *
            </label>
            <textarea
              className="form-control"
              id="cAddress"
              rows="2"
              placeholder="House / street / area / landmark"
              value={customer.address}
              onChange={(e) => onFieldChange('address', e.target.value)}
            ></textarea>
            <div className="form-error" id="errAddress" style={ERROR_STYLE}>
              {errors.address}
            </div>
            <div className="form-row delivery-contact-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cDeliveryCharge">
                  Delivery charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  className="form-control"
                  id="cDeliveryCharge"
                  value={deliveryCharge}
                  onChange={(e) => onDeliveryChargeChange(e.target.value)}
                />
              </div>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', margin: '10px 0 0' }}>
              Delivery partner is optional. Leave it empty and the delivery desk will assign one.
            </p>
            <div className="form-row delivery-contact-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cDeliveryPartner">
                  Partner name
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="cDeliveryPartner"
                  value={partner.name}
                  onChange={(e) => onPartnerChange('name', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cDeliveryPartnerPhone">
                  Partner phone
                </label>
                <input
                  type="tel"
                  className="form-control"
                  id="cDeliveryPartnerPhone"
                  placeholder="10-digit mobile"
                  maxLength={10}
                  inputMode="numeric"
                  value={partner.phone}
                  onChange={(e) => onPartnerChange('phone', e.target.value.replace(/\D/g, ''))}
                />
                <div className="form-error" id="errDeliveryPartnerPhone" style={ERROR_STYLE}>
                  {errors.deliveryPartnerPhone}
                </div>
              </div>
            </div>
          </div>

          {paymentMethods.length > 1 ? (
            <>
              <div className="form-label" style={{ marginTop: '14px' }}>
                Payment method
              </div>
              <div className="pay-method-row" role="radiogroup" aria-label="Payment method">
                {paymentMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === m}
                    className={`btn btn-outline${paymentMethod === m ? ' active' : ''}`}
                    onClick={() => onPaymentMethodChange(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted" style={{ marginTop: '12px', fontSize: '0.85rem' }}>
              Payment: cash collected by the delivery partner ({formatRupees(total)}).
            </p>
          )}

          {paymentMethod === 'Cash' && (
            <div className="form-row" style={{ marginTop: '8px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cTendered">
                  Cash received (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-control"
                  id="cTendered"
                  placeholder={total ? String(Math.ceil(total)) : ''}
                  value={amountTendered}
                  onChange={(e) => onAmountTenderedChange(e.target.value)}
                />
              </div>
              <div className="form-group">
                <span className="form-label">Change to return</span>
                <strong style={{ display: 'block', paddingTop: '8px', color: change < 0 ? 'var(--red)' : undefined }}>
                  {showChange ? (change < 0 ? `${formatRupees(-change)} short` : formatRupees(change)) : '—'}
                </strong>
              </div>
            </div>
          )}

          <div id="checkoutModeError" className="text-sm" style={{ color: 'var(--red)', minHeight: '18px' }}>
            {modeError}
          </div>
        </div>
        <div className="fulfillment-actions">
          <button id="btnBackToCart" className="btn btn-outline" style={{ justifyContent: 'center' }} onClick={onBack}>
            Back to cart
          </button>
          <button
            id="btnCheckout"
            className="btn btn-primary"
            style={{ justifyContent: 'center' }}
            disabled={checkoutDisabled}
            onClick={onCheckout}
          >
            {checkoutLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
