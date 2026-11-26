import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDeliveriesThunk,
  transitionDeliveryThunk,
  selectAllDeliveries,
  selectDeliveriesUi,
  setDeliveryFilter,
  setDeliveryDetailId,
  bumpDeliveryTick,
} from '../deliveriesSlice.js';
import PageHeader from '../../../shared/components/common/PageHeader.jsx';
import DataTable from '../../../shared/components/common/DataTable.jsx';
import FilterToolbar from '../../../shared/components/common/FilterToolbar.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { mapDeliveryRow } from '../../../shared/lib/dashboard/api.js';
import { scopedCompanyId } from '../../orders/components/orderFormat.js';
import { DeliveryStatCards } from './DeliveryStats.jsx';
import DeliveryCharts from './DeliveryCharts.jsx';
import DeliveryRow from './DeliveryRow.jsx';
import DeliveryDetailModal from './DeliveryDetailModal.jsx';
import useDeliveryActions from './useDeliveryActions.jsx';
import {
  STATUS_GROUPS,
  codOutstanding,
  codSummary,
  dueAt,
  getDeliveryCounts,
  inGroup,
  isOverdue,
  money,
  when,
} from './deliveryView.js';

const COLUMNS = ['Delivery', 'Customer', 'Items', 'Money', 'Partner', 'Status', 'Next step'];

const SORT_OPTIONS = [
  { value: 'attention', label: 'Needs attention first' },
  { value: 'updated_new', label: 'Updated newest' },
  { value: 'updated_old', label: 'Updated oldest' },
  { value: 'due', label: 'Due soonest' },
  { value: 'cod_high', label: 'COD high-low' },
  { value: 'partner', label: 'Partner A-Z' },
];

const RANK = { 'Failed Attempt': 0, Pending: 1, 'Out for Delivery': 2, Dispatched: 3, Assigned: 4 };

function sorter(key) {
  const t = (d) => new Date(d.lastChangeAt || 0).getTime();
  return (a, b) => {
    if (key === 'updated_old') return t(a) - t(b);
    if (key === 'updated_new') return t(b) - t(a);
    if (key === 'due') return (dueAt(a) ?? Infinity) - (dueAt(b) ?? Infinity);
    if (key === 'cod_high') return codOutstanding(b) - codOutstanding(a);
    if (key === 'partner') return String(a.partner || '~').localeCompare(String(b.partner || '~'));
    const late = Number(isOverdue(b)) - Number(isOverdue(a));
    if (late) return late;
    const rank = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
    return rank || t(a) - t(b);
  };
}

