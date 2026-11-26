import { useEffect, useMemo } from 'react';
import useViewState from '../../../shared/hooks/useViewState.js';
import { useDispatch, useSelector } from 'react-redux';
import DataTable from '../../../shared/components/common/DataTable.jsx';
import FilterToolbar from '../../../shared/components/common/FilterToolbar.jsx';
import {
  fetchMovementsThunk,
  selectMovements,
  selectMovementsStatus,
} from '../inventorySlice.js';
import { extractErrorMessage } from '../../../store/thunkUtils.js';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { MOVEMENT_LABELS, dateTime } from './inventoryUtils.js';

const TYPE_OPTIONS = [{ value: 'all', label: 'All types' }, ...Object.entries(MOVEMENT_LABELS).map(([value, label]) => ({ value, label }))];

/** Every stock change in the business: sales, returns, deliveries received, adjustments. */
export default function MovementsPanel({ inventory, canManage = true, scopeQuery }) {
  const dispatch = useDispatch();
  const { lastSyncedAt } = useDashboard();
  const rows = useSelector(selectMovements);
  const status = useSelector(selectMovementsStatus);
  const [type, setType] = useViewState('all');
  const [search, setSearch] = useViewState('');
  const [error, setError] = useViewState('');

  useEffect(() => {
    if (!canManage) return undefined;
    let active = true;
    dispatch(
      fetchMovementsThunk({
        ...scopeQuery,
        type: type === 'all' ? undefined : type,
        limit: 300,
      }),
    )
      .unwrap()
      .then(() => {
        if (active) setError('');
      })
      .catch((err) => {
        if (active) setError(extractErrorMessage(err, 'Could not load stock movements.'));
      });
    return () => {
      active = false;
    };
  }, [dispatch, canManage, scopeQuery, type, lastSyncedAt, setError]);

  const nameOf = useMemo(() => new Map(inventory.map((i) => [i.productId, i.name])), [inventory]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((m) => {
      if (!q) return true;
      return `${m.productId} ${nameOf.get(m.productId) || ''} ${m.reason} ${m.by} ${m.refId || ''}`.toLowerCase().includes(q);
    });
  }, [rows, search, nameOf]);

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
        {!canManage && <p className="text-muted">Stock movement logs require manager access.</p>}
        {canManage && error && <div className="form-error" style={{ display: 'block' }}>{error}</div>}
        {canManage && !error && status === 'loading' ? (
          <p className="text-muted">Loading…</p>
        ) : canManage ? (
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
        ) : null}
      </div>
    </section>
  );
}
