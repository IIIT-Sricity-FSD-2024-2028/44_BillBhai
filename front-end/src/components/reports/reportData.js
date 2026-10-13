// Pure data layer of dashboard.js renderReports() / renderReportView().
// Every figure, table row and chart series of the Reports page is derived here
// from the store rows plus the three toolbar choices.
import {
  getSupplierDetails,
  normalizeInventoryStatus,
  normalizeOrderStatus,
  parseOrderDate,
  startOfDay,
  startOfWeek,
} from '../../lib/dashboard/helpers.js';

export const TIME_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All data' },
];

export const SUMMARY_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'revenue_high', label: 'Revenue high to low' },
  { value: 'revenue_low', label: 'Revenue low to high' },
  { value: 'orders_high', label: 'Most orders' },
  { value: 'returns_high', label: 'Most returns' },
];

export const SUPPLIER_SORT_OPTIONS = [
  { value: 'value_high', label: 'Stock value high to low' },
  { value: 'value_low', label: 'Stock value low to high' },
  { value: 'name', label: 'Supplier A-Z' },
  { value: 'price_high', label: 'Avg price high to low' },
];

function buildContext(orders, returns) {
  const orderRows = orders.map((order) => ({ ...order, parsedDate: parseOrderDate(order && order.date) }));
  const returnRows = returns.map((item) => ({ ...item, parsedDate: parseOrderDate(item && item.updatedAt) }));
  const allDates = [...orderRows.map((item) => item.parsedDate), ...returnRows.map((item) => item.parsedDate)].filter(Boolean);
  const latestDataDate = allDates.length
    ? allDates.reduce((latest, item) => (item > latest ? item : latest), allDates[0])
    : new Date();
  return { orderRows, returnRows, latestDataDate };
}

function buildRangeStart(rangeKey, latestDataDate) {
  if (rangeKey === 'all') return null;
  const days = { '7d': 7, '30d': 30, '90d': 90 }[rangeKey] || 30;
  const start = startOfDay(latestDataDate);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function matchesRange(dateValue, rangeKey, latestDataDate) {
  if (rangeKey === 'all') return true;
  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) return false;
  const windowStart = buildRangeStart(rangeKey, latestDataDate);
  const itemTime = startOfDay(dateValue).getTime();
  const endTime = startOfDay(latestDataDate).getTime();
  return itemTime >= windowStart.getTime() && itemTime <= endTime;
}

function getBucketMeta(dateValue, rangeKey, latestDataDate) {
  const safeDate = dateValue instanceof Date && !Number.isNaN(dateValue.getTime()) ? dateValue : latestDataDate;

  if (rangeKey === 'all') {
    return {
      key: `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}`,
      label: safeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      sortTimeMs: new Date(safeDate.getFullYear(), safeDate.getMonth(), 1).getTime(),
    };
  }

  if (rangeKey === '90d') {
    const weekStart = startOfWeek(safeDate);
    return {
      key: weekStart.toISOString().slice(0, 10),
      label: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      sortTimeMs: weekStart.getTime(),
    };
  }

  const dayStart = startOfDay(safeDate);
  return {
    key: dayStart.toISOString().slice(0, 10),
    label: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sortTimeMs: dayStart.getTime(),
  };
}

function buildSummaryBuckets(filteredOrders, filteredReturns, rangeKey, latestDataDate) {
  const bucketMap = new Map();
  const bucketFor = (date) => {
    const meta = getBucketMeta(date || latestDataDate, rangeKey, latestDataDate);
    if (!bucketMap.has(meta.key)) {
      bucketMap.set(meta.key, { ...meta, revenue: 0, orders: 0, returns: 0, returnValue: 0 });
    }
    return bucketMap.get(meta.key);
  };

  filteredOrders.forEach((order) => {
    const entry = bucketFor(order.parsedDate);
    entry.revenue += Math.max(0, Number(order.total || 0));
    entry.orders += 1;
  });

  filteredReturns.forEach((item) => {
    const entry = bucketFor(item.parsedDate);
    entry.returns += 1;
    entry.returnValue += Math.max(0, Number(item.amount || 0));
  });

  return Array.from(bucketMap.values())
    .map((item) => ({ ...item, net: Math.max(0, item.revenue - item.returnValue) }))
    .sort((a, b) => b.sortTimeMs - a.sortTimeMs);
}

function sortSummaryRows(rows, sortKey) {
  return rows.slice().sort((a, b) => {
    if (sortKey === 'oldest') return a.sortTimeMs - b.sortTimeMs;
    if (sortKey === 'revenue_high') return b.revenue - a.revenue;
    if (sortKey === 'revenue_low') return a.revenue - b.revenue;
    if (sortKey === 'orders_high') return b.orders - a.orders;
    if (sortKey === 'returns_high') return b.returns - a.returns;
    return b.sortTimeMs - a.sortTimeMs;
  });
}

