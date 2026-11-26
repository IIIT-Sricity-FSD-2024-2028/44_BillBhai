import { useEffect, useMemo } from 'react';
import useViewState from '../../../shared/hooks/useViewState.js';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchInventoryThunk,
  fetchMovementsThunk,
  selectActiveCatalog,
  selectInventoryStatus,
  selectInventoryValuation,
  selectMovements,
} from '../inventorySlice.js';
import {
  fetchSuppliersThunk,
  selectSortedSuppliers,
} from '../suppliersSlice.js';
import PageHeader from '../../../shared/components/common/PageHeader.jsx';
import StatCard from '../../../shared/components/common/StatCard.jsx';
import DataTable from '../../../shared/components/common/DataTable.jsx';
import Badge from '../../../shared/components/common/Badge.jsx';
import ChartCanvas from '../../../shared/components/common/ChartCanvas.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { getInventoryMetrics } from '../../../shared/lib/dashboard/helpers.js';
import StockActionModal from './StockActionModal.jsx';
import { SMALL_BTN, isBelowReorder, money, suggestedOrderQty } from './inventoryUtils.js';
import {
  buildMovementTypeData,
  buildStockHealthData,
  buildStockLevelsData,
  LEGEND_RIGHT_OPTIONS,
} from './inventoryChartData.js';

const svgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '18',
  height: '18',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
};

