// React port of renderInventoryManagerDashboard() + initInventoryManagerCharts()
// in dashboard.js. Rendered by DashboardPage for the inventorymanager role.
import { useNavigate } from 'react-router-dom';
import PageHeader from '../common/PageHeader.jsx';
import StatCard from '../common/StatCard.jsx';
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';
import ChartCanvas from '../common/ChartCanvas.jsx';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { getInventoryMetrics, normalizeInventoryStatus } from '../../lib/dashboard/helpers.js';
import { buildCategoryPieData, buildStockHealthData, LEGEND_RIGHT_OPTIONS } from './inventoryChartData.js';

const ICONS = {
  skus: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>,
  units: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  low: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>,
  out: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
};

const CHART_BODY_STYLE = { position: 'relative', height: '220px' };

export default function InventoryManagerDashboard() {
  const navigate = useNavigate();
  const { inventory, scopedBusinessName } = useDashboard();
  const metrics = getInventoryMetrics(inventory);
  const lowCritical = metrics.lowStock + metrics.critical;

  const lowestStockRows = inventory
    .map((item) => ({
      sku: String((item && item.sku) || '-'),
      name: String((item && item.name) || '-'),
      cat: String((item && item.cat) || '-'),
      stock: Math.max(0, Number(item && item.stock) || 0),
      status: normalizeInventoryStatus(item && item.status, Number(item && item.stock)),
    }))
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10);

  return (
    <>
      <PageHeader
        title={`Inventory Dashboard${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={(
          <>
            <button className="btn btn-primary" onClick={() => navigate('/inventory')}>Open Inventory</button>
            <button className="btn btn-outline" onClick={() => window.print()}>Print</button>
          </>
        )}
      />
      <section className="stats-grid">
        <StatCard icon={ICONS.skus} label="Total SKUs" value={metrics.totalSkus} color="blue" />
        <StatCard icon={ICONS.units} label="Stock Units" value={metrics.totalUnits.toLocaleString()} color="green" />
        <StatCard icon={ICONS.low} label="Low + Critical" value={lowCritical} color="amber" />
        <StatCard icon={ICONS.out} label="Out of Stock" value={metrics.outOfStock} color="red" />
      </section>
      <section className="grid-2">
        <div className="card"><div className="card-hd"><h3>Category Distribution</h3></div><div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="invMgrCategoryChart" type="pie" data={() => buildCategoryPieData(inventory)} options={LEGEND_RIGHT_OPTIONS} /></div></div>
        <div className="card"><div className="card-hd"><h3>Stock Health</h3></div><div className="card-bd" style={CHART_BODY_STYLE}><ChartCanvas id="invMgrHealthChart" type="doughnut" data={() => buildStockHealthData(inventory)} options={LEGEND_RIGHT_OPTIONS} /></div></div>
      </section>
      <section className="card"><div className="card-hd"><h3>Lowest Stock Items</h3></div><div className="card-bd">
        <DataTable
          columns={[
            { header: 'SKU', key: 'sku', cellClassName: 'cell-main' },
            { header: 'Product', key: 'name' },
            { header: 'Category', key: 'cat' },
            { header: 'Stock', key: 'stock' },
            { header: 'Status', render: (item) => <Badge status={item.status} /> },
          ]}
          rows={lowestStockRows}
          getRowKey={(item, i) => `${item.sku}-${i}`}
          emptyMessage="No inventory data available."
        />
      </div></section>
    </>
  );
}
