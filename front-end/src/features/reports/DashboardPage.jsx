import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectLowStockForDashboard, selectInventoryStatus } from '../inventory/inventorySlice.js';
import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import PageHeader from '../../shared/components/common/PageHeader.jsx';
import StatCard from '../../shared/components/common/StatCard.jsx';
import DataTable from '../../shared/components/common/DataTable.jsx';
import Badge from '../../shared/components/common/Badge.jsx';
import ChartCanvas, { getColors } from '../../shared/components/common/ChartCanvas.jsx';
import InventoryManagerDashboard from '../inventory/components/InventoryManagerDashboard.jsx';
import DeliveryOpsDashboard from '../deliveries/components/DeliveryOpsDashboard.jsx';
import ReturnHandlerDashboard from '../returns/components/ReturnHandlerDashboard.jsx';
import { useDashboard } from '../../shared/lib/dashboard/hooks.js';
import { fillDays, useReport } from './components/useSalesReport.js';
import { rangePreset, rupees, shortDay, statusColour, todayKey, currencySymbol, convertInrToActiveCurrency } from '../orders/components/orderFormat.js';

const svg = (children) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {children}
  </svg>
);
const ICONS = {
  revenue: svg(<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />),
  orders: svg(
    <>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
    </>,
  ),
  returns: svg(
    <>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>,
  ),
  alerts: svg(<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />),
  truck: svg(
    <>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>,
  ),
};

