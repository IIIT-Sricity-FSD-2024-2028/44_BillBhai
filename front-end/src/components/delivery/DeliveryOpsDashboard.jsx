// React port of renderDeliveryOpsDashboard() (+ initDeliveryCharts) in dashboard.js.
// Rendered by DashboardPage for the deliveryops role.
import { useNavigate } from 'react-router-dom';
import PageHeader from '../common/PageHeader.jsx';
import StatCard from '../common/StatCard.jsx';
import DataTable from '../common/DataTable.jsx';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { getDeliveryView } from '../../lib/dashboard/helpers.js';
import { ActiveDeliveriesCard, DELIVERY_ICONS } from './DeliveryStats.jsx';
import DeliveryCharts from './DeliveryCharts.jsx';
import DeliveryRow from './DeliveryRow.jsx';
import useDeliveryActions from './useDeliveryActions.js';
import { getDeliveryCounts } from './deliveryView.js';

const COLUMNS = ['Delivery', 'Order', 'Customer', 'Address', 'Partner Info', 'ETA', 'Status', 'Updated', 'External', 'Actions'];
const QUEUE_HEADER_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' };

export default function DeliveryOpsDashboard() {
  const navigate = useNavigate();
  const { deliveries, orders, scopedBusinessName, hasActionAccess } = useDashboard();
  const { assignDeliveryPartner, editDelivery } = useDeliveryActions();
  const canManage = hasActionAccess('delivery');

  const view = getDeliveryView({ deliveries, orders });
  const counts = getDeliveryCounts(view);
  const etaOf = (d) => (d.etaMin === null ? Number.POSITIVE_INFINITY : d.etaMin);
  const activeRows = view
    .filter((d) => d.status === 'Pending' || d.status === 'In Transit')
    .sort((a, b) => etaOf(a) - etaOf(b));
  const avgEtaRows = activeRows.filter((d) => d.etaMin !== null);
  const avgEta = avgEtaRows.length
    ? Math.round(avgEtaRows.reduce((sum, d) => sum + Number(d.etaMin || 0), 0) / avgEtaRows.length)
    : null;
  const etaLabel = avgEta === null ? '—' : `${avgEta} min`;

  return (
    <>
      <PageHeader
        title={`Delivery Dashboard${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={(
          <>
            <button className="btn btn-primary" onClick={() => navigate('/delivery')}>Open Delivery</button>
            <button className="btn btn-outline" onClick={() => window.print()}>Print</button>
          </>
        )}
      />

      <section className="stats-grid">
        <ActiveDeliveriesCard counts={counts} />
        <StatCard icon={DELIVERY_ICONS.check} label="Delivered" value={counts.delivered} color="green" />
        <StatCard icon={DELIVERY_ICONS.alert} label="Failed" value={counts.failed} color="red" />
        <StatCard icon={DELIVERY_ICONS.clock} label="Avg ETA (Active)" value={etaLabel} color="amber" />
      </section>

      <DeliveryCharts deliveries={deliveries} partnerTitle="Partner Load (Active)" />

      <section className="card">
        <div className="card-hd" style={QUEUE_HEADER_STYLE}>
          <h3>Active Queue</h3>
          <div className="text-sm text-muted">{`Unassigned ${counts.unassigned}`}</div>
        </div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={activeRows}
            emptyMessage="No active deliveries."
            renderRow={(d, i) => (
              <DeliveryRow key={`${d.id}-${i}`} d={d} canManage={canManage} onAssign={assignDeliveryPartner} onEdit={editDelivery} />
            )}
          />
        </div>
      </section>
    </>
  );
}
