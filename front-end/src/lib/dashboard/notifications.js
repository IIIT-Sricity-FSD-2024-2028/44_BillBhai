// Role-based notification generation + read state + profile settings record,
// ported from dashboard.js. Every function that read page globals takes the
// store state (`s`) as its first argument: { roleKey, orders, inventory,
// deliveries, returns, users, businesses, selectedBusiness, businessDataStore }.
import {
  AUTH_OVERRIDE_STORAGE_KEY,
  CUSTOMER_SESSION_NOTIFICATION_KEY,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_STATE_STORAGE_KEY,
  PROFILE_SETTINGS_STORAGE_KEY,
  ROLE_LABELS,
  ROLE_NOTIFICATION_CONFIG,
} from './constants.js';
import {
  buildBusinessSeedData,
  formatRelativeTime,
  getSupplierDetails,
  getDeliveryPartnerDetails,
  normalizeDeliveryStatus,
  normalizeInventoryStatus,
  normalizeOrderStatus,
  parseMonthEntry,
  parseOrderDate,
} from './helpers.js';
import { loadObject, saveObject } from './storage.js';

// ── Preferences ──────────────────────────────────────────────────────
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
  const normalizedCategory = String(category || '').trim().toLowerCase();
  const normalizedPriority = String(priority || '').trim().toLowerCase();
  if (normalizedPriority === 'critical') return 'red';
  if (normalizedCategory === 'payments') return 'green';
  if (normalizedCategory === 'inventory') return 'amber';
  if (normalizedCategory === 'delivery') return 'blue';
  if (normalizedCategory === 'returns') return 'amber';
  if (normalizedCategory === 'users' || normalizedCategory === 'businesses') return 'purple';
  return 'blue';
}

export function getNotificationIconKeyForCategory(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (normalized === 'payments') return 'payment';
  if (normalized === 'inventory') return 'alert';
  if (normalized === 'delivery') return 'delivery';
  if (normalized === 'returns') return 'return';
  if (normalized === 'users' || normalized === 'businesses') return 'user';
  return 'order';
}