export default function DeliveryContent() {
  const reduxDeliveries = useSelector(selectAllDeliveries);
  const { group, query, partner, onlyCod, onlyLate, sort, detailId } = useSelector(selectDeliveriesUi);
  const { deliveries: dashDeliveries, orders, hasActionAccess, scopedBusinessName, syncError, lastSyncedAt, state } = useDashboard();
  const companyId = scopedCompanyId(state);
  const deliveries = useMemo(
    () => (reduxDeliveries.length ? reduxDeliveries.map(mapDeliveryRow) : dashDeliveries),
    [reduxDeliveries, dashDeliveries],
  );
  const canManage = hasActionAccess('delivery');
  const dispatch = useDispatch();
  const actions = useDeliveryActions();

  // Fetch deliveries into Redux store on mount and every background sync
  useEffect(() => {
    dispatch(fetchDeliveriesThunk({ companyId }));
  }, [dispatch, companyId, lastSyncedAt]);

  // Re-evaluate "running late" every minute even without new data.
  useEffect(() => {
    const t = setInterval(() => dispatch(bumpDeliveryTick()), 60000);
    return () => clearInterval(t);
  }, [dispatch]);

  const counts = getDeliveryCounts(deliveries);
  const partners = Array.from(new Set(deliveries.map((d) => d.partner).filter(Boolean))).sort();
  const q = query.trim().toLowerCase();
  const rows = deliveries
    .filter((d) => (group === 'open' ? !['Delivered', 'Returned to Store', 'Cancelled'].includes(d.status) : inGroup(d, group)))
    .filter((d) => partner === 'all' || (partner === '__none__' ? !d.partner : d.partner === partner))
    .filter((d) => !onlyCod || codOutstanding(d) > 0)
    .filter((d) => !onlyLate || isOverdue(d))
    .filter(
      (d) =>
        !q ||
        `${d.id} ${d.orderId} ${d.customer} ${d.customerPhone} ${d.address} ${d.partner} ${d.partnerPhone}`
          .toLowerCase()
          .includes(q),
    )
    .sort(sorter(sort));

  const withDelivery = new Set(deliveries.map((d) => d.orderId));
  const orphans = orders.filter((o) => o.orderType === 'delivery' && o.status !== 'Cancelled' && !withDelivery.has(o.id));
  const cod = codSummary(deliveries);
  const detail = detailId ? deliveries.find((d) => d.id === detailId) || null : null;

  const tabs = [{ key: 'open', label: 'Open', count: counts.open }, ...STATUS_GROUPS.map((g) => ({
    ...g,
    count: g.statuses ? deliveries.filter((d) => g.statuses.includes(d.status)).length : deliveries.length,
  }))];

  const runAction = (kind, d) => {
    dispatch(setDeliveryDetailId(null));
    actions.start(kind === 'retry' ? 'retry' : kind, d);
  };

  return (
    <>
      <PageHeader
        title="Delivery"
        actions={
          <button className="btn btn-outline" onClick={() => window.print()}>
            Print
          </button>
        }
      />
      {syncError && (
        <div className="card" style={{ marginBottom: '14px', borderColor: 'var(--red)' }}>
          <div className="card-bd text-sm" style={{ color: 'var(--red)' }}>{syncError}</div>
        </div>
      )}
      <DeliveryStatCards counts={counts} money={money} />

      {orphans.length > 0 && (
        <section className="card" style={{ borderColor: 'var(--amber)' }}>
          <div className="card-hd">
            <h3>Delivery orders with no delivery ({orphans.length})</h3>
            <span className="text-sm text-muted">These were sold for delivery but nobody is taking them out yet.</span>
          </div>
          <div className="card-bd">
            <DataTable
              columns={[
                { header: 'Order', key: 'id', cellClassName: 'cell-main' },
                { header: 'Customer', render: (o) => (<>{o.customer}<div className="text-sm text-muted">{o.customerPhone}</div></>) },
                { header: 'Address', key: 'address' },
                { header: 'Total', render: (o) => `${money(o.total)} · ${o.payment}` },
                { header: 'Sold', render: (o) => when(o.orderDate) },
                {
                  header: '',
                  render: (o) =>
                    canManage ? (
                      <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => actions.startCreate(o)}>
                        Create delivery
                      </button>
                    ) : null,
                },
              ]}
              rows={orphans}
              getRowKey={(o) => o.id}
            />
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-hd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <h3>Delivery queue</h3>
          <div className="chart-tabs" style={{ flexWrap: 'wrap' }}>
            {tabs.map((t) => (
              <button key={t.key} type="button" className={group === t.key ? 'chart-tab active' : 'chart-tab'} onClick={() => dispatch(setDeliveryFilter({ key: 'group', value: t.key }))}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
        <FilterToolbar
          filters={[
            {
              id: 'deliveryPartnerFilter',
              label: 'Partner',
              value: partner,
              onChange: (value) => dispatch(setDeliveryFilter({ key: 'partner', value })),
              options: [{ value: 'all', label: 'All partners' }, { value: '__none__', label: 'Not assigned' }, ...partners],
            },
            { id: 'deliverySortSelect', label: 'Sort by', value: sort, onChange: (value) => dispatch(setDeliveryFilter({ key: 'sort', value })), options: SORT_OPTIONS },
          ]}
        >
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="deliverySearch">
              Search
            </label>
            <input
              id="deliverySearch"
              type="search"
              className="toolbar-select"
              placeholder="Order, customer, phone, address"
              value={query}
              onChange={(e) => dispatch(setDeliveryFilter({ key: 'query', value: e.target.value }))}
            />
          </div>
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="deliveryOnlyCod">
              <input id="deliveryOnlyCod" type="checkbox" checked={onlyCod} onChange={(e) => dispatch(setDeliveryFilter({ key: 'onlyCod', value: e.target.checked }))} /> COD to collect
            </label>
            <label className="toolbar-label" htmlFor="deliveryOnlyLate">
              <input id="deliveryOnlyLate" type="checkbox" checked={onlyLate} onChange={(e) => dispatch(setDeliveryFilter({ key: 'onlyLate', value: e.target.checked }))} /> Running late ({counts.overdue})
            </label>
          </div>
        </FilterToolbar>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={rows}
            pageSize={15}
            emptyMessage="No deliveries match these filters."
            emptyColSpan={COLUMNS.length}
            renderRow={(d) => <DeliveryRow key={d.id} d={d} canManage={canManage} onAction={runAction} onOpen={(x) => dispatch(setDeliveryDetailId(x.id))} />}
          />
        </div>
      </section>

      <DeliveryCharts deliveries={deliveries} />

      <section className="card">
        <div className="card-hd">
          <h3>Cash on delivery by partner</h3>
          <span className="text-sm text-muted">Settle with each partner at the end of the day.</span>
        </div>
        <div className="card-bd">
          <DataTable
            columns={[
              { header: 'Partner', key: 'partner', cellClassName: 'cell-main' },
              { header: 'Delivered today', key: 'deliveredToday' },
              { header: 'Cash collected today', render: (r) => money(r.cashToday) },
              { header: 'With riders', render: (r) => (r.codOut ? <strong>{money(r.codOut)}</strong> : money(0)) },
              { header: 'Open COD parcels', key: 'codOutCount' },
            ]}
            rows={cod}
            getRowKey={(r) => r.partner}
            emptyMessage="No COD deliveries today."
          />
        </div>
      </section>

      <DeliveryDetailModal
        delivery={detail}
        businessName={scopedBusinessName}
        canManage={canManage}
        onAction={runAction}
        onClose={() => dispatch(setDeliveryDetailId(null))}
      />
      {actions.modal}
    </>
  );
}
