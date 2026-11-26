import { useRef } from 'react';
import { resolveProductVisual, formatRupees } from '../lib/posHelpers.js';

function stockLabel(product, inCart) {
  const left = Math.max(0, product.stock - inCart);
  if (product.stock <= 0) return { text: 'Out of stock', tone: 'out' };
  if (left <= 0) return { text: 'All in cart', tone: 'out' };
  if (product.status === 'Critical' || product.status === 'Low Stock') return { text: `Only ${left} left`, tone: 'low' };
  return { text: `${left} in stock`, tone: 'ok' };
}

export default function ProductCard({ product, inCart = 0, onAddToCart, onShowOptions }) {
  const pressTimer = useRef(null);
  const defaultOpt = product.options[0];
  const visual = resolveProductVisual(product);
  const stock = stockLabel(product, inCart);
  const unavailable = stock.tone === 'out';

  return (
    <button
      type="button"
      className={`prod-card${unavailable ? ' prod-card-disabled' : ''}`}
      disabled={unavailable}
      title={unavailable ? stock.text : `Add ${product.name}`}
      onClick={() => {
        if (!unavailable) onAddToCart(product);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!unavailable) onShowOptions(event.pageX, event.pageY, product);
      }}
      onTouchStart={(event) => {
        if (unavailable) return;
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
        <div className={`prod-stock prod-stock-${stock.tone}`}>{stock.text}</div>
      </div>
    </button>
  );
}