/** getNotificationPriorityBadge(n) -> { text, type } for <Badge /> */
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
  const sortTimeMs = Number(safe.sortTimeMs) || Date.now();
  const detailRows = Array.isArray(safe.detailRows)
    ? safe.detailRows
      .map((row) => ({ label: String((row && row.label) || '').trim(), value: String((row && row.value) || '-').trim() || '-' }))
      .filter((row) => row.label)
    : [];

  return {
    id: String(safe.id || `notif-${Math.random().toString(36).slice(2)}`).trim(),
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

// ── Identity / profile settings ──────────────────────────────────────
export function getCurrentUserIdentity(s) {
  const currentUser = loadObject('currentUser', {});
  const username = String(currentUser.username || '').trim();
  const displayName = String(localStorage.getItem('userName') || currentUser.name || 'User').trim() || 'User';
  const roleLabel = ROLE_LABELS[s.roleKey] || 'Team Member';
  const email = username && username.includes('@') ? username : `${username || s.roleKey}@billbhai.com`;
  const key = (username || displayName.toLowerCase().replace(/\s+/g, '.')).trim();
  return { key, username, displayName, roleLabel, email };
}

export function loadProfileSettingsRecord(s) {
  const identity = getCurrentUserIdentity(s);
  const store = loadObject(PROFILE_SETTINGS_STORAGE_KEY, {});
  const saved = store[identity.key] && typeof store[identity.key] === 'object' ? store[identity.key] : {};
  return {
    key: identity.key,
    fullName: String(saved.fullName || identity.displayName).trim() || identity.displayName,
    email: String(saved.email || identity.email).trim() || identity.email,
    phone: String(saved.phone || '').trim(),
    location: String(saved.location || '').trim(),
    bio: String(saved.bio || '').trim(),
    language: String(saved.language || 'English (India)').trim(),
    currency: String(saved.currency || 'INR').trim(),
    timezone: String(saved.timezone || 'Asia/Kolkata').trim(),
    dateFormat: String(saved.dateFormat || 'DD/MM/YYYY').trim(),
    notifications: normalizeNotificationPreferences(saved.notifications, s.roleKey),
  };
}

/** Storage half of saveProfileSettingsRecord(). The store's
 *  saveProfileSettings() wraps this and also updates the header. */
export function writeProfileSettingsRecord(s, record) {
  const identity = getCurrentUserIdentity(s);
  const key = String(record.key || identity.key).trim() || identity.key;
  const store = loadObject(PROFILE_SETTINGS_STORAGE_KEY, {});
  store[key] = {
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    location: record.location,
    bio: record.bio,
    language: record.language,
    currency: record.currency,
    timezone: record.timezone,
    dateFormat: record.dateFormat,
    notifications: { ...record.notifications },
  };
  saveObject(PROFILE_SETTINGS_STORAGE_KEY, store);

  localStorage.setItem('userName', record.fullName);
  const currentUser = loadObject('currentUser', {});
  let newBusinessName = currentUser.businessName;
  if (record.location) {
    newBusinessName = record.location;
    localStorage.setItem('activeBusinessName', record.location);
  }
  saveObject('currentUser', { ...currentUser, name: record.fullName, email: record.email, businessName: newBusinessName });
}

export function updatePasswordOverrideForCurrentUser(s, newPassword) {
  const identity = getCurrentUserIdentity(s);
  if (!identity.username) return false;
  const overrides = loadObject(AUTH_OVERRIDE_STORAGE_KEY, {});
  overrides[identity.username] = { ...(overrides[identity.username] || {}), password: String(newPassword).trim() };
  saveObject(AUTH_OVERRIDE_STORAGE_KEY, overrides);
  return true;
}

// ── Read state ───────────────────────────────────────────────────────
export function getActiveBusinessRecord(s) {
  if (s.selectedBusiness) return s.selectedBusiness;
  const scopedId = String(localStorage.getItem('activeBusinessId') || '').trim();
  return s.businesses.find((item) => item.id === scopedId) || s.businesses[0] || null;
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

  const business = getActiveBusinessRecord(s);
  const businessScope = s.roleKey === 'superuser'
    ? 'all-businesses'
    : String((business && business.id) || localStorage.getItem('activeBusinessId') || 'global').trim();
  return `${s.roleKey}::${username}::${businessScope}`;
}

export function loadNotificationState(s) {
  const store = loadObject(NOTIFICATION_STATE_STORAGE_KEY, {});
  const key = getNotificationAudienceKey(s);
  const saved = store[key] && typeof store[key] === 'object' ? store[key] : {};
  const readMap = saved.readMap && typeof saved.readMap === 'object' && !Array.isArray(saved.readMap) ? saved.readMap : {};
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
    if (!safeId) return;
    state.readMap[safeId] = Boolean(isRead);
  });
  saveNotificationState(s, state);
}

