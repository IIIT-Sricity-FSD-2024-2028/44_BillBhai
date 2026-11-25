import {
  CUSTOMER_SESSION_NOTIFICATION_KEY,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_STATE_STORAGE_KEY,
  PROFILE_SETTINGS_STORAGE_KEY,
  ROLE_LABELS,
  ROLE_NOTIFICATION_CONFIG,
} from './constants.js';
import { formatRelativeTime } from './helpers.js';
import { loadObject, saveObject } from './storage.js';
import { formatCurrency } from '../currency.js';

/**
 * Notifications.
 *
 * Every notification is worked out from records the server returned (stock
 * rows, deliveries, returns, orders, coupons, businesses) and carries the time
 * of the record it is about (last stock change, last delivery step, when the
 * return was raised). Nothing is invented: a record without a time says
 * "Current snapshot". Which ones a person has read is remembered per browser.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function getNotificationPreferenceConfig(roleKey) {
  return ROLE_NOTIFICATION_CONFIG[roleKey] || ROLE_NOTIFICATION_CONFIG.customer;
}

export function normalizeNotificationPreferences(savedPreferences, roleKey) {
  const config = getNotificationPreferenceConfig(roleKey);
  const safe = savedPreferences && typeof savedPreferences === 'object' ? savedPreferences : {};
  const next = {};
  config.forEach((item) => {
    next[item.key] = typeof safe[item.key] === 'boolean' ? safe[item.key] : item.defaultEnabled !== false;
  });
  return next;
}

export function getNotificationCategoryLabel(category) {
  return NOTIFICATION_CATEGORY_LABELS[category] || 'Notification';
}

export function getNotificationPriorityRank(priority) {
  const value = String(priority || 'medium').trim().toLowerCase();
  if (value === 'critical') return 4;
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  return 1;
}

export function getNotificationColor(category, priority) {
  const c = String(category || '').trim().toLowerCase();
  const p = String(priority || '').trim().toLowerCase();
  if (p === 'critical') return 'red';
  if (c === 'payments') return 'green';
  if (c === 'inventory' || c === 'returns') return 'amber';
  if (c === 'delivery') return 'blue';
  if (c === 'users' || c === 'businesses') return 'purple';
  return 'blue';
}

export function getNotificationIconKeyForCategory(category) {
  const c = String(category || '').trim().toLowerCase();
  if (c === 'payments') return 'payment';
  if (c === 'inventory') return 'alert';
  if (c === 'delivery') return 'delivery';
  if (c === 'returns') return 'return';
  if (c === 'users' || c === 'businesses') return 'user';
  return 'order';
}

export function getNotificationPriorityBadgeProps(notification) {
  const priority = String((notification && notification.priority) || 'low').trim().toLowerCase();
  if (priority === 'critical') return { text: 'Critical', type: 'cancelled' };
  if (priority === 'high') return { text: 'High', type: 'pending' };
  if (priority === 'medium') return { text: 'Medium', type: 'processing' };
  return { text: 'Low', type: 'active' };
}

export function makeNotificationRecord(record) {
  const safe = record && typeof record === 'object' ? record : {};
  const category = String(safe.category || 'orders').trim().toLowerCase();
  const priority = String(safe.priority || 'medium').trim().toLowerCase();
  const sortTimeMs = Math.max(0, Number(safe.sortTimeMs) || 0);
  const detailRows = Array.isArray(safe.detailRows)
    ? safe.detailRows
        .map((row) => ({
          label: String((row && row.label) || '').trim(),
          value: String((row && row.value) ?? '-').trim() || '-',
        }))
        .filter((row) => row.label)
    : [];
  return {
    id: String(safe.id || `notif-${category}-${safe.title || ''}`).trim(),
    title: String(safe.title || 'Notification').trim(),
    desc: String(safe.desc || '').trim(),
    category,
    color: String(safe.color || getNotificationColor(category, priority)).trim().toLowerCase(),
    iconKey: String(safe.iconKey || getNotificationIconKeyForCategory(category)).trim().toLowerCase(),
    priority,
    priorityRank: getNotificationPriorityRank(priority),
    sortTimeMs,
    time: String(safe.time || formatRelativeTime(sortTimeMs)).trim(),
    detailRows,
    defaultUnread: safe.defaultUnread !== false,
  };
}

/* ------------------------------------------------------------------ */
/* Profile preferences (this browser only)                             */
/* ------------------------------------------------------------------ */

