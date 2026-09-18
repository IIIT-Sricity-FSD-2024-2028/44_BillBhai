import CartItem from './CartItem.jsx';

export default function CartItemList({ cart, onUpdateQty }) {
  return (
    <div className="cart-body" id="cartItemsList">
      {cart.length === 0 && <div className="cart-empty text-muted">Cart is empty. Click items to add.</div>}
      {cart.map((item) => (
        <CartItem key={item.cartId} item={item} onUpdateQty={onUpdateQty} />
      ))}
    </div>
  );
}
