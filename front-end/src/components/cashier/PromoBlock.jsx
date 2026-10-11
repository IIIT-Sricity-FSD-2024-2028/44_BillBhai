// Promo input / applied tag / error line from the cart footer.
export default function PromoBlock({ promoCode, appliedCode, error, onPromoCodeChange, onApply, onRemove }) {
  const applied = Boolean(appliedCode);
  return (
    <>
      <div className="promo-block" id="promoInputBlock" style={{ display: applied ? 'none' : 'flex' }}>
        <input type="text" id="promoCode" className="promo-input" placeholder="Promo Code (e.g. WELCOME10)" value={promoCode} onChange={(e) => onPromoCodeChange(e.target.value)} />
        <button className="btn btn-outline" id="applyPromoBtn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={onApply}>Apply</button>
      </div>
      <div className="promo-applied" id="promoAppliedTag" style={{ display: applied ? 'flex' : 'none' }}>
        <span className="promo-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          <span id="promoAppliedCode">{appliedCode}</span>
        </span>
        <button className="promo-remove" id="removePromoBtn" title="Remove discount code" onClick={onRemove}>&times; Remove</button>
      </div>
      <div id="promoError" style={{ color: 'var(--red)', fontSize: '0.8rem', marginBottom: '10px' }}>{error}</div>
    </>
  );
}