export function getCurrentUserIdentity(s) {
  const currentUser = loadObject('currentUser', {});
  const username = String(currentUser.username || '').trim();
  const displayName = String(currentUser.name || localStorage.getItem('userName') || 'User').trim() || 'User';
  return {
    key: (username || displayName.toLowerCase().replace(/\s+/g, '.')).trim(),
    username,
    displayName,
    roleLabel: ROLE_LABELS[s.roleKey] || 'Team Member',
    email: String(currentUser.email || '').trim(),
    phone: String(currentUser.phone || '').trim(),
  };
}

/**
 * Display preferences and notification switches. Name, email and phone are
 * the server's (shown here for the header); they are changed on the Profile
 * page through the API, not stored as preferences.
 */
export function loadProfileSettingsRecord(s) {
  const identity = getCurrentUserIdentity(s);
  const store = loadObject(PROFILE_SETTINGS_STORAGE_KEY, {});
  const saved = store[identity.key] && typeof store[identity.key] === 'object' ? store[identity.key] : {};
  const activeCurrency = localStorage.getItem('userCurrency') || saved.currency || 'INR';
  return {
    key: identity.key,
    fullName: identity.displayName,
    email: identity.email,
    phone: identity.phone,
    // Never used to rename the business.
    location: '',
    bio: '',
    language: String(saved.language || 'English (India)').trim(),
    currency: String(activeCurrency).trim(),
    timezone: String(saved.timezone || 'Asia/Kolkata').trim(),
    dateFormat: String(saved.dateFormat || 'DD/MM/YYYY').trim(),
    notifications: normalizeNotificationPreferences(saved.notifications, s.roleKey),
  };
}

