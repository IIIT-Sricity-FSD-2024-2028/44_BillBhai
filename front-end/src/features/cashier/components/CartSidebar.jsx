import CartItemList from './CartItemList.jsx';
import PromoBlock from './PromoBlock.jsx';
import CartSummary from './CartSummary.jsx';

// Cart Sidebar Area
export default function CartSidebar({
  cart,
  totals,
  promo,
  allowPromo = true,
  goFulfillmentLabel,
  goFulfillmentDisabled,
  onUpdateQty,
  onSetQty,
  onRemove,
  notice,
  onGoFulfillment,
  onBackToCustomer,
  onCancelBill,
}) {
  return (
    <div className="pos-sidebar">
      <div className="cart-header">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        Active Cart
      </div>

      {notice && (
        <div className="cart-notice" role="status">
          {notice}
        </div>
      )}
      <CartItemList cart={cart} onUpdateQty={onUpdateQty} onSetQty={onSetQty} onRemove={onRemove} />

      <div className="cart-footer">
        {allowPromo && <PromoBlock {...promo} />}

        <CartSummary totals={totals} />
        <br />
        <button
          id="btnGoFulfillment"
          className="btn btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          }}
          disabled={goFulfillmentDisabled}
          onClick={onGoFulfillment}
        >
          {goFulfillmentLabel}
        </button>
        {(onBackToCustomer || onCancelBill) && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {onBackToCustomer && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '6px 8px' }}
                onClick={onBackToCustomer}
              >
                ← Customer
              </button>
            )}
            {onCancelBill && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '6px 8px', color: 'var(--red)', borderColor: 'var(--red)' }}
                onClick={onCancelBill}
              >
                Cancel bill
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
