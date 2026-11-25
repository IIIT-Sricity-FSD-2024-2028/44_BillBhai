import { useEffect, useState } from 'react';
import { formatRupees } from '../lib/posHelpers.js';

/** One cart line: +/- buttons, a typed quantity (capped at stock) and remove. */
export default function CartItem({ item, onUpdateQty, onSetQty, onRemove }) {
  const [draft, setDraft] = useState(String(item.qty));
  useEffect(() => setDraft(String(item.qty)), [item.qty]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isInteger(n) || n < 1) {
      setDraft(String(item.qty));
      return;
    }
    onSetQty(item.cartId, n);
  };

  const atLimit = item.qty >= item.stock;
  return (
    <div className="cart-item">
      <div className="c-info">
        <div className="c-name">{item.name}</div>
        <div className="c-price">
          {formatRupees(item.price * item.qty)}
          {(item.qty > 1 || atLimit) && (
            <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: '6px' }}>
              {item.qty > 1 ? `${item.qty} × ${formatRupees(item.price)}` : ''}
              {item.qty > 1 && atLimit ? ' · ' : ''}
              {atLimit ? `max ${item.stock}` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="c-actions">
        <button className="qty-btn dec" aria-label={`One less ${item.name}`} onClick={() => onUpdateQty(item.cartId, -1)}>
          -
        </button>
        <input
          className="qty-input"
          aria-label={`Quantity of ${item.name}`}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <button
          className="qty-btn inc"
          aria-label={`One more ${item.name}`}
          disabled={atLimit}
          title={atLimit ? `Only ${item.stock} in stock` : undefined}
          onClick={() => onUpdateQty(item.cartId, 1)}
        >
          +
        </button>
        <button className="qty-btn remove" aria-label={`Remove ${item.name}`} title="Remove" onClick={() => onRemove(item.cartId)}>
          ×
        </button>
      </div>
    </div>
  );
}
