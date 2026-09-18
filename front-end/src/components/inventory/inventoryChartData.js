// Chart data builders shared by the Inventory page (initInventoryCharts) and the
// Inventory Manager dashboard (initInventoryManagerCharts) in dashboard.js.
import { getColors } from '../common/ChartCanvas.jsx';
import { getInventoryCategoryCounts, getInventoryMetrics, normalizeInventoryStatus } from '../../lib/dashboard/helpers.js';

export const LEGEND_RIGHT_OPTIONS = () => ({ plugins: { legend: { position: 'right', labels: { color: getColors().text } } } });

/** Category Distribution pie (invCatChart / invMgrCategoryChart). */
export function buildCategoryPieData(inventory) {
  const c = getColors();
  const categoryCounts = getInventoryCategoryCounts(inventory);
  return {
    labels: categoryCounts.labels,
    datasets: [{
      data: categoryCounts.values,
      backgroundColor: [c.amber, c.blue, c.green, c.purple, c.red, c.text],
      borderWidth: 0,
    }],
  };
}

/** Stock Levels bar (invStockChart): top 8 items by stock. */
export function buildStockLevelsData(inventory) {
  const c = getColors();
  const stockRows = inventory
    .map((item) => ({
      label: String((item && item.name) || (item && item.sku) || 'Item'),
      stock: Math.max(0, Number(item && item.stock) || 0),
      status: normalizeInventoryStatus(item && item.status, item && item.stock),
    }))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 8);

  const stockLabels = stockRows.length ? stockRows.map((row) => row.label) : ['No data'];
  const stockData = stockRows.length ? stockRows.map((row) => row.stock) : [0];
  const stockColors = stockRows.length
    ? stockRows.map((row) => {
      if (row.status === 'Out of Stock' || row.status === 'Critical') return c.red;
      if (row.status === 'Low Stock') return c.amber;
      return c.green;
    })
    : [c.blue];

  return {
    labels: stockLabels,
    datasets: [{ label: 'Stock Level', data: stockData, backgroundColor: stockColors }],
  };
}

/** Stock Health doughnut (invMgrHealthChart). */
export function buildStockHealthData(inventory) {
  const c = getColors();
  const metrics = getInventoryMetrics(inventory);
  return {
    labels: ['In Stock', 'Low Stock', 'Critical', 'Out of Stock'],
    datasets: [{
      data: [metrics.inStock, metrics.lowStock, metrics.critical, metrics.outOfStock],
      backgroundColor: [c.green, c.amber, c.red, c.purple],
      borderWidth: 0,
    }],
  };
}
