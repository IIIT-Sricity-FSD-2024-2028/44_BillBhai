import { formatRupees } from '../../lib/cashier/posHelpers.js';

export default function CartSummary({ totals }) {
  return (
    <>
      <div className="cf-row">
        <span>Subtotal</span>
        <span id="subSpan">{formatRupees(totals.subtotal)}</span>
      </div>
      <div className="cf-row">
        <span>Discount</span>
        <span id="discSpan" style={{ color: 'var(--green)' }}>{`- ${formatRupees(totals.discount)}`}</span>
      </div>
      <div className="cf-tot">
        <span>Grand Total</span>
        <span id="totSpan">{formatRupees(totals.itemTotal)}</span>
      </div>
    </>
  );
}