const ICONS = {
  skus: (
    <svg {...svgProps}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  units: (
    <svg {...svgProps}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  low: (
    <svg {...svgProps}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  ),
  out: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

const CHART_BODY_STYLE = { position: 'relative', height: '220px' };

/** Inventory manager's start page: what is running out, what stock is worth, what moved. */
export default function InventoryManagerDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { state: dashState, scopedBusinessName, hasActionAccess, refreshData } = useDashboard();
  const canManage = hasActionAccess('inventory');
  const [stockRequest, setStockRequest] = useViewState(null);
  const [notice, setNotice] = useViewState('');

  const active = useSelector(selectActiveCatalog);
  const effectiveSuppliers = useSelector(selectSortedSuppliers);
  const inventoryStatus = useSelector(selectInventoryStatus);
  const valuation = useSelector(selectInventoryValuation);
  const movements = useSelector(selectMovements);

  const scopeQuery = useMemo(() => {
    const bizId = String(dashState.activeBusinessId || '').trim();
    return dashState.roleKey === 'superuser' && bizId && bizId !== 'PLATFORM' ? { companyId: bizId } : undefined;
  }, [dashState.roleKey, dashState.activeBusinessId]);

  useEffect(() => {
    dispatch(fetchInventoryThunk(scopeQuery));
    if (canManage) {
      dispatch(fetchSuppliersThunk(scopeQuery));
      dispatch(fetchMovementsThunk({ ...scopeQuery, limit: 300 }));
    }
  }, [dispatch, canManage, scopeQuery]);

  const metrics = useMemo(() => getInventoryMetrics(active), [active]);
  const lowCritical = metrics.lowStock + metrics.critical;
  const needing = useMemo(() => active.filter(isBelowReorder), [active]);
  const reorderRows = useMemo(
    () =>
      needing
        .slice()
        .sort((a, b) => a.stock / Math.max(1, a.reorderLevel) - b.stock / Math.max(1, b.reorderLevel))
        .slice(0, 10),
    [needing],
  );
  const movementsByType = useMemo(
    () =>
      movements.reduce((acc, m) => {
        const key = m?.type || 'other';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    [movements],
  );
  const signature = active.map((i) => `${i.productId}:${i.stock}`).join('|');

  return (
    <>
      <PageHeader
        title={`Inventory Dashboard${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={
          <>
            <button className="btn btn-primary" onClick={() => navigate('/inventory')}>
              Open Inventory
            </button>
            <button className="btn btn-outline" onClick={() => window.print()}>
              Print
            </button>
          </>
        }
      />
      {notice && (
        <div className="card" style={{ marginBottom: '14px' }}>
          <div className="card-bd text-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{notice}</span>
            <button className="btn btn-outline" style={SMALL_BTN} onClick={() => setNotice('')}>
              OK
            </button>
          </div>
        </div>
      )}
      <section className="stats-grid">
        <StatCard icon={ICONS.skus} label="Products on sale" value={active.length} color="blue" />
        <StatCard
          icon={ICONS.units}
          label="Stock value (at cost)"
          value={inventoryStatus === 'succeeded' ? money(Math.round(valuation.costValue)) : '…'}
          color="green"
        >
          <span className="text-sm text-muted">
            {metrics.totalUnits.toLocaleString('en-IN')} units
            {inventoryStatus === 'succeeded' ? ` · ${money(Math.round(valuation.retailValue))} at selling price` : ''}
          </span>
        </StatCard>
        <StatCard icon={ICONS.low} label="Low + Critical" value={lowCritical} color="amber" />
        <StatCard icon={ICONS.out} label="Out of Stock" value={metrics.outOfStock} color="red" />
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-hd">
            <h3>Closest to running out</h3>
          </div>
          <div className="card-bd" style={CHART_BODY_STYLE}>
            <ChartCanvas key={signature} id="invMgrStockChart" type="bar" data={() => buildStockLevelsData(active)} />
          </div>
        </div>
        <div className="card">
          <div className="card-hd">
            <h3>Stock health</h3>
          </div>
          <div className="card-bd" style={CHART_BODY_STYLE}>
            <ChartCanvas
              key={signature}
              id="invMgrHealthChart"
              type="doughnut"
              data={() => buildStockHealthData(active)}
              options={LEGEND_RIGHT_OPTIONS}
            />
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-hd">
          <h3>Needs reordering ({needing.length})</h3>
        </div>
        <div className="card-bd">
          <DataTable
            columns={[
              {
                header: 'Product',
                render: (i) => (
                  <>
                    {i.name}
                    <div className="text-sm text-muted">
                      {i.productId} · {i.cat}
                    </div>
                  </>
                ),
              },
              { header: 'Stock', render: (i) => <strong>{i.stock}</strong> },
              { header: 'Reorder at', key: 'reorderLevel' },
              { header: 'Status', render: (i) => <Badge status={i.status} /> },
              { header: 'Supplier', render: (i) => i.supplier || '—' },
              { header: 'Order qty', render: (i) => suggestedOrderQty(i) },
              {
                header: '',
                render: (i) =>
                  canManage ? (
                    <>
                      <button
                        className="btn btn-primary"
                        style={SMALL_BTN}
                        onClick={() => setStockRequest({ kind: 'receive', item: i, quantity: suggestedOrderQty(i) })}
                      >
                        Receive
                      </button>
                      <button className="btn btn-outline" style={SMALL_BTN} onClick={() => setStockRequest({ kind: 'adjust', item: i })}>
                        Adjust
                      </button>
                    </>
                  ) : null,
              },
            ]}
            rows={reorderRows}
            getRowKey={(i) => i.productId}
            emptyMessage="Every product is above its reorder level."
          />
        </div>
      </section>
      {movements.length > 0 && (
        <section className="card">
          <div className="card-hd">
            <h3>Stock movements by type</h3>
          </div>
          <div className="card-bd" style={CHART_BODY_STYLE}>
            <ChartCanvas
              key={JSON.stringify(movementsByType)}
              id="invMgrMovesChart"
              type="bar"
              data={() => buildMovementTypeData(movementsByType)}
            />
          </div>
        </section>
      )}
      <StockActionModal
        request={stockRequest}
        suppliers={effectiveSuppliers}
        onClose={() => setStockRequest(null)}
        onSaved={(message) => {
          setStockRequest(null);
          setNotice(message);
          dispatch(fetchInventoryThunk(scopeQuery));
          if (canManage) dispatch(fetchMovementsThunk({ ...scopeQuery, limit: 300 }));
          refreshData();
        }}
      />
    </>
  );
}