const CHART_BODY_STYLE = { position: 'relative', height: '240px' };
const SUB = { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' };
const OPEN_DELIVERY = ['Pending', 'Assigned', 'Dispatched', 'Out for Delivery', 'Failed Attempt'];
const OPEN_RETURN = ['Pending', 'Approved'];

function AdminDashboard() {
  const { orders, returns, deliveries, scopedBusinessName, syncError } = useDashboard();
  const [trendDays, setTrendDays] = useState(7);
  const today = useMemo(() => rangePreset('today'), []);
  const month = useMemo(() => rangePreset('30d'), []);
  const todayReport = useReport('/reports/sales', today);
  const monthReport = useReport('/reports/sales', month);

  const t = todayReport.data;
  const days = fillDays(monthReport.data && monthReport.data.byDay, month.from, month.to);
  const week = days.slice(-7);
  const weekNet = week.reduce((s, d) => s + d.net, 0);
  const weekOrders = week.reduce((s, d) => s + d.orders, 0);
  const trend = days.slice(-trendDays);

  const lowStock = useSelector(selectLowStockForDashboard);
  const inventoryStatus = useSelector(selectInventoryStatus);
  const openDeliveries = deliveries.filter((d) => OPEN_DELIVERY.includes(d.status));
  const unassigned = openDeliveries.filter((d) => d.status === 'Pending').length;
  const openReturns = returns.filter((r) => OPEN_RETURN.includes(r.status));
  const recent = [...orders].sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate))).slice(0, 6);

  const trendData = () => {
    const c = getColors();
    const sym = currencySymbol();
    return {
      labels: trend.map((d) => shortDay(d.day)),
      datasets: [
        {
          label: `Net sales (${sym})`,
          data: trend.map((d) => Math.round(convertInrToActiveCurrency(d.net))),
          borderColor: c.red,
          backgroundColor: 'rgba(220,53,69,0.1)',
          tension: 0.35,
          fill: true,
        },
        {
          label: `Refunds (${sym})`,
          data: trend.map((d) => Math.round(convertInrToActiveCurrency(d.refunds))),
          borderColor: c.amber,
          tension: 0.35,
          fill: false,
        },
      ],
    };
  };
  const paymentData = () => {
    const c = getColors();
    const mix = (t && t.byPaymentMethod) || {};
    const labels = Object.keys(mix);
    return {
      labels: labels.length ? labels : ['No sales yet today'],
      datasets: [
        {
          data: labels.length ? labels.map((k) => mix[k]) : [1],
          backgroundColor: labels.length ? [c.green, c.blue, c.purple, c.amber, c.red] : ['rgba(128,128,128,0.25)'],
          borderWidth: 0,
        },
      ],
    };
  };
  const paymentOptions = () => ({ plugins: { legend: { position: 'right', labels: { color: getColors().text } } } });
  const trendKey = `${trendDays}-${monthReport.data ? days.map((d) => d.net).join(',') : 'x'}`;
  const payKey = t ? JSON.stringify(t.byPaymentMethod) : 'none';

  return (
    <>
      <PageHeader
        title={`Dashboard${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={
          <button className="btn btn-outline" onClick={() => window.print()}>
            Print
          </button>
        }
      />
      {(syncError || todayReport.error) && (
        <p className="form-error" style={{ display: 'block', marginBottom: '10px' }}>
          {syncError || todayReport.error}
        </p>
      )}
      <section className="stats-grid">
        <StatCard icon={ICONS.revenue} label="Net sales today" value={t ? rupees(t.netSales, { decimals: 0 }) : '…'} color="green">
          <span style={SUB}>
            {t ? `${t.totalOrders} bills · refunds ${rupees(t.refunds, { decimals: 0 })}` : ''}
          </span>
          <span style={SUB}>This week {rupees(weekNet, { decimals: 0 })} · {weekOrders} bills</span>
        </StatCard>
        <StatCard icon={ICONS.orders} label="Cash still to collect" value={t ? rupees(t.codPending, { decimals: 0 }) : '…'} color="blue">
          <span style={SUB}>COD bills from today out with delivery</span>
          <span style={SUB}>Collected today {t ? rupees(t.collected, { decimals: 0 }) : '…'}</span>
        </StatCard>
        <StatCard icon={ICONS.truck} label="Open deliveries" value={openDeliveries.length} color="amber">
          <span style={SUB}>{unassigned} waiting for a partner</span>
        </StatCard>
        <StatCard icon={ICONS.returns} label="Returns to handle" value={openReturns.length} color="red">
          <span style={SUB}>
            {inventoryStatus === 'failed'
              ? 'Stock alerts unavailable'
              : inventoryStatus === 'idle' || inventoryStatus === 'loading'
                ? 'Checking stock…'
                : `${lowStock.length} products low or out of stock`}
          </span>
        </StatCard>
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Sales trend (net of refunds)</h3>
            <select aria-label="Trend period" className="toolbar-select" value={trendDays} onChange={(e) => setTrendDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
          <div className="card-bd" style={CHART_BODY_STYLE}>
            <ChartCanvas key={trendKey} id="dashSalesChart" type="line" data={trendData} />
          </div>
        </div>
        <div className="card">
          <div className="card-hd">
            <h3>How customers paid today</h3>
          </div>
          <div className="card-bd" style={CHART_BODY_STYLE}>
            <ChartCanvas key={payKey} id="dashPayChart" type="doughnut" data={paymentData} options={paymentOptions} />
          </div>
        </div>
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3>Recent orders</h3>
            <Link to="/orders" className="text-sm">
              All orders
            </Link>
          </div>
          <div className="card-bd">
            <DataTable
              columns={[
                { header: 'ID', key: 'id', cellClassName: 'cell-main' },
                { header: 'Customer', key: 'customer' },
                { header: 'Total', render: (o) => rupees(o.total) },
                { header: 'Payment', render: (o) => <Badge status={o.payment} type={statusColour(o.payment)} /> },
                { header: 'Status', render: (o) => <Badge status={o.status} type={statusColour(o.status)} /> },
              ]}
              rows={recent}
              emptyMessage="No orders yet."
            />
          </div>
        </div>
        <div className="card">
          <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3>Stock that needs attention</h3>
            <Link to="/inventory" className="text-sm">
              Inventory
            </Link>
          </div>
          <div className="card-bd">
            <DataTable
              columns={[
                { header: 'Product', key: 'name', cellClassName: 'cell-main' },
                { header: 'Stock / min', render: (r) => `${r.stock} / ${r.reorderLevel}`, cellClassName: 'nowrap' },
                { header: 'Status', render: (p) => <Badge status={p.status} /> },
              ]}
              rows={lowStock.slice(0, 6)}
              getRowKey={(p) => p.productId}
              emptyMessage={
                inventoryStatus === 'failed'
                  ? "Couldn't load stock alerts."
                  : inventoryStatus === 'idle' || inventoryStatus === 'loading'
                    ? 'Checking stock levels…'
                    : 'Everything is above its reorder level.'
              }
            />
          </div>
        </div>
      </section>
      <p className="text-muted text-sm">
        Figures for {todayKey()} come from the server&apos;s sales report, the same one the Reports page uses.
      </p>
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