function buildSupplierRows(inventory, sortKey) {
  const rows = Array.from(
    inventory.reduce((acc, item) => {
      const supplier = getSupplierDetails(item);
      const key = supplier.name || 'Unknown Supplier';
      if (!acc.has(key)) acc.set(key, { supplier: key, skus: 0, totalPrice: 0, stockValue: 0 });
      const entry = acc.get(key);
      const price = Math.max(0, Number(item && item.price) || 0);
      entry.skus += 1;
      entry.totalPrice += price;
      entry.stockValue += price * Math.max(0, Number(item && item.stock) || 0);
      return acc;
    }, new Map()).values(),
  ).map((item) => ({ ...item, avgPrice: item.skus ? item.totalPrice / item.skus : 0 }));

  return rows.slice().sort((a, b) => {
    if (sortKey === 'value_low') return a.stockValue - b.stockValue;
    if (sortKey === 'name') return a.supplier.localeCompare(b.supplier);
    if (sortKey === 'price_high') return b.avgPrice - a.avgPrice;
    return b.stockValue - a.stockValue;
  });
}

/**
 * renderReportView(): everything shown for the selected range and sorts.
 * Returns { stats, summaryRows, supplierRows, chartState }.
 */
export function buildReportView({ orders, returns, inventory, rangeKey, summarySort, supplierSort }) {
  const { orderRows, returnRows, latestDataDate } = buildContext(orders, returns);
  const filteredOrders = orderRows.filter((item) => matchesRange(item.parsedDate, rangeKey, latestDataDate));
  const filteredReturns = returnRows.filter((item) => matchesRange(item.parsedDate, rangeKey, latestDataDate));

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Math.max(0, Number(order && order.total) || 0), 0);
  const totalReturnsValue = filteredReturns.reduce((sum, item) => sum + Math.max(0, Number(item && item.amount) || 0), 0);
  const netRevenue = Math.max(0, totalRevenue - totalReturnsValue);
  const avgOrderValue = filteredOrders.length ? Math.round(totalRevenue / filteredOrders.length) : 0;
  const countStatus = (status) => filteredOrders.filter((order) => normalizeOrderStatus(order && order.status) === status).length;
  const deliveredOrders = countStatus('Delivered');
  const completionRate = filteredOrders.length ? Math.round((deliveredOrders / filteredOrders.length) * 100) : 0;
  const pendingReturns = filteredReturns.filter((item) => String((item && item.status) || '').trim().toLowerCase().includes('pending')).length;
  const inventoryAlerts = inventory.filter((item) => normalizeInventoryStatus(item && item.status, item && item.stock) !== 'In Stock').length;

  const buckets = buildSummaryBuckets(filteredOrders, filteredReturns, rangeKey, latestDataDate);
  const summaryRows = sortSummaryRows(buckets, summarySort);
  const supplierRows = buildSupplierRows(inventory, supplierSort);

  const paymentBuckets = new Map();
  filteredOrders.forEach((order) => {
    const paymentLabel = String((order && order.payment) || 'Unknown').trim() || 'Unknown';
    paymentBuckets.set(paymentLabel, (paymentBuckets.get(paymentLabel) || 0) + 1);
  });

  const trendRows = buckets.slice().sort((a, b) => a.sortTimeMs - b.sortTimeMs);
  const chartState = {
    revenueTrend: {
      labels: trendRows.length ? trendRows.map((item) => item.label) : ['No data'],
      values: trendRows.length ? trendRows.map((item) => Math.round(item.revenue)) : [0],
    },
    statusCounts: {
      delivered: deliveredOrders,
      processing: countStatus('Processing'),
      pending: countStatus('Pending'),
      cancelled: countStatus('Cancelled'),
    },
    paymentLabels: Array.from(paymentBuckets.keys()),
    paymentValues: Array.from(paymentBuckets.values()),
  };

  const stats = {
    netRevenue: `Rs ${netRevenue.toLocaleString()}`,
    orderCount: filteredOrders.length.toLocaleString(),
    avgOrderValue: `Rs ${avgOrderValue.toLocaleString()}`,
    returnValue: `Rs ${totalReturnsValue.toLocaleString()}`,
    deliveredMeta: `Delivered: ${deliveredOrders}`,
    completionMeta: `Completion rate: ${completionRate}%`,
    pendingReturnsMeta: `Pending returns: ${pendingReturns}`,
    revenueWindow: `${buckets.length} bucket${buckets.length === 1 ? '' : 's'}`,
    scopeMeta: `Inventory alerts: ${inventoryAlerts}`,
    supplierCount: supplierRows.length.toLocaleString(),
    supplierMeta: supplierRows.length ? `${supplierRows[0].supplier} leads current value` : 'Current stock snapshot',
  };

  return { stats, summaryRows, supplierRows, chartState };
}