export function loadCustomerSessionNotifications() {
  try {
    const raw = sessionStorage.getItem(CUSTOMER_SESSION_NOTIFICATION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

// ── Record builders ──────────────────────────────────────────────────
function rs(n) {
  return `Rs ${Math.max(0, Number(n || 0)).toLocaleString()}`;
}

function getBusinessDataForNotifications(s, business, fallbackIndex) {
  const idx = Number(fallbackIndex) || 0;
  const seed = buildBusinessSeedData(business, idx);
  const store = s.businessDataStore || {};
  const source = store[business.id] && typeof store[business.id] === 'object' ? store[business.id] : seed;
  return {
    orders: Array.isArray(source.orders) ? source.orders : seed.orders,
    inventory: Array.isArray(source.inventory) ? source.inventory : seed.inventory,
    deliveries: Array.isArray(source.deliveries) ? source.deliveries : seed.deliveries,
    returns: Array.isArray(source.returns) ? source.returns : seed.returns,
    users: Array.isArray(source.users) ? source.users : seed.users,
  };
}

export function getNotificationContexts(s) {
  if (s.roleKey === 'superuser') {
    return s.businesses.map((business, index) => ({ business, data: getBusinessDataForNotifications(s, business, index) }));
  }
  const business = getActiveBusinessRecord(s);
  if (!business) return [];
  return [{ business, data: { orders: s.orders, inventory: s.inventory, deliveries: s.deliveries, returns: s.returns, users: s.users } }];
}

export function createOrderNotification(order, business, category, priority) {
  const parsed = parseOrderDate(order && order.date);
  const status = normalizeOrderStatus(order && order.status);
  return makeNotificationRecord({
    id: `order:${business ? business.id : 'global'}:${order.id}:${status}`,
    category: category || 'orders',
    priority: priority || (status === 'Cancelled' ? 'high' : (status === 'Pending' ? 'medium' : 'low')),
    title: `${order.id} is ${status.toLowerCase()}`,
    desc: `${order.customer} • ${rs(order.total)} • ${order.payment || 'Pending payment'}`,
    sortTimeMs: parsed ? parsed.getTime() : Date.now(),
    detailRows: [
      { label: 'Business', value: business ? business.name : '-' },
      { label: 'Order', value: String(order.id || '-') },
      { label: 'Customer', value: String(order.customer || '-') },
      { label: 'Status', value: status },
      { label: 'Payment', value: String(order.payment || 'Pending') },
      { label: 'Total', value: rs(order.total) },
    ],
  });
}

export function createPaymentNotification(source, business, fallbackIndex) {
  if (source && source.id && source.customer) {
    const parsed = parseOrderDate(source && source.date);
    return makeNotificationRecord({
      id: `payment:${business ? business.id : 'global'}:${source.id}:${source.payment || 'pending'}`,
      category: 'payments',
      priority: String(source.payment || '').trim().toLowerCase() === 'pending' ? 'high' : 'low',
      title: `Payment update for ${source.id}`,
      desc: `${source.customer} paid via ${source.payment || 'Pending'} for ${rs(source.total)}.`,
      sortTimeMs: parsed ? parsed.getTime() : Date.now() - (Number(fallbackIndex) || 0) * 1000,
      detailRows: [
        { label: 'Business', value: business ? business.name : '-' },
        { label: 'Order', value: String(source.id || '-') },
        { label: 'Customer', value: String(source.customer || '-') },
        { label: 'Mode', value: String(source.payment || 'Pending') },
        { label: 'Amount', value: rs(source.total) },
      ],
    });
  }

  const monthLabel = String((source && source.month) || 'Current cycle').trim();
  const status = String((source && source.status) || 'Due').trim();
  const amount = Math.max(0, Number((source && source.amount) || (business && business.paymentDue) || 0));
  return makeNotificationRecord({
    id: `payment:${business ? business.id : 'global'}:${monthLabel}:${status}:${amount}`,
    category: 'payments',
    priority: status.toLowerCase() === 'paid' ? 'low' : 'high',
    title: `${business ? business.name : 'Business'} billing is ${status.toLowerCase()}`,
    desc: `${monthLabel} billing cycle shows Rs ${amount.toLocaleString()} as ${status.toLowerCase()}.`,
    sortTimeMs: parseMonthEntry(monthLabel, fallbackIndex),
    detailRows: [
      { label: 'Business', value: business ? business.name : '-' },
      { label: 'Billing Cycle', value: monthLabel },
      { label: 'Amount', value: `Rs ${amount.toLocaleString()}` },
      { label: 'Status', value: status },
      { label: 'Plan', value: String((business && business.productsPlan) || '-') },
    ],
  });
}

export function createInventoryNotification(item, business, fallbackIndex) {
  const status = normalizeInventoryStatus(item && item.status, item && item.stock);
  const supplier = getSupplierDetails(item);
  const stock = Math.max(0, Number(item && item.stock) || 0);
  const priority = status === 'Out of Stock' || status === 'Critical' ? 'critical' : (status === 'Low Stock' ? 'high' : 'low');
  return makeNotificationRecord({
    id: `inventory:${business ? business.id : 'global'}:${item.sku}:${status}:${stock}`,
    category: 'inventory',
    priority,
    title: `${status}: ${item.name}`,
    desc: `${item.sku} is at ${stock} units. Supplier ${supplier.name} needs ${supplier.leadTimeDays} day${supplier.leadTimeDays === 1 ? '' : 's'} lead time.`,
    sortTimeMs: Date.now() - (Number(fallbackIndex) || 0) * 60000,
    detailRows: [
      { label: 'Business', value: business ? business.name : '-' },
      { label: 'SKU', value: String(item.sku || '-') },
      { label: 'Product', value: String(item.name || '-') },
      { label: 'Category', value: String(item.cat || '-') },
      { label: 'Stock', value: String(stock) },
      { label: 'Status', value: status },
      { label: 'Supplier', value: supplier.name },
      { label: 'Lead Time', value: `${supplier.leadTimeDays} days` },
    ],
  });
}

export function createDeliveryNotification(item, business, fallbackIndex) {
  const partner = getDeliveryPartnerDetails(item);
  const status = normalizeDeliveryStatus(item && item.status);
  const parsed = parseOrderDate(item && (item.updatedAt || item.time));
  const priority = status === 'Failed' || partner.name === 'Unassigned'
    ? 'critical'
    : (status === 'Pending' ? 'high' : (status === 'In Transit' ? 'medium' : 'low'));
  return makeNotificationRecord({
    id: `delivery:${business ? business.id : 'global'}:${item.id}:${status}:${partner.name}`,
    category: 'delivery',
    priority,
    title: `${item.id} is ${status.toLowerCase()}`,
    desc: `${item.customer} • ${partner.name} • ${item.address || 'Address pending'}`,
    sortTimeMs: parsed ? parsed.getTime() : Date.now() - (Number(fallbackIndex) || 0) * 1000,
    detailRows: [
      { label: 'Business', value: business ? business.name : '-' },
      { label: 'Delivery', value: String(item.id || '-') },
      { label: 'Order', value: String(item.oid || '-') },
      { label: 'Customer', value: String(item.customer || '-') },
      { label: 'Status', value: status },
      { label: 'Partner', value: partner.name },
      { label: 'Partner Phone', value: partner.phone },
      { label: 'ETA', value: item.etaMin === null ? '-' : `${Math.max(0, Math.round(item.etaMin))} min` },
      { label: 'Address', value: String(item.address || '-') },
    ],
  });
}

export function createReturnNotification(item, business, fallbackIndex) {
  const parsed = parseOrderDate(item && item.updatedAt);
  const status = String((item && item.status) || 'Pending').trim() || 'Pending';
  const priority = status.toLowerCase().includes('pending') ? 'high' : (status.toLowerCase().includes('approve') ? 'medium' : 'low');
  return makeNotificationRecord({
    id: `return:${business ? business.id : 'global'}:${item.id}:${status}`,
    category: 'returns',
    priority,
    title: `${item.id} is ${status.toLowerCase()}`,
    desc: `${item.product} for ${item.customer} • ${item.reason} • ${rs(item.amount)}`,
    sortTimeMs: parsed ? parsed.getTime() : Date.now() - (Number(fallbackIndex) || 0) * 1000,
    detailRows: [
      { label: 'Business', value: business ? business.name : '-' },
      { label: 'Return', value: String(item.id || '-') },
      { label: 'Order', value: String(item.oid || '-') },
      { label: 'Customer', value: String(item.customer || '-') },
      { label: 'Product', value: String(item.product || '-') },
      { label: 'Reason', value: String(item.reason || '-') },
      { label: 'Status', value: status },
      { label: 'Requested By', value: String(item.requestedBy || '-') },
      { label: 'Amount', value: rs(item.amount) },
    ],
  });
}

export function createBusinessNotification(business, fallbackIndex) {
  return makeNotificationRecord({
    id: `business:${business.id}:${business.status}:${business.paymentDue || 0}`,
    category: 'businesses',
    priority: String(business.status || '').toLowerCase() === 'active' ? 'low' : 'high',
    title: `${business.name} is ${String(business.status || 'Active').toLowerCase()}`,
    desc: `${business.productsPlan || 'Plan pending'} • ${business.storesCount || 0} stores • ${rs(business.paymentDue)} due`,
    sortTimeMs: Date.now() - (Number(fallbackIndex) || 0) * 120000,
    detailRows: [
      { label: 'Business', value: business.name },
      { label: 'Owner', value: String(business.owner || '-') },
      { label: 'Status', value: String(business.status || '-') },
      { label: 'Plan', value: String(business.productsPlan || '-') },
      { label: 'Stores', value: String(business.storesCount || 0) },
      { label: 'Payment Due', value: rs(business.paymentDue) },
    ],
  });
}

export function createUserSummaryNotification(business, userRows, fallbackIndex) {
  const rows = Array.isArray(userRows) ? userRows : [];
  const activeCount = rows.filter((item) => String((item && item.status) || '').trim().toLowerCase() === 'active').length;
  const inactiveCount = Math.max(0, rows.length - activeCount);
  return makeNotificationRecord({
    id: `users:${business ? business.id : 'global'}:${activeCount}:${inactiveCount}`,
    category: 'users',
    priority: inactiveCount ? 'high' : 'low',
    title: `${business ? business.name : 'Team'} roster snapshot`,
    desc: `${activeCount} active staff${inactiveCount ? `, ${inactiveCount} inactive` : ''}.`,
    sortTimeMs: Date.now() - (Number(fallbackIndex) || 0) * 240000,
    detailRows: [
      { label: 'Business', value: business ? business.name : '-' },
      { label: 'Total Team Members', value: String(rows.length) },
      { label: 'Active', value: String(activeCount) },
      { label: 'Inactive', value: String(inactiveCount) },
    ],
  });
}

export function createSummaryNotification(title, desc, detailRows, priority, fallbackIndex) {
  return makeNotificationRecord({
    id: `summary:${title.replace(/\s+/g, '-').toLowerCase()}`,
    category: 'summary',
    priority: priority || 'low',
    title,
    desc,
    sortTimeMs: Date.now() - (Number(fallbackIndex) || 0) * 300000,
    detailRows: Array.isArray(detailRows) ? detailRows : [],
  });
}

const byOrderDateDesc = (a, b) => (parseOrderDate(b && b.date)?.getTime() || 0) - (parseOrderDate(a && a.date)?.getTime() || 0);
const byUpdatedAtDesc = (a, b) => (parseOrderDate(b && b.updatedAt)?.getTime() || 0) - (parseOrderDate(a && a.updatedAt)?.getTime() || 0);
const byStockAsc = (a, b) => Math.max(0, Number((a && a.stock) || 0)) - Math.max(0, Number((b && b.stock) || 0));

// ── Per-role generators ──────────────────────────────────────────────
export function generateSuperuserNotifications(s) {
  const contexts = getNotificationContexts(s);
  const list = [];
  let activeBusinesses = 0;
  let dueAmountTotal = 0;

  contexts.forEach((context, index) => {
    const { business, data } = context;
    if (String(business.status || '').trim().toLowerCase() === 'active') activeBusinesses += 1;
    dueAmountTotal += Math.max(0, Number(business.paymentDue || 0));

    list.push(createBusinessNotification(business, index));
    if (Number(business.paymentDue || 0) > 0) {
      list.push(createPaymentNotification({ month: 'Current billing cycle', amount: business.paymentDue, status: 'Due' }, business, index));
    }
    if (Array.isArray(business.payments)) {
      business.payments
        .filter((payment) => String(payment.status || '').trim().toLowerCase() !== 'paid')
        .slice(0, 2)
        .forEach((payment, paymentIndex) => list.push(createPaymentNotification(payment, business, (index * 5) + paymentIndex)));
    }

    list.push(createUserSummaryNotification(business, data.users, index));

    data.orders.slice().sort(byOrderDateDesc).slice(0, 2)
      .forEach((order) => list.push(createOrderNotification(order, business, 'orders', 'medium')));

    data.inventory
      .filter((item) => normalizeInventoryStatus(item && item.status, item && item.stock) !== 'In Stock')
      .sort(byStockAsc)
      .slice(0, 2)
      .forEach((item, itemIndex) => list.push(createInventoryNotification(item, business, (index * 2) + itemIndex)));

    const deliveryRows = (Array.isArray(data.deliveries) ? data.deliveries : [])
      .map((item) => {
        const order = (Array.isArray(data.orders) ? data.orders : []).find((orderRow) => orderRow.id === item.oid);
        return { ...item, customer: String(item.customer || (order && order.customer) || '').trim() || '-' };
      })
      .filter((item) => {
        const status = normalizeDeliveryStatus(item && item.status);
        const partner = String((item && item.partner) || '').trim() || 'Unassigned';
        return status !== 'Delivered' || partner === 'Unassigned';
      })
      .slice(0, 2);
    deliveryRows.forEach((item, itemIndex) => list.push(createDeliveryNotification(item, business, (index * 2) + itemIndex)));

    const returnRows = (Array.isArray(data.returns) ? data.returns : [])
      .map((item) => {
        const order = (Array.isArray(data.orders) ? data.orders : []).find((orderRow) => orderRow.id === item.oid);
        return { ...item, customer: String((order && order.customer) || '').trim() || '-' };
      })
      .filter((item) => String(item.status || '').trim().toLowerCase().includes('pending'))
      .slice(0, 2);
    returnRows.forEach((item, itemIndex) => list.push(createReturnNotification(item, business, (index * 2) + itemIndex)));
  });

  list.push(createSummaryNotification(
    'Portfolio snapshot',
    `${contexts.length} businesses tracked, ${activeBusinesses} active, Rs ${dueAmountTotal.toLocaleString()} due.`,
    [
      { label: 'Total Businesses', value: String(contexts.length) },
      { label: 'Active Businesses', value: String(activeBusinesses) },
      { label: 'Outstanding Due', value: `Rs ${dueAmountTotal.toLocaleString()}` },
    ],
    dueAmountTotal > 0 ? 'high' : 'low',
    0
  ));
  return list;
}

export function generateAdminNotifications(s) {
  const context = getNotificationContexts(s)[0];
  if (!context) return [];
  const { business, data } = context;
  const list = [];
  const inventoryAlerts = data.inventory.filter((item) => normalizeInventoryStatus(item && item.status, item && item.stock) !== 'In Stock');
  const activeDeliveries = data.deliveries.filter((item) => {
    const status = normalizeDeliveryStatus(item && item.status);
    return status === 'Pending' || status === 'In Transit' || status === 'Failed';
  });
  const pendingReturns = data.returns.filter((item) => String((item && item.status) || '').trim().toLowerCase().includes('pending')).length;

  list.push(createSummaryNotification(
    `${business.name} operations snapshot`,
    `${data.orders.length} orders, ${inventoryAlerts.length} stock alerts, ${activeDeliveries.length} active deliveries, ${pendingReturns} pending returns.`,
    [
      { label: 'Business', value: business.name },
      { label: 'Orders', value: String(data.orders.length) },
      { label: 'Inventory Alerts', value: String(inventoryAlerts.length) },
      { label: 'Active Deliveries', value: String(activeDeliveries.length) },
      { label: 'Pending Returns', value: String(pendingReturns) },
    ],
    (inventoryAlerts.length || activeDeliveries.length || pendingReturns) ? 'high' : 'low',
    0
  ));

  if (Number(business.paymentDue || 0) > 0) {
    list.push(createPaymentNotification({ month: 'Current billing cycle', amount: business.paymentDue, status: 'Due' }, business, 0));
  }

  data.orders.slice().sort(byOrderDateDesc).slice(0, 8)
    .forEach((order, index) => list.push(createOrderNotification(order, business, 'orders', index < 3 ? 'medium' : 'low')));

  data.orders.slice().sort(byOrderDateDesc).slice(0, 4)
    .forEach((order, index) => list.push(createPaymentNotification(order, business, index)));

  inventoryAlerts.sort(byStockAsc).slice(0, 8)
    .forEach((item, index) => list.push(createInventoryNotification(item, business, index)));

  activeDeliveries.slice(0, 8).forEach((item, index) => {
    const order = data.orders.find((orderRow) => orderRow.id === item.oid);
    list.push(createDeliveryNotification({ ...item, customer: String(item.customer || (order && order.customer) || '').trim() || '-' }, business, index));
  });

  data.returns.slice().sort(byUpdatedAtDesc).slice(0, 8).forEach((item, index) => {
    const order = data.orders.find((orderRow) => orderRow.id === item.oid);
    list.push(createReturnNotification({ ...item, customer: String((order && order.customer) || '').trim() || '-' }, business, index));
  });

  list.push(createUserSummaryNotification(business, data.users, 0));
  return list;
}

export function generateCashierNotifications(s) {
  const context = getNotificationContexts(s)[0];
  if (!context) return [];
  const { business, data } = context;
  const list = [];

  data.orders.slice().sort(byOrderDateDesc).slice(0, 6)
    .forEach((order, index) => list.push(createOrderNotification(order, business, 'orders', index < 2 ? 'medium' : 'low')));

  data.orders.slice().sort(byOrderDateDesc).slice(0, 4)
    .forEach((order, index) => list.push(createPaymentNotification(order, business, index)));

  data.returns
    .filter((item) => {
      const status = String((item && item.status) || '').trim().toLowerCase();
      return status.includes('approve') || status.includes('refund') || status.includes('reject');
    })
    .slice(0, 6)
    .forEach((item, index) => {
      const order = data.orders.find((orderRow) => orderRow.id === item.oid);
      list.push(createReturnNotification({ ...item, customer: String((order && order.customer) || '').trim() || '-' }, business, index));
    });
  return list;
}

export function generateInventoryManagerNotifications(s) {
  const context = getNotificationContexts(s)[0];
  if (!context) return [];
  const { business } = context;
  const alerts = context.data.inventory
    .filter((item) => normalizeInventoryStatus(item && item.status, item && item.stock) !== 'In Stock')
    .sort(byStockAsc);
  const list = [
    createSummaryNotification(
      `${business.name} stock snapshot`,
      `${alerts.length} SKUs need attention in inventory.`,
      [
        { label: 'Business', value: business.name },
        { label: 'SKUs needing action', value: String(alerts.length) },
      ],
      alerts.length ? 'high' : 'low',
      0
    ),
  ];
  alerts.slice(0, 10).forEach((item, index) => list.push(createInventoryNotification(item, business, index)));
  return list;
}

export function generateDeliveryOpsNotifications(s) {
  const context = getNotificationContexts(s)[0];
  if (!context) return [];
  const { business } = context;
  const activeRows = context.data.deliveries
    .map((item) => {
      const order = context.data.orders.find((orderRow) => orderRow.id === item.oid);
      return { ...item, customer: String(item.customer || (order && order.customer) || '').trim() || '-' };
    })
    .sort((a, b) => (parseOrderDate(b && (b.updatedAt || b.time))?.getTime() || 0) - (parseOrderDate(a && (a.updatedAt || a.time))?.getTime() || 0));

  const actionable = activeRows.filter((item) => {
    const status = normalizeDeliveryStatus(item && item.status);
    const partner = String((item && item.partner) || '').trim() || 'Unassigned';
    return status !== 'Delivered' || partner === 'Unassigned';
  });

  const list = [
    createSummaryNotification(
      `${business.name} delivery queue`,
      `${actionable.length} deliveries still need active attention.`,
      [
        { label: 'Business', value: business.name },
        { label: 'Actionable Deliveries', value: String(actionable.length) },
      ],
      actionable.length ? 'high' : 'low',
      0
    ),
  ];
  actionable.slice(0, 10).forEach((item, index) => list.push(createDeliveryNotification(item, business, index)));
  return list;
}

export function generateReturnHandlerNotifications(s) {
  const context = getNotificationContexts(s)[0];
  if (!context) return [];
  const { business } = context;
  const rows = context.data.returns
    .map((item) => {
      const order = context.data.orders.find((orderRow) => orderRow.id === item.oid);
      return { ...item, customer: String((order && order.customer) || '').trim() || '-' };
    })
    .sort(byUpdatedAtDesc);

  const pendingCount = rows.filter((item) => String(item.status || '').trim().toLowerCase().includes('pending')).length;
  const list = [
    createSummaryNotification(
      `${business.name} returns desk`,
      `${pendingCount} returns are still pending review.`,
      [
        { label: 'Business', value: business.name },
        { label: 'Pending Returns', value: String(pendingCount) },
        { label: 'Total Returns', value: String(rows.length) },
      ],
      pendingCount ? 'high' : 'low',
      0
    ),
  ];
  rows.slice(0, 10).forEach((item, index) => list.push(createReturnNotification(item, business, index)));
  return list;
}

export function generateCustomerNotifications() {
  return loadCustomerSessionNotifications().map((item, index) => makeNotificationRecord({
    ...item,
    id: String((item && item.id) || `customer-session-${index + 1}`).trim(),
    category: String((item && item.category) || 'orders').trim().toLowerCase(),
    priority: String((item && item.priority) || 'medium').trim().toLowerCase(),
    sortTimeMs: Number(item && item.sortTimeMs) || Date.now() - index * 1000,
    detailRows: Array.isArray(item && item.detailRows) ? item.detailRows : [],
  }));
}

export function getDerivedNotifications(s) {
  if (s.roleKey === 'superuser') return generateSuperuserNotifications(s);
  if (s.roleKey === 'admin') return generateAdminNotifications(s);
  if (s.roleKey === 'cashier') return generateCashierNotifications(s);
  if (s.roleKey === 'inventorymanager') return generateInventoryManagerNotifications(s);
  if (s.roleKey === 'deliveryops') return generateDeliveryOpsNotifications(s);
  if (s.roleKey === 'returnhandler') return generateReturnHandlerNotifications(s);
  if (s.roleKey === 'customer') return generateCustomerNotifications(s);
  return [];
}

/** getActiveNotifications(): derived list filtered by preferences, with
 *  `unread`, sorted by priority then time. */
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

/** resolveNotificationViewState(input) used by the notifications page. */
export function resolveNotificationViewState(input) {
  const defaults = { status: 'all', category: 'all', sort: 'priority' };
  if (typeof input === 'string') return { ...defaults, status: String(input || 'all').trim().toLowerCase() || 'all' };
  if (!input || typeof input !== 'object') return defaults;
  return {
    status: String(input.status || defaults.status).trim().toLowerCase() || defaults.status,
    category: String(input.category || defaults.category).trim().toLowerCase() || defaults.category,
    sort: String(input.sort || defaults.sort).trim().toLowerCase() || defaults.sort,
  };
}
