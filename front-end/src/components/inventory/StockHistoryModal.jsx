import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import DataTable from '../common/DataTable.jsx';
import { api } from '../../lib/http.js';
import { MOVEMENT_LABELS, dateTime } from './inventoryUtils.js';

/** Stock ledger and change history (price, supplier, …) of one product. */
export default function StockHistoryModal({ item, onClose }) {
  const [tab, setTab] = useState('stock');
  const [moves, setMoves] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!item) return undefined;
    let alive = true;
    setTab('stock');
    setMoves(null);
    setActivity(null);
    setError('');
    Promise.all([
      api('/inventory/movements', { query: { productId: item.productId, limit: 100 } }),
      api('/activity', { query: { entity: 'product', entityId: item.productId, limit: 50 } }).catch(() => []),
    ])
      .then(([m, a]) => {
        if (!alive) return;
        setMoves(Array.isArray(m) ? m : []);
        setActivity(Array.isArray(a) ? a : []);
      })
      .catch((err) => alive && setError(err.message || 'Could not load the history.'));
    return () => {
      alive = false;
    };
  }, [item]);

  return (
    <Modal open={Boolean(item)} id="stockHistoryModal" title={item ? `History — ${item.name} (${item.productId})` : ''} onClose={onClose} maxWidth="860px">
      <div className="modal-body">
        <div className="chart-tabs" style={{ marginBottom: '12px' }}>
          <button type="button" className={tab === 'stock' ? 'chart-tab active' : 'chart-tab'} onClick={() => setTab('stock')}>
            Stock movements
          </button>
          <button type="button" className={tab === 'changes' ? 'chart-tab active' : 'chart-tab'} onClick={() => setTab('changes')}>
            Product changes
          </button>
        </div>
        {error && <div className="form-error" style={{ display: 'block' }}>{error}</div>}
        {!error && moves === null && <p className="text-muted">Loading…</p>}
        {tab === 'stock' && moves && (
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <DataTable
              columns={[
                { header: 'When', render: (m) => dateTime(m.at) },
                { header: 'Type', render: (m) => MOVEMENT_LABELS[m.type] || m.type },
                {
                  header: 'Change',
                  render: (m) => (
                    <strong style={{ color: m.quantity < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </strong>
                  ),
                },
                { header: 'Balance', key: 'balanceAfter' },
                { header: 'Reason', key: 'reason' },
                { header: 'By', key: 'by' },
              ]}
              rows={moves}
              getRowKey={(m) => m.id}
              emptyMessage="No stock movements yet."
            />
          </div>
        )}
        {tab === 'changes' && activity && (
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <DataTable
              columns={[
                { header: 'When', render: (a) => dateTime(a.at) },
                { header: 'What changed', key: 'summary' },
                { header: 'By', key: 'by' },
              ]}
              rows={activity}
              getRowKey={(a) => a.id}
              emptyMessage="No recorded changes to this product."
            />
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
