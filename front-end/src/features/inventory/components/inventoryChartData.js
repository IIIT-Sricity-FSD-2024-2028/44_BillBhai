import { getColors } from '../../../shared/components/common/ChartCanvas.jsx';
import { getInventoryCategoryCounts, getInventoryMetrics } from '../../../shared/lib/dashboard/helpers.js';

export const LEGEND_RIGHT_OPTIONS = () => ({
  plugins: { legend: { position: 'right', labels: { color: getColors().text } } },
});

export function buildCategoryPieData(inventory) {
  const c = getColors();
  const categoryCounts = getInventoryCategoryCounts(inventory.filter((i) => i.active !== false));
  return {
    labels: categoryCounts.labels,
    datasets: [
      {
        data: categoryCounts.values,
        backgroundColor: [c.amber, c.blue, c.green, c.purple, c.red, c.text, '#14b8a6', '#f472b6'],
        borderWidth: 0,
      },
    ],
  };
}

/**
 * The products closest to running out: stock as a share of the reorder
 * level, lowest first. Bars show units on hand; the line is the reorder level.
 */
export function buildStockLevelsData(inventory) {
  const c = getColors();
  const rows = inventory
    .filter((item) => item.active !== false)
    .map((item) => ({
      label: String(item.name || item.sku || 'Item'),
      stock: Math.max(0, Number(item.stock) || 0),
      reorder: Math.max(0, Number(item.reorderLevel) || 0),
      status: item.status,
    }))
    .sort((a, b) => a.stock / Math.max(1, a.reorder) - b.stock / Math.max(1, b.reorder))
    .slice(0, 8);
  if (!rows.length) {
    return { labels: ['No data'], datasets: [{ label: 'Stock', data: [0], backgroundColor: [c.blue] }] };
  }
  return {
    labels: rows.map((r) => r.label),
    datasets: [
      {
        type: 'bar',
        label: 'On hand',
        data: rows.map((r) => r.stock),
        backgroundColor: rows.map((r) =>
          r.status === 'Out of Stock' || r.status === 'Critical' ? c.red : r.status === 'Low Stock' ? c.amber : c.green,
        ),
      },
      {
        type: 'line',
        label: 'Reorder level',
        data: rows.map((r) => r.reorder),
        borderColor: c.blue,
        backgroundColor: c.blue,
        pointRadius: 3,
        borderDash: [4, 4],
        fill: false,
      },
    ],
  };
}

export function buildStockHealthData(inventory) {
  const c = getColors();
  const metrics = getInventoryMetrics(inventory.filter((i) => i.active !== false));
  return {
    labels: ['In Stock', 'Low Stock', 'Critical', 'Out of Stock'],
    datasets: [
      {
        data: [metrics.inStock, metrics.lowStock, metrics.critical, metrics.outOfStock],
        backgroundColor: [c.green, c.amber, c.red, c.purple],
        borderWidth: 0,
      },
    ],
  };
}

export function buildMovementTypeData(movementsByType) {
  const c = getColors();
  const labels = Object.keys(movementsByType || {});
  return {
    labels: labels.length ? labels : ['No data'],
    datasets: [
      {
        label: 'Movements',
        data: labels.length ? labels.map((k) => movementsByType[k]) : [0],
        backgroundColor: [c.blue, c.green, c.amber, c.red, c.purple, c.text, '#14b8a6'],
      },
    ],
  };
}
