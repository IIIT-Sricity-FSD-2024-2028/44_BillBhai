/**
 * Delivery desk rules, mirroring the server's flow
 * (back-end/express/modules/deliveries/deliveries.schema.ts). The server
 * enforces them; the screen only uses them to offer the right buttons.
 */

export const TRANSITIONS = {
  Pending: ['Assigned', 'Cancelled'],
  Assigned: ['Dispatched', 'Pending', 'Cancelled'],
  Dispatched: ['Out for Delivery', 'Delivered', 'Failed Attempt'],
  'Out for Delivery': ['Delivered', 'Failed Attempt'],
  'Failed Attempt': ['Assigned', 'Returned to Store'],
  Delivered: [],
  'Returned to Store': [],
  Cancelled: [],
};

export const MAX_ATTEMPTS = 3;
export const DEFAULT_ETA_MIN = 45;
export const FAILURE_REASONS = [
  'Customer not reachable',
  'Address not found',
  'Customer refused',
  'Customer asked to reschedule',
  'Other',
];

export const STATUS_GROUPS = [
  { key: 'pending', label: 'Needs partner', statuses: ['Pending'] },
  { key: 'ready', label: 'Ready to dispatch', statuses: ['Assigned'] },
  { key: 'road', label: 'On the road', statuses: ['Dispatched', 'Out for Delivery'] },
  { key: 'failed', label: 'Failed', statuses: ['Failed Attempt'] },
  { key: 'done', label: 'Done', statuses: ['Delivered', 'Returned to Store', 'Cancelled'] },
  { key: 'all', label: 'All', statuses: null },
];

export const ON_ROAD = ['Dispatched', 'Out for Delivery'];
export const OPEN = ['Pending', 'Assigned', 'Dispatched', 'Out for Delivery', 'Failed Attempt'];

export function inGroup(delivery, groupKey) {
  const group = STATUS_GROUPS.find((g) => g.key === groupKey);
  return !group || !group.statuses || group.statuses.includes(delivery.status);
}

/** When the parcel left the store (last Dispatched event), or null. */
export function dispatchedAt(delivery) {
  const events = (delivery.history || []).filter((h) => h.status === 'Dispatched');
  const last = events[events.length - 1];
  return last ? new Date(last.at).getTime() : null;
}

/** Expected arrival time for a parcel on the road, or null. */
export function dueAt(delivery) {
  if (!ON_ROAD.includes(delivery.status)) return null;
  const start = dispatchedAt(delivery) || new Date(delivery.lastChangeAt || Date.now()).getTime();
  return start + (Number(delivery.etaMin) || DEFAULT_ETA_MIN) * 60 * 1000;
}

export function isOverdue(delivery, now = Date.now()) {
  const due = dueAt(delivery);
  return due !== null && now > due;
}

export function minutesLate(delivery, now = Date.now()) {
  const due = dueAt(delivery);
  return due === null ? 0 : Math.max(0, Math.round((now - due) / 60000));
}

/** COD cash the partner still has to bring back. */
export function codOutstanding(delivery) {
  if (!delivery.codAmount || delivery.status === 'Delivered') return 0;
  if (['Cancelled', 'Returned to Store'].includes(delivery.status)) return 0;
  return delivery.codAmount;
}

/** Partners seen on any delivery, newest details first, for the picker. */
export function partnerDirectory(deliveries) {
  const map = new Map();
  [...deliveries]
    .sort((a, b) => String(b.lastChangeAt || '').localeCompare(String(a.lastChangeAt || '')))
    .forEach((d) => {
      const name = String(d.partner || '').trim();
      if (!name || map.has(name.toLowerCase())) return;
      map.set(name.toLowerCase(), {
        name,
        phone: d.partnerPhone || '',
        agency: d.partnerAgency || '',
        vehicle: d.partnerVehicle || '',
      });
    });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Open deliveries per partner (their current load). */
export function partnerLoad(deliveries) {
  const map = new Map();
  deliveries
    .filter((d) => d.partner && ['Assigned', 'Dispatched', 'Out for Delivery'].includes(d.status))
    .forEach((d) => map.set(d.partner, (map.get(d.partner) || 0) + 1));
  return map;
}

export function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** End-of-day cash per partner: delivered today, cash collected today, COD still out. */
export function codSummary(deliveries) {
  const map = new Map();
  const row = (name) => {
    if (!map.has(name)) map.set(name, { partner: name, deliveredToday: 0, cashToday: 0, codOut: 0, codOutCount: 0 });
    return map.get(name);
  };
  deliveries.forEach((d) => {
    const name = d.partner || 'Unassigned';
    if (d.status === 'Delivered' && isToday(d.deliveryDate)) {
      const r = row(name);
      r.deliveredToday += 1;
      r.cashToday += Number(d.cashCollected) || 0;
    }
    const out = codOutstanding(d);
    if (out > 0) {
      const r = row(name);
      r.codOut += out;
      r.codOutCount += 1;
    }
  });
  return [...map.values()].sort((a, b) => b.codOut + b.cashToday - (a.codOut + a.cashToday));
}

export function getDeliveryCounts(deliveries) {
  const counts = {
    pending: 0,
    ready: 0,
    road: 0,
    failed: 0,
    deliveredToday: 0,
    overdue: 0,
    codPending: 0,
    open: 0,
  };
  deliveries.forEach((d) => {
    if (d.status === 'Pending') counts.pending += 1;
    if (d.status === 'Assigned') counts.ready += 1;
    if (ON_ROAD.includes(d.status)) counts.road += 1;
    if (d.status === 'Failed Attempt') counts.failed += 1;
    if (d.status === 'Delivered' && isToday(d.deliveryDate)) counts.deliveredToday += 1;
    if (isOverdue(d)) counts.overdue += 1;
    if (OPEN.includes(d.status)) counts.open += 1;
    counts.codPending += codOutstanding(d);
  });
  return counts;
}

export function money(value) {
  return `₹${(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const today = isToday(value);
  return d.toLocaleString('en-IN', {
    day: today ? undefined : 'numeric',
    month: today ? undefined : 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function mobileDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const tail = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(tail) ? tail : '';
}

export function formatMobile(value) {
  const d = mobileDigits(value);
  return d ? `+91\u00a0${d.slice(0, 5)}\u00a0${d.slice(5)}` : String(value || '');
}

export function itemsSummary(items) {
  return (items || []).map((i) => `${i.productName} ×${i.quantity}`).join(', ');
}
