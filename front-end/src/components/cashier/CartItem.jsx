import { formatRupees } from '../../lib/cashier/posHelpers.js';

export default function CartItem({ item, onUpdateQty }) {
  return (
    <div className="cart-item">
      <div className="c-info">
        <div className="c-name">{item.name}</div>
        <div className="c-price">{formatRupees(item.price * item.qty)}</div>
      </div>
      <div className="c-actions">
        <button className="qty-btn dec" data-id={item.cartId} onClick={() => onUpdateQty(item.cartId, -1)}>-</button>
        <span>{item.qty}</span>
        <button className="qty-btn inc" data-id={item.cartId} onClick={() => onUpdateQty(item.cartId, 1)}>+</button>
      </div>
    </div>
  );
}