export function writeProfileSettingsRecord(s, record) {
  const identity = getCurrentUserIdentity(s);
  const key = String(record.key || identity.key).trim() || identity.key;
  const store = loadObject(PROFILE_SETTINGS_STORAGE_KEY, {});
  store[key] = {
    language: record.language,
    currency: record.currency,
    timezone: record.timezone,
    dateFormat: record.dateFormat,
    notifications: { ...record.notifications },
  };
  saveObject(PROFILE_SETTINGS_STORAGE_KEY, store);
  if (record.currency) {
    localStorage.setItem('userCurrency', record.currency);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('currency-changed', { detail: record.currency }));
    }
  }
  if (record.fullName) {
    // Mirror of what the server now holds, for the header.
    localStorage.setItem('userName', record.fullName);
    const currentUser = loadObject('currentUser', {});
    saveObject('currentUser', {
      ...currentUser,
      name: record.fullName,
      email: record.email ?? currentUser.email,
      phone: record.phone ?? currentUser.phone,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Read state                                                          */
/* ------------------------------------------------------------------ */

export function getActiveBusinessRecord(s) {
  if (s.selectedBusiness) return s.selectedBusiness;
  const scopedId = String(localStorage.getItem('activeBusinessId') || '').trim();
  return (s.businesses || []).find((item) => item.id === scopedId) || null;
}

export function getNotificationAudienceKey(s) {
  const currentUser = loadObject('currentUser', {});
  const username = String(currentUser.username || localStorage.getItem('userName') || s.roleKey || 'user')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (s.roleKey === 'customer') {
    const sessionId = String(sessionStorage.getItem('bb_customer_session_id') || 'customer-session').trim();
    return `${s.roleKey}::${username}::${sessionId}`;
  }
  const scope =
    s.roleKey === 'superuser' ? 'all-businesses' : String(localStorage.getItem('activeBusinessId') || 'global').trim();
  return `${s.roleKey}::${username}::${scope}`;
}

export function loadNotificationState(s) {
  const store = loadObject(NOTIFICATION_STATE_STORAGE_KEY, {});
  const key = getNotificationAudienceKey(s);
  const saved = store[key] && typeof store[key] === 'object' ? store[key] : {};
  const readMap =
    saved.readMap && typeof saved.readMap === 'object' && !Array.isArray(saved.readMap) ? saved.readMap : {};
  return { key, readMap };
}

export function saveNotificationState(s, state) {
  const safe = state && typeof state === 'object' ? state : {};
  const store = loadObject(NOTIFICATION_STATE_STORAGE_KEY, {});
  const key = String(safe.key || getNotificationAudienceKey(s)).trim() || getNotificationAudienceKey(s);
  store[key] = { readMap: safe.readMap && typeof safe.readMap === 'object' ? safe.readMap : {} };
  saveObject(NOTIFICATION_STATE_STORAGE_KEY, store);
}

export function writeNotificationReadState(s, notificationId, isRead) {
  const id = String(notificationId || '').trim();
  if (!id) return;
  const state = loadNotificationState(s);
  state.readMap[id] = Boolean(isRead);
  saveNotificationState(s, state);
}

export function writeNotificationsRead(s, ids, isRead) {
  const state = loadNotificationState(s);
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    const safeId = String(id || '').trim();
    if (safeId) state.readMap[safeId] = Boolean(isRead);
  });
  saveNotificationState(s, state);
}

export function loadCustomerSessionNotifications() {
  try {
    const raw = sessionStorage.getItem(CUSTOMER_SESSION_NOTIFICATION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Builders, one per kind of record                                    */
/* ------------------------------------------------------------------ */

function ms(value) {
  const t = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

function rupees(n) {
  return formatCurrency(n, { decimals: 0 });
}

function stockNotifications(inventory, { outOfStockOnly = false } = {}) {
  return (inventory || [])
    .filter((row) => row.active !== false)
    .filter((row) =>
      outOfStockOnly ? row.status === 'Out of Stock' : ['Out of Stock', 'Critical', 'Low Stock'].includes(row.status),
    )
    .map((row) => {
      const priority = row.status === 'Out of Stock' ? 'critical' : row.status === 'Critical' ? 'high' : 'medium';
      const title =
        row.status === 'Out of Stock'
          ? `Out of stock: ${row.name}`
          : `${row.status === 'Critical' ? 'Critical' : 'Low'} stock: ${row.name}`;
      return makeNotificationRecord({
        id: `inv-${row.productId || row.sku}-${row.status}-${row.stock}`,
        title,
        desc: `${row.stock} left (reorder at ${row.reorderLevel}).${row.supplier ? ` Supplier: ${row.supplier}` : ''}${row.leadTimeDays ? `, ${row.leadTimeDays} day(s) to deliver` : ''}.`,
        category: 'inventory',
        priority,
        sortTimeMs: ms(row.lastUpdated),
        detailRows: [
          { label: 'Product', value: `${row.name} (${row.sku})` },
          { label: 'On the shelf', value: row.stock },
          { label: 'Reorder level', value: row.reorderLevel },
          { label: 'Location', value: row.location || '-' },
          { label: 'Supplier', value: row.supplier || '-' },
          { label: 'Supplier phone', value: row.supplierPhone || '-' },
        ],
      });
    });
}

function deliveryNotifications(deliveries, now) {
  const list = [];
  (deliveries || []).forEach((d) => {
    const last = ms(d.lastChangeAt);
    const rows = [
      { label: 'Delivery', value: d.id },
      { label: 'Order', value: d.orderId },
      { label: 'Customer', value: `${d.customer || '-'} ${d.customerPhone || ''}`.trim() },
      { label: 'Address', value: d.address || '-' },
      { label: 'Partner', value: d.partner ? `${d.partner} ${d.partnerPhone || ''}`.trim() : 'Not assigned' },
      { label: 'Status', value: d.status },
    ];
    if (d.status === 'Pending') {
      list.push(
        makeNotificationRecord({
          id: `del-${d.id}-unassigned`,
          title: `Needs a partner: ${d.orderId}`,
          desc: `${d.customer || 'Customer'} is waiting; no delivery partner assigned yet.`,
          category: 'delivery',
          priority: now - last > HOUR ? 'high' : 'medium',
          sortTimeMs: last,
          detailRows: rows,
        }),
      );
    }
    if (d.status === 'Failed Attempt') {
      list.push(
        makeNotificationRecord({
          id: `del-${d.id}-failed-${d.attempts}`,
          title: `Delivery failed: ${d.orderId}`,
          desc: `Attempt ${d.attempts}: ${d.failureReason || 'no reason given'}. Retry or return it to the store.`,
          category: 'delivery',
          priority: 'high',
          sortTimeMs: last,
          detailRows: rows,
        }),
      );
    }
    if (['Dispatched', 'Out for Delivery'].includes(d.status)) {
      const due = last + (Number(d.etaMin) || 45) * 60 * 1000;
      if (last && now > due) {
        list.push(
          makeNotificationRecord({
            id: `del-${d.id}-late-${d.status}`,
            title: `Running late: ${d.orderId}`,
            desc: `${d.status} for ${Math.round((now - last) / 60000)} min, ETA was ${Number(d.etaMin) || 45} min. Call ${String(d.partner || 'the partner').replace(/\.$/, '')}.`,
            category: 'delivery',
            priority: 'high',
            sortTimeMs: due,
            detailRows: rows,
          }),
        );
      }
    }
  });
  return list;
}

function codNotifications(orders, deliveries, now) {
  const byOrder = new Map((deliveries || []).map((d) => [d.orderId, d]));
  return (orders || [])
    .filter((o) => o.payment === 'COD' && o.paymentStatus === 'Pending' && o.status !== 'Cancelled')
    .map((o) => {
      const d = byOrder.get(o.id);
      const age = now - ms(o.orderDate);
      return makeNotificationRecord({
        id: `cod-${o.id}`,
        title: `COD to collect: ${rupees(o.total)} (${o.id})`,
        desc: `${o.customer} · ${d ? `delivery ${d.status}` : 'no delivery yet'}${d && d.partner ? ` with ${d.partner}` : ''}.`,
        category: 'payments',
        priority: age > 6 * HOUR ? 'high' : 'low',
        sortTimeMs: ms(o.orderDate),
        detailRows: [
          { label: 'Order', value: o.id },
          { label: 'Amount', value: rupees(o.total) },
          { label: 'Customer', value: `${o.customer} ${o.customerPhone || ''}`.trim() },
          { label: 'Delivery', value: d ? `${d.id} (${d.status})` : 'Not created' },
        ],
      });
    });
}

function returnNotifications(returns, now) {
  return (returns || [])
    .filter((r) => r.status === 'Pending' || r.status === 'Approved')
    .map((r) => {
      const raised = ms(r.createdAt || r.returnDate);
      const old = now - raised > 2 * DAY;
      return makeNotificationRecord({
        id: `ret-${r.id}-${r.status}`,
        title: `${r.status === 'Pending' ? 'Return to decide' : 'Approved, refund pending'}: ${r.id}`,
        desc: `${r.product} from ${r.orderId} (${r.reason}). ${r.returnType === 'exchange' ? 'Exchange' : `Refund ${rupees(r.amount)}`}.`,
        category: 'returns',
        priority: old ? 'high' : 'medium',
        sortTimeMs: raised,
        detailRows: [
          { label: 'Return', value: r.id },
          { label: 'Order', value: r.orderId },
          { label: 'Customer', value: r.customer || '-' },
          { label: 'Items', value: r.product },
          { label: 'Reason', value: r.reason },
          { label: 'Refund', value: r.returnType === 'exchange' ? 'Exchange' : rupees(r.amount) },
        ],
      });
    });
}

function couponNotifications(coupons, now) {
  const list = [];
  (coupons || []).forEach((c) => {
    if (!c.active) return;
    const ends = ms(`${c.validTo}T23:59:59+05:30`);
    const daysLeft = Math.ceil((ends - now) / DAY);
    if (ends && daysLeft >= 0 && daysLeft <= 7) {
      list.push(
        makeNotificationRecord({
          id: `cpn-${c.id}-expiring-${c.validTo}`,
          title: `Coupon ${c.code} ends ${daysLeft === 0 ? 'today' : `in ${daysLeft} day(s)`}`,
          desc: `Valid until ${c.validTo}. Used ${Number(c.usedCount || 0)} time(s).`,
          category: 'orders',
          priority: 'low',
          sortTimeMs: ms(c.updatedAt) || ms(c.createdAt),
        }),
      );
    }
    if (Number(c.usageLimit) > 0 && Number(c.usedCount || 0) >= Number(c.usageLimit) * 0.9) {
      list.push(
        makeNotificationRecord({
          id: `cpn-${c.id}-limit-${c.usedCount}`,
          title: `Coupon ${c.code} is nearly used up`,
          desc: `${c.usedCount} of ${c.usageLimit} uses taken.`,
          category: 'orders',
          priority: 'medium',
          sortTimeMs: ms(c.updatedAt) || ms(c.createdAt),
        }),
      );
    }
  });
  return list;
}

function businessNotifications(businesses, now) {
  const list = [];
  (businesses || []).forEach((b) => {
    const at = ms(b.updatedAt);
    if (b.status && b.status !== 'Active') {
      list.push(
        makeNotificationRecord({
          id: `biz-${b.id}-${b.status}`,
          title: `${b.name} is ${String(b.status).toLowerCase()}`,
          desc: 'Its staff cannot sign in until it is resumed.',
          category: 'businesses',
          priority: 'high',
          sortTimeMs: at,
        }),
      );
    }
    if (Number(b.paymentDue) > 0) {
      list.push(
        makeNotificationRecord({
          id: `biz-${b.id}-due-${b.paymentDue}`,
          title: `Payment due from ${b.name}: ${rupees(b.paymentDue)}`,
          desc: 'Subscription payment outstanding.',
          category: 'payments',
          priority: Number(b.paymentDue) >= 10000 ? 'high' : 'medium',
          sortTimeMs: at,
        }),
      );
    }
    if (String(b.subscriptionStatus || '') === 'Cancelled') {
      list.push(
        makeNotificationRecord({
          id: `biz-${b.id}-cancelled`,
          title: `${b.name} cancelled its subscription`,
          desc: 'Follow up before the renewal date.',
          category: 'businesses',
          priority: 'medium',
          sortTimeMs: at,
        }),
      );
    }
    const renews = ms(b.renewalDate);
    if (renews && renews - now <= 7 * DAY && renews >= now - DAY) {
      list.push(
        makeNotificationRecord({
          id: `biz-${b.id}-renewal-${b.renewalDate}`,
          title: `${b.name} renews on ${b.renewalDate}`,
          desc: `Plan: ${b.productsPlan || b.plan || '-'}.`,
          category: 'businesses',
          priority: 'low',
          sortTimeMs: at,
        }),
      );
    }
  });
  return list;
}

function suspendedUserNotifications(users) {
  return (users || [])
    .filter((u) => u.status === 'Suspended')
    .map((u) =>
      makeNotificationRecord({
        id: `usr-${u.id}-suspended`,
        title: `${u.name} is suspended`,
        desc: `${u.role} account cannot sign in.`,
        category: 'users',
        priority: 'low',
        sortTimeMs: ms(u.updatedAt),
      }),
    );
}

export function generateCustomerNotifications() {
  return loadCustomerSessionNotifications().map((item, index) =>
    makeNotificationRecord({
      ...item,
      id: String((item && item.id) || `customer-session-${index + 1}`).trim(),
      sortTimeMs: Number(item && item.sortTimeMs) || 0,
    }),
  );
}

export function getDerivedNotifications(s) {
  const now = Date.now();
  switch (s.roleKey) {
    case 'superuser':
      return [
        ...businessNotifications(s.businesses, now),
        ...(getActiveBusinessRecord(s) ? stockNotifications(s.inventory) : []),
      ];
    case 'admin':
      return [
        ...stockNotifications(s.inventory),
        ...deliveryNotifications(s.deliveries, now),
        ...codNotifications(s.orders, s.deliveries, now),
        ...returnNotifications(s.returns, now),
        ...couponNotifications(s.coupons, now),
        ...suspendedUserNotifications(s.users),
        ...businessNotifications(s.businesses, now).filter((n) => n.category === 'payments' || n.id.includes('renewal')),
      ];
    case 'cashier':
      return [
        ...stockNotifications(s.inventory, { outOfStockOnly: true }),
        ...returnNotifications(s.returns, now),
        ...couponNotifications(s.coupons, now),
      ];
    case 'inventorymanager':
      return stockNotifications(s.inventory);
    case 'deliveryops':
      return [...deliveryNotifications(s.deliveries, now), ...codNotifications(s.orders, s.deliveries, now)];
    case 'returnhandler':
      return returnNotifications(s.returns, now);
    case 'customer':
      return generateCustomerNotifications();
    default:
      return [];
  }
}

export function getActiveNotifications(s) {
  const state = loadNotificationState(s);
  const preferences = loadProfileSettingsRecord(s).notifications;
  return getDerivedNotifications(s)
    .filter((item) => preferences[item.category] !== false)
    .map((item) => {
      const hasSavedState = Object.prototype.hasOwnProperty.call(state.readMap, item.id);
      return { ...item, unread: hasSavedState ? !state.readMap[item.id] : Boolean(item.defaultUnread) };
    })
    .sort((a, b) => {
      if (b.priorityRank !== a.priorityRank) return b.priorityRank - a.priorityRank;
      return (b.sortTimeMs || 0) - (a.sortTimeMs || 0);
    });
}

export function resolveNotificationViewState(input) {
  const defaults = { status: 'all', category: 'all', sort: 'priority' };
  if (typeof input === 'string') {
    return { ...defaults, status: String(input || 'all').trim().toLowerCase() || 'all' };
  }
  if (!input || typeof input !== 'object') return defaults;
  return {
    status: String(input.status || defaults.status).trim().toLowerCase() || defaults.status,
    category: String(input.category || defaults.category).trim().toLowerCase() || defaults.category,
    sort: String(input.sort || defaults.sort).trim().toLowerCase() || defaults.sort,
  };
}
