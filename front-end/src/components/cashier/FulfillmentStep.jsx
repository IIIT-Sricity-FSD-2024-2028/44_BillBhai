import { formatRupees } from '../../lib/cashier/posHelpers.js';

const ERROR_STYLE = { display: 'block', color: 'var(--red)', fontSize: '0.8rem', marginTop: '4px' };

const MODES = [
  { value: 'takeaway_now', title: 'Take Away Now', copy: 'Hand over immediately at the counter.' },
  { value: 'prepaid_delivery', title: 'Delivery + Pay Upfront', copy: 'Collect payment now and dispatch for delivery.' },
  { value: 'cod_delivery', title: 'Delivery + COD', copy: 'Dispatch now and collect cash on delivery.' },
];

// STEP 3: Fulfillment + Delivery Details
export default function FulfillmentStep({
  active,
  heading,
  totals,
  checkoutMode,
  isDelivery,
  customer,
  errors,
  modeError,
  checkoutLabel,
  checkoutDisabled,
  onModeChange,
  onFieldChange,
  onBack,
  onCheckout,
}) {
  return (
    <div id="step-3-fulfillment" className={`step-container${active ? ' active' : ''}`}>
      <div className="wizard-centered fulfillment-centered">
        <h3 id="checkoutModeHeading">{heading}</h3>
        <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
          Choose fulfillment, add delivery details if required, then proceed to payment.
        </p>

        <div className="checkout-summary-card" id="fulfillmentSummary" style={{ marginBottom: '16px' }}>
          <div className="checkout-summary-row"><span>Subtotal</span><strong id="fulfillmentSubSpan">{formatRupees(totals.subtotal)}</strong></div>
          <div className="checkout-summary-row"><span>Discount</span><strong id="fulfillmentDiscSpan">{`- ${formatRupees(totals.discount)}`}</strong></div>
          <div className="checkout-summary-row"><span>Delivery Charges</span><strong id="fulfillmentDeliverySpan">{formatRupees(totals.deliveryCharge)}</strong></div>
          <div className="checkout-summary-row"><span>Amount Payable</span><strong id="fulfillmentTotSpan">{formatRupees(totals.payableTotal)}</strong></div>
        </div>

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

          <div id="deliveryPartnerFields" className="delivery-details-block" style={{ display: isDelivery ? 'block' : 'none', marginTop: '12px' }}>
            <label className="form-label" htmlFor="cAddress">Delivery Address *</label>
            <textarea className="form-control" id="cAddress" rows="2" placeholder="Required for delivery" value={customer.address} onChange={(e) => onFieldChange('address', e.target.value)}></textarea>
            <div className="form-error" id="errAddress" style={ERROR_STYLE}>{errors.address}</div>
            <div className="form-row delivery-contact-row">
              <div className="form-group">
                <label className="form-label" htmlFor="cDeliveryPartner">Delivery Partner / Boy</label>
                <input type="text" className="form-control" id="cDeliveryPartner" placeholder="Optional assignment" value={customer.deliveryPartner} onChange={(e) => onFieldChange('deliveryPartner', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cDeliveryPartnerPhone">Delivery Contact</label>
                <input type="tel" className="form-control" id="cDeliveryPartnerPhone" placeholder="10-digit number" maxLength={10} inputMode="numeric" value={customer.deliveryPartnerPhone} onChange={(e) => onFieldChange('deliveryPartnerPhone', e.target.value)} />
                <div className="form-error" id="errDeliveryPartnerPhone" style={ERROR_STYLE}>{errors.deliveryPartnerPhone}</div>
              </div>
            </div>
          </div>

          <div id="checkoutModeError" className="text-sm" style={{ color: 'var(--red)', minHeight: '18px' }}>{modeError}</div>
        </div>

        <div className="fulfillment-actions">
          <button id="btnBackToCart" className="btn btn-outline" style={{ justifyContent: 'center' }} onClick={onBack}>Back to Cart</button>
          <button id="btnCheckout" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={checkoutDisabled} onClick={onCheckout}>{checkoutLabel}</button>
        </div>
      </div>
    </div>
  );
}
