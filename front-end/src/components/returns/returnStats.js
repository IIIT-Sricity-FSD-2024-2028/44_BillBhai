import { formatCurrency } from '../../lib/currency.js';

/** The return statuses the server uses, in the order a request moves. */
export const RETURN_STATUS_LIST = ['Pending', 'Approved', 'Refunded', 'Exchanged', 'Rejected'];

/** Mirrors RETURN_TRANSITIONS in back-end/express/modules/returns/returns.schema.ts. */
export const RETURN_NEXT = {
  Pending: ['Approved', 'Rejected', 'Refunded', 'Exchanged'],
  Approved: ['Refunded', 'Exchanged', 'Rejected'],
  Rejected: [],
  Refunded: [],
  Exchanged: [],
};

export const RETURN_REASONS = ['Damaged', 'Expired', 'Wrong item', 'Stale', 'Not as described'];

export const REFUND_METHODS = ['Cash', 'UPI', 'Card', 'Original payment', 'Store credit'];

export function classifyReturnStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('refund')) return 'refunded';
  if (s.includes('reject')) return 'rejected';
  if (s.includes('exchang')) return 'exchanged';
  if (s.includes('approv')) return 'approved';
  return 'pending';
}

/** Badge colour for a status (Exchanged has no colour of its own). */
export function returnBadgeType(status) {
  const kind = classifyReturnStatus(status);
  return kind === 'exchanged' ? 'delivered' : kind;
}

export function summarizeReturns(view) {
  return view.reduce(
    (acc, r) => {
      const kind = classifyReturnStatus(r.status);
      const amount = Number(r.amount || 0);
      acc.total += 1;
      acc[kind] += 1;
      acc.valueTotal += amount;
      if (kind === 'refunded') acc.valueRefunded += amount;
      if (kind === 'pending' || kind === 'approved') acc.valueAtRisk += amount;
      return acc;
    },
    {
      total: 0,
      pending: 0,
      approved: 0,
      refunded: 0,
      exchanged: 0,
      rejected: 0,
      valueTotal: 0,
      valueRefunded: 0,
      valueAtRisk: 0,
    },
  );
}

/** Units returned per product, counted from the return lines. */
export function getReturnProductCounts(view) {
  const counts = new Map();
  view.forEach((r) => {
    const lines = Array.isArray(r.items) && r.items.length ? r.items : [];
    lines.forEach((line) => {
      const name = String(line.productName || line.productId || '').trim();
      if (!name) return;
      counts.set(name, (counts.get(name) || 0) + (Number(line.qty) || 0));
    });
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export function getReturnReasonCounts(view) {
  const counts = new Map();
  view.forEach((r) => {
    const reason = String(r.reason || '').trim() || 'Unknown';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

/** Time the request was raised. */
export function returnRaisedAt(r) {
  const raw = r.createdAt || r.returnDate;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** "3h", "2d" since the request was raised. */
export function returnAge(r, now = Date.now()) {
  const at = returnRaisedAt(r);
  if (!at) return '—';
  const hours = Math.max(0, (now - at) / 3600000);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function rupees(value) {
  return formatCurrency(value);
}

export function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
