import { useEffect, useState } from 'react';
import { loadMySalesToday } from '../../lib/cashier/dataStore.js';
import { formatRupees } from '../../lib/cashier/posHelpers.js';

/**
 * The cashier's own bills since midnight: totals by payment method, the cash
 * that should be in the drawer, and a reprint button for each bill.
 */
export default function MySalesModal({ open, userId, onClose, onReprint }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    loadMySalesToday(userId)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load today’s sales.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const standing = rows.filter((o) => o.status !== 'Cancelled');
  const byMethod = {};
  standing.forEach((o) => {
    byMethod[o.paymentMethod] = (byMethod[o.paymentMethod] || 0) + o.total;
  });
  const refunds = standing.reduce((s, o) => s + (o.refundedAmount || 0), 0);
  const net = standing.reduce((s, o) => s + o.total, 0) - refunds;
  const cashInDrawer = standing
    .filter((o) => o.paymentMethod === 'Cash')
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="sales-modal-backdrop" onClick={onClose}>
      <div
        className="sales-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mySalesTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="mySalesTitle" style={{ margin: 0 }}>
            My sales today
          </h3>
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
        {loading && <p className="text-muted">Loading…</p>}
        {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
        {!loading && !error && (
          <>
            <div className="sales-tiles">
              <div>
                <span className="text-muted">Bills</span>
                <strong>{standing.length}</strong>
              </div>
              <div>
                <span className="text-muted">Net sales</span>
                <strong>{formatRupees(net)}</strong>
              </div>
              <div>
                <span className="text-muted">Cash in drawer</span>
                <strong>{formatRupees(cashInDrawer)}</strong>
              </div>
              {Object.entries(byMethod).map(([method, amount]) => (
                <div key={method}>
                  <span className="text-muted">{method}</span>
                  <strong>{formatRupees(amount)}</strong>
                </div>
              ))}
            </div>
            {rows.length === 0 ? (
              <p className="text-muted">No bills yet today.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bill</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.id}</strong>
                          <div className="text-muted sales-sub">
                            {new Date(o.orderDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            {o.customerName}
                            {' · '}
                            {o.itemsCount} {o.itemsCount === 1 ? 'item' : 'items'}
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {formatRupees(o.total)}
                          <div className="text-muted sales-sub">
                            {o.paymentMethod}
                            {o.paymentStatus === 'Pending' ? ' (due)' : ''}
                          </div>
                        </td>
                        <td>{o.status}</td>
                        <td>
                          <button className="btn btn-outline" style={{ padding: '2px 8px' }} onClick={() => onReprint(o)}>
                            Reprint
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
