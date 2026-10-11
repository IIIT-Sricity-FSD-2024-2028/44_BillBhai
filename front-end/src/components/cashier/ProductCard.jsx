import { useRef } from 'react';
import { resolveProductVisual, formatRupees } from '../../lib/cashier/posHelpers.js';

export default function ProductCard({ product, onAddToCart, onShowOptions }) {
  const pressTimer = useRef(null);
  const defaultOpt = product.options[0];
  const visual = resolveProductVisual(product);

  return (
    <div
      className="prod-card"
      onClick={(event) => {
        if (event.button === 0) onAddToCart(product);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onShowOptions(event.pageX, event.pageY, product);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        pressTimer.current = window.setTimeout(() => {
          onShowOptions(touch.pageX, touch.pageY, product);
        }, 600);
      }}
      onTouchEnd={() => clearTimeout(pressTimer.current)}
      onTouchMove={() => clearTimeout(pressTimer.current)}
    >
      <div className="prod-img">{visual}</div>
      <div className="prod-info">
        <div className="prod-name">{`${product.name} (${defaultOpt.label})`}</div>
        <div className="prod-price">{formatRupees(defaultOpt.price)}</div>
      </div>
    </div>
  );
}
