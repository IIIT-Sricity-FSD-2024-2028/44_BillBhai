import { useEffect, useState } from 'react';
import DataTable from '../common/DataTable.jsx';
import FilterToolbar from '../common/FilterToolbar.jsx';
import { api } from '../../lib/http.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { MOVEMENT_LABELS, dateTime } from './inventoryUtils.js';

const TYPE_OPTIONS = [{ value: 'all', label: 'All types' }, ...Object.entries(MOVEMENT_LABELS).map(([value, label]) => ({ value, label }))];

/** Every stock change in the business: sales, returns, deliveries received, adjustments. */
export default function MovementsPanel({ inventory }) {
  const { lastSyncedAt } = useDashboard();
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api('/inventory/movements', { query: { type: type === 'all' ? undefined : type, limit: 300 } })
      .then((data) => {
        if (alive) {
          setRows(Array.isArray(data) ? data : []);
          setError('');
        }
      })
      .catch((err) => alive && setError(err.message || 'Could not load stock movements.'));
    return () => {
      alive = false;
    };
  }, [type, lastSyncedAt]);

  const nameOf = new Map(inventory.map((i) => [i.productId, i.name]));
  const q = search.trim().toLowerCase();
  const visible = (rows || []).filter((m) => {
    if (!q) return true;
    return `${m.productId} ${nameOf.get(m.productId) || ''} ${m.reason} ${m.by} ${m.refId || ''}`.toLowerCase().includes(q);
  });

  return (
    <section className="card">
      <div className="card-hd">
        <h3>Stock movements</h3>
        <span className="text-sm text-muted">Latest 300 changes. Every change to a stock count is listed here with its reason.</span>
      </div>
      <FilterToolbar filters={[{ id: 'movementTypeFilter', label: 'Type', value: type, onChange: setType, options: TYPE_OPTIONS }]}>
        <div className="toolbar-group">
          <label className="toolbar-label" htmlFor="movementSearch">
            Search
          </label>
          <input id="movementSearch" type="search" className="toolbar-select" placeholder="Product, order, person" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </FilterToolbar>
      <div className="card-bd">
        {error && <div className="form-error" style={{ display: 'block' }}>{error}</div>}
        {!error && rows === null ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <div>
            <DataTable
              columns={[
                { header: 'When', render: (m) => dateTime(m.at) },
                { header: 'Product', render: (m) => (<>{nameOf.get(m.productId) || m.productId}<div className="text-sm text-muted">{m.productId}</div></>) },
                { header: 'Type', render: (m) => MOVEMENT_LABELS[m.type] || m.type },
                {
                  header: 'Change',
                  render: (m) => (
                    <strong style={{ color: m.quantity < 0 ? 'var(--red)' : 'var(--green)' }}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</strong>
                  ),
                },
                { header: 'Balance', key: 'balanceAfter' },
                { header: 'Reason', key: 'reason' },
                { header: 'By', key: 'by' },
              ]}
              rows={visible}
              pageSize={25}
              getRowKey={(m) => m.id}
              emptyMessage="No stock movements match."
            />
          </div>
        )}
      </div>
    </section>
  );
}
