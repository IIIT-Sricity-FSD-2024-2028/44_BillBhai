// Shared return aggregations (the reduce/Map blocks repeated in
// renderReturnsRefined(), renderReturnHandlerDashboard() and initReturnCharts()).

export function classifyReturnStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('refund')) return 'refunded';
  if (s.includes('reject')) return 'rejected';
  return 'pending';
}

export function summarizeReturns(view) {
  return view.reduce((acc, r) => {
    const kind = classifyReturnStatus(r.status);
    const amount = Number(r.amount || 0);
    acc.total += 1;
    acc[kind] += 1;
    acc.valueTotal += amount;
    if (kind === 'refunded') acc.valueRefunded += amount;
    if (kind === 'pending') acc.valueAtRisk += amount;
    return acc;
  }, { total: 0, pending: 0, refunded: 0, rejected: 0, valueTotal: 0, valueRefunded: 0, valueAtRisk: 0 });
}

/** Product -> count entries sorted by count desc (skips empty / '-' products). */
export function getReturnProductCounts(view) {
  const productCounts = new Map();
  view.forEach((r) => {
    const p = String(r.product || '').trim();
    if (!p || p === '-') return;
    productCounts.set(p, (productCounts.get(p) || 0) + 1);
  });
  return Array.from(productCounts.entries()).sort((a, b) => b[1] - a[1]);
}

export function getReturnReasonCounts(view) {
  const reasonCounts = new Map();
  view.forEach((r) => {
    const reason = String(r.reason || '').trim() || 'Unknown';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  });
  return Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]);
}
