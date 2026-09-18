// React port of dashboard.html + renderDashboard() / initDashboardCharts() in dashboard.js.
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import StatCard from '../components/common/StatCard.jsx';
import DataTable from '../components/common/DataTable.jsx';
import Badge from '../components/common/Badge.jsx';
import ChartCanvas, { getColors } from '../components/common/ChartCanvas.jsx';
import InventoryManagerDashboard from '../components/inventory/InventoryManagerDashboard.jsx';
import DeliveryOpsDashboard from '../components/delivery/DeliveryOpsDashboard.jsx';
import ReturnHandlerDashboard from '../components/returns/ReturnHandlerDashboard.jsx';
import { useDashboard } from '../lib/dashboard/hooks.js';
import { buildRevenueTrendDays, getDashboardStatusMetrics, getInventoryMetrics } from '../lib/dashboard/helpers.js';

const ICONS = {
  revenue: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  orders: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /></svg>,
  returns: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  alerts: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>,
};

const CHART_BODY_STYLE = { position: 'relative', height: '240px' };

function AdminDashboard() {
  const { orders, returns, inventory, scopedBusinessName } = useDashboard();
  const inventoryMetrics = getInventoryMetrics(inventory);
  const totalSales = orders.reduce((a, o) => a + o.total, 0);

  // initDashboardCharts(): evaluated when the canvases mount.
  const salesData = () => {
    const c = getColors();
    const trend = buildRevenueTrendDays(orders, 7);
    return {
      labels: trend.labels,
      datasets: [{
        label: 'Revenue',
        data: trend.values,
        borderColor: c.red,
        backgroundColor: 'rgba(220,53,69,0.1)',
        tension: 0.4,
        fill: true,
      }],
    };
  };
  const statusData = () => {
    const c = getColors();
    const m = getDashboardStatusMetrics({ orders, returns, inventory });
    return {
      labels: ['Delivered Orders', 'Open Orders', 'Returns', 'Inventory Alerts'],
      datasets: [{
        data: [m.deliveredOrders, m.openOrders, m.totalReturns, m.alertCount],
        backgroundColor: [c.green, c.blue, c.red, c.amber],
        borderWidth: 0,
      }],
    };
  };
  const statusOptions = () => ({ plugins: { legend: { position: 'right', labels: { color: getColors().text } } } });

  return (
    <>
      <PageHeader
        title={`Dashboard${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={<button className="btn btn-outline" onClick={() => window.print()}>Print</button>}
      />
      <section className="stats-grid">
        <StatCard icon={ICONS.revenue} label="Revenue" value={`₹${totalSales.toLocaleString()}`} color="green" />
        <StatCard icon={ICONS.orders} label="Orders" value={orders.length} color="blue" />
        <StatCard icon={ICONS.returns} label="Returns" value={returns.length} color="red" />
        <StatCard icon={ICONS.alerts} label="Alerts" value={inventoryMetrics.alerts} color="amber" />
      </section>
      <section className="grid-2">
        <div className="card"><div className="card-hd"><h3>Sales Trend</h3></div><div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="dashSalesChart" type="line" data={salesData} /></div></div>
        <div className="card"><div className="card-hd"><h3>Order Status</h3></div><div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="dashStatusChart" type="doughnut" data={statusData} options={statusOptions} /></div></div>
      </section>
      <section className="card"><div className="card-hd"><h3>Recent Orders</h3></div><div className="card-bd">
        <DataTable
          columns={[
            { header: 'ID', key: 'id', cellClassName: 'cell-main' },
            { header: 'Customer', key: 'customer' },
            { header: 'Total', render: (o) => `₹${o.total}` },
            { header: 'Payment', render: (o) => <Badge status={o.payment} type={o.payment.toLowerCase()} /> },
            { header: 'Status', render: (o) => <Badge status={o.status} /> },
          ]}
          rows={orders.slice(0, 5)}
          getRowKey={(o, i) => `${o.id}-${i}`}
        />
      </div></section>
    </>
  );
}

function DashboardContent() {
  const { roleKey } = useDashboard();
  if (roleKey === 'deliveryops') return <DeliveryOpsDashboard />;
  if (roleKey === 'returnhandler') return <ReturnHandlerDashboard />;
  if (roleKey === 'inventorymanager') return <InventoryManagerDashboard />;
  return <AdminDashboard />;
}

export default function DashboardPage() {
  return (
    <DashboardLayout page="dashboard">
      <DashboardContent />
    </DashboardLayout>
  );
}
