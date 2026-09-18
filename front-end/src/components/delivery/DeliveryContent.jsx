// React port of renderDelivery() (+ initDeliveryCharts) in dashboard.js.
// The Starter-plan paywall is rendered by DashboardLayout.
import { useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import StatCard from '../common/StatCard.jsx';
import DataTable from '../common/DataTable.jsx';
import { FilterSelect } from '../common/FilterToolbar.jsx';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { getDeliveryView, parseOrderDate } from '../../lib/dashboard/helpers.js';
import { ActiveDeliveriesCard, DELIVERY_ICONS } from './DeliveryStats.jsx';
import DeliveryCharts from './DeliveryCharts.jsx';
import DeliveryRow from './DeliveryRow.jsx';
import useDeliveryActions from './useDeliveryActions.js';
import { getDeliveryCounts } from './deliveryView.js';

const COLUMNS = ['Delivery', 'Order', 'Customer', 'Address', 'Partner', 'ETA', 'Status', 'Updated', 'External', 'Actions'];
const QUEUE_HEADER_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' };
const QUEUE_CONTROLS_STYLE = { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' };

const FILTER_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'intransit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'all', label: 'All' },
];

const SORT_OPTIONS = [
  { value: 'updated_new', label: 'Updated newest' },
  { value: 'updated_old', label: 'Updated oldest' },
  { value: 'eta_low', label: 'ETA low-high' },
  { value: 'eta_high', label: 'ETA high-low' },
  { value: 'partner', label: 'Partner A-Z' },
];

function matchesFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'active') return item.status === 'Pending' || item.status === 'In Transit';
  if (filter === 'pending') return item.status === 'Pending';
  if (filter === 'intransit') return item.status === 'In Transit';
  if (filter === 'delivered') return item.status === 'Delivered';
  if (filter === 'failed') return item.status === 'Failed';
  return true;
}

function compareBy(sortKey) {
  return (a, b) => {
    const updatedA = parseOrderDate(a.updatedAt)?.getTime() || 0;
    const updatedB = parseOrderDate(b.updatedAt)?.getTime() || 0;
    const etaA = a.etaMin === null ? Number.MAX_SAFE_INTEGER : Math.max(0, Number(a.etaMin || 0));
    const etaB = b.etaMin === null ? Number.MAX_SAFE_INTEGER : Math.max(0, Number(b.etaMin || 0));
    if (sortKey === 'updated_old') return updatedA - updatedB;
    if (sortKey === 'eta_low') return etaA - etaB;
    if (sortKey === 'eta_high') return etaB - etaA;
    if (sortKey === 'partner') return String(a.partner || '').localeCompare(String(b.partner || ''));
    return updatedB - updatedA;
  };
}

export default function DeliveryContent() {
  const { deliveries, orders, hasActionAccess } = useDashboard();
  const { assignDeliveryPartner, editDelivery } = useDeliveryActions();
  const [filter, setFilter] = useState('active');
  const [sortKey, setSortKey] = useState('updated_new');
  const canManage = hasActionAccess('delivery');

  const view = getDeliveryView({ deliveries, orders });
  const counts = getDeliveryCounts(view);
  const rows = view.filter((d) => matchesFilter(d, filter)).sort(compareBy(sortKey));

  return (
    <>
      <PageHeader title="Delivery" actions={<button className="btn btn-outline" onClick={() => window.print()}>Print</button>} />

      <section className="stats-grid">
        <ActiveDeliveriesCard counts={counts} />
        <StatCard icon={DELIVERY_ICONS.check} label="Delivered" value={counts.delivered} color="green" />
        <StatCard icon={DELIVERY_ICONS.clock} label="Unassigned" value={counts.unassigned} color="amber" />
        <StatCard icon={DELIVERY_ICONS.alert} label="Failed" value={counts.failed} color="red" />
      </section>

      <DeliveryCharts deliveries={deliveries} partnerTitle="Partner Load" />

      <section className="card">
        <div className="card-hd" style={QUEUE_HEADER_STYLE}>
          <h3>Delivery Queue</h3>
          <div style={QUEUE_CONTROLS_STYLE}>
            <div className="chart-tabs" id="deliveryFilters">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  className={`chart-tab${filter === tab.value ? ' active' : ''}`}
                  type="button"
                  data-filter={tab.value}
                  onClick={() => setFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <FilterSelect id="deliverySortSelect" value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
          </div>
        </div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={rows}
            tbodyId="deliveryTableBody"
            emptyMessage="No deliveries found."
            renderRow={(d, i) => (
              <DeliveryRow key={`${d.id}-${i}`} d={d} canManage={canManage} onAssign={assignDeliveryPartner} onEdit={editDelivery} />
            )}
          />
        </div>
      </section>
    </>
  );
}
