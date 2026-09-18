// Pure helpers ported from dashboard.js. Functions that read the page-level
// collections in the original (orders, inventory, ...) take them as arguments.
import {
  DELIVERY_PARTNER_DIRECTORY,
  EMAIL_PATTERN,
  PHONE_PATTERN,
  SUPPLIER_DIRECTORY,
} from './constants.js';

// ── badge() / statusBadge() class names ──────────────────────────────
/** CSS class for badge(txt, type): `badge b-<type>` */
export function badgeClass(txt, type) {
  const safeType = String(type || txt || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `badge b-${safeType || 'default'}`;
}

/** statusBadge(s) uses type = s.toLowerCase() without spaces. */
export function statusBadgeType(status) {
  return status.toLowerCase().replace(/ /g, '');
}

export function cloneRows(rows) {
  return JSON.parse(JSON.stringify(rows));
}

export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Status normalisation ─────────────────────────────────────────────
export function normalizeDeliveryStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return 'Pending';
  if (raw.includes('deliver')) return 'Delivered';
  if (raw.includes('out for') || raw.includes('transit') || raw.includes('dispatch') || raw.includes('processing')) return 'In Transit';
  if (raw.includes('fail') || raw.includes('cancel')) return 'Failed';
  if (raw.includes('pending')) return 'Pending';
  return 'Pending';
}

export function normalizeOrderStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return 'Pending';
  if (raw.includes('deliver')) return 'Delivered';
  if (raw.includes('process') || raw.includes('transit') || raw.includes('dispatch')) return 'Processing';
  if (raw.includes('cancel') || raw.includes('fail')) return 'Cancelled';
  if (raw.includes('pending')) return 'Pending';
  return 'Pending';
}

export function normalizeInventoryStatus(status, stockValue) {
  const stock = Number.isFinite(Number(stockValue)) ? Number(stockValue) : 0;
  const raw = String(status || '').trim().toLowerCase();
  if (raw.includes('out')) return 'Out of Stock';
  if (raw.includes('critical')) return 'Critical';
  if (raw.includes('low')) return 'Low Stock';
  if (raw.includes('in stock') || raw.includes('available') || raw.includes('active')) {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= 10) return 'Critical';
    if (stock <= 30) return 'Low Stock';
    return 'In Stock';
  }
  if (stock <= 0) return 'Out of Stock';
  if (stock <= 10) return 'Critical';
  if (stock <= 30) return 'Low Stock';
  return 'In Stock';
}

/** deliveryBadge(status) -> { text, type } for <Badge text type /> */
export function deliveryBadgeProps(status) {
  const normalized = normalizeDeliveryStatus(status);
  if (normalized === 'Delivered') return { text: 'Delivered', type: 'delivered' };
  if (normalized === 'In Transit') return { text: 'In Transit', type: 'processing' };
  if (normalized === 'Failed') return { text: 'Failed', type: 'cancelled' };
  return { text: 'Pending', type: 'pending' };
}

// ── Metrics ──────────────────────────────────────────────────────────
export function getInventoryMetrics(inventory) {
  const list = Array.isArray(inventory) ? inventory : [];
  const metrics = { totalSkus: list.length, totalUnits: 0, inStock: 0, lowStock: 0, critical: 0, outOfStock: 0, alerts: 0 };
  list.forEach((item) => {
    const stock = Math.max(0, Number(item && item.stock) || 0);
    const status = normalizeInventoryStatus(item && item.status, stock);
    metrics.totalUnits += stock;
    if (status === 'Out of Stock') metrics.outOfStock += 1;
    else if (status === 'Critical') metrics.critical += 1;
    else if (status === 'Low Stock') metrics.lowStock += 1;
    else metrics.inStock += 1;
  });
  metrics.alerts = metrics.lowStock + metrics.critical + metrics.outOfStock;
  return metrics;
}

export function getInventoryCategoryCounts(inventory) {
  const categoryMap = new Map();
  (inventory || []).forEach((item) => {
    const category = String((item && item.cat) || '').trim() || 'Uncategorized';
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  });
  const entries = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { labels: ['No data'], values: [0] };
  return { labels: entries.map(([label]) => label), values: entries.map(([, value]) => value) };
}

export function getDashboardStatusMetrics({ orders, returns, inventory }) {
  const deliveredOrders = orders.filter((o) => normalizeOrderStatus(o && o.status) === 'Delivered').length;
  const openOrders = orders.length - deliveredOrders;
  return {
    deliveredOrders,
    openOrders: Math.max(0, openOrders),
    totalReturns: returns.length,
    alertCount: getInventoryMetrics(inventory).alerts,
  };
}

// ── Dates ────────────────────────────────────────────────────────────
export function parseOrderDate(dateText) {
  const raw = String(dateText || '').trim();
  if (!raw) return null;

  const nativeParsed = new Date(raw);
  if (!Number.isNaN(nativeParsed.getTime())) return nativeParsed;

  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const monthLabel = match[2].slice(0, 3).toLowerCase();
  const monthMap = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const month = monthMap[monthLabel];
  if (month === undefined) return null;

  const hours = Number(match[3]);
  const minutes = Number(match[4]);
  const now = new Date();
  const inferred = new Date(now.getFullYear(), month, day, hours, minutes, 0, 0);
  if (inferred.getTime() > now.getTime() + 1000 * 60 * 60 * 24) {
    inferred.setFullYear(inferred.getFullYear() - 1);
  }
  return inferred;
}

export function startOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function startOfWeek(date) {
  const week = startOfDay(date);
  const day = week.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  week.setDate(week.getDate() + diff);
  return week;
}

export function getOrderTimelineEntries(orders) {
  return (orders || [])
    .map((order) => {
      const parsed = parseOrderDate(order && order.date);
      if (!parsed) return null;
      return { date: parsed, total: Math.max(0, Number(order && order.total) || 0) };
    })
    .filter(Boolean);
}

export function buildRevenueTrendDays(orders, dayCount) {
  const count = Math.max(1, Number(dayCount) || 7);
  const now = startOfDay(new Date());
  const labels = [];
  const values = [];
  const totalsByDay = new Map();
  const timelineEntries = getOrderTimelineEntries(orders);

  timelineEntries.forEach((entry) => {
    const key = startOfDay(entry.date).toISOString().slice(0, 10);
    totalsByDay.set(key, (totalsByDay.get(key) || 0) + entry.total);
  });

  let anchorDay = new Date(now);
  if (timelineEntries.length) {
    const currentWindowStart = new Date(now);
    currentWindowStart.setDate(now.getDate() - (count - 1));
    const hasRecentData = timelineEntries.some((entry) => startOfDay(entry.date).getTime() >= currentWindowStart.getTime());
    if (!hasRecentData) {
      anchorDay = startOfDay(
        timelineEntries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), timelineEntries[0].date)
      );
    }
  }

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(anchorDay);
    day.setDate(anchorDay.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    labels.push(day.toLocaleDateString('en-US', { weekday: 'short' }));
    values.push(Math.round(totalsByDay.get(key) || 0));
  }
  return { labels, values };
}

export function buildRevenueTrendWeeks(orders, weekCount) {
  const count = Math.max(1, Number(weekCount) || 4);
  const timelineEntries = getOrderTimelineEntries(orders);
  const totalsByWeek = new Map();

  timelineEntries.forEach((entry) => {
    const key = startOfWeek(entry.date).toISOString().slice(0, 10);
    totalsByWeek.set(key, (totalsByWeek.get(key) || 0) + entry.total);
  });

  let anchorWeek = startOfWeek(new Date());
  if (timelineEntries.length) {
    anchorWeek = startOfWeek(
      timelineEntries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), timelineEntries[0].date)
    );
  }

  const labels = [];
  const values = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const weekStart = new Date(anchorWeek);
    weekStart.setDate(anchorWeek.getDate() - offset * 7);
    const key = weekStart.toISOString().slice(0, 10);
    labels.push(weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    values.push(Math.round(totalsByWeek.get(key) || 0));
  }
  return { labels, values };
}

/** formatDate(): "18 Sep 14:05" for now. */
export function formatDate() {
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = now.getDate();
  const m = months[now.getMonth()];
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${d} ${m} ${h}:${min}`;
}

export function formatBackendDate(value) {
  if (!value) return formatDate();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  return `${parsed.getDate()} ${months[parsed.getMonth()]} ${hh}:${mm}`;
}

export function formatRelativeTime(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Current snapshot';
  const diffMs = Math.max(0, Date.now() - numeric);
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function parseMonthEntry(monthLabel, fallbackIndex) {
  const raw = String(monthLabel || '').trim();
  if (!raw) return Date.now() - (Number(fallbackIndex) || 0) * 86400000;
  const parsed = new Date(`01 ${raw}`);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  return Date.now() - (Number(fallbackIndex) || 0) * 86400000;
}

// ── Id generators ────────────────────────────────────────────────────
/** getNextOrderId(). `extraIds` replaces the original scan of #ordersTableBody. */
export function getNextOrderId(orders, extraIds = []) {
  const nums = orders.map((o) => parseInt(o.id.replace('ORD-', ''), 10));
  extraIds.forEach((id) => {
    const match = String(id).match(/ORD-(\d+)/);
    if (match) nums.push(parseInt(match[1], 10));
  });
  const next = Math.max(...nums) + 1;
  return `ORD-${next}`;
}

export function getNextReturnId(returns) {
  const nums = returns
    .map((r) => parseInt(String(r.id || '').replace('RET-', ''), 10))
    .filter((n) => !Number.isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 200;
  return `RET-${next}`;
}

/** getNextSku(). `extraSkus` replaces the original scan of #inventoryTableBody. */
export function getNextSku(inventory, extraSkus = []) {
  const nums = inventory.map((i) => parseInt(i.sku.replace('SKU-', ''), 10));
  extraSkus.forEach((sku) => {
    const match = String(sku).match(/SKU-(\d+)/);
    if (match) nums.push(parseInt(match[1], 10));
  });
  const next = Math.max(...nums) + 1;
  return `SKU-${String(next).padStart(2, '0')}`;
}

export function determineStatus(stock, selectedStatus) {
  if (selectedStatus !== 'In Stock') return selectedStatus;
  if (stock <= 0) return 'Out of Stock';
  if (stock <= 10) return 'Critical';
  if (stock <= 30) return 'Low Stock';
  return 'In Stock';
}

// ── Validation ───────────────────────────────────────────────────────
export function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeEditablePhone(value) {
  const digits = normalizePhoneDigits(value);
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

export function isValidEmailAddress(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

export function isValidPhoneNumber(value) {
  return PHONE_PATTERN.test(normalizePhoneDigits(value));
}

// ── Views ────────────────────────────────────────────────────────────
export function getDeliveryPartnerDetails(item) {
  const partnerName = String((item && item.partner) || '').trim();
  const directory = DELIVERY_PARTNER_DIRECTORY[partnerName] || {};
  const phoneRaw = String((item && item.partnerPhone) || directory.phone || '').trim();
  const normalizedPhone = phoneRaw.replace(/[^\d+]/g, '');
  return {
    name: partnerName || 'Unassigned',
    phone: phoneRaw || 'Not available',
    phoneHref: normalizedPhone && normalizedPhone !== '+'
      ? `tel:${normalizedPhone.startsWith('+') ? normalizedPhone : `+91${normalizedPhone}`}`
      : '',
    agency: String((item && item.partnerAgency) || directory.agency || 'External partner').trim(),
    vehicle: String((item && item.partnerVehicle) || directory.vehicle || 'Bike').trim(),
    coverage: String((item && item.partnerCoverage) || directory.coverage || 'City zone').trim(),
  };
}

export function getDeliveryView({ deliveries, orders }) {
  return deliveries.map((d) => {
    const order = orders.find((o) => o.id === d.oid);
    const customer = String(d.customer || (order ? order.customer : '') || '').trim() || '-';
    const partnerDetails = getDeliveryPartnerDetails(d);
    return {
      id: d.id,
      oid: d.oid,
      customer,
      address: String(d.address || '').trim() || '-',
      partner: partnerDetails.name,
      partnerPhone: partnerDetails.phone,
      partnerPhoneHref: partnerDetails.phoneHref,
      partnerAgency: partnerDetails.agency,
      partnerVehicle: partnerDetails.vehicle,
      partnerCoverage: partnerDetails.coverage,
      status: normalizeDeliveryStatus(d.status),
      etaMin: Number.isFinite(Number(d.etaMin)) ? Number(d.etaMin) : null,
      updatedAt: String(d.updatedAt || d.time || '-').trim() || '-',
    };
  });
}

export function getReturnView({ returns, orders }) {
  return returns.map((r) => {
    const order = orders.find((o) => o.id === r.oid);
    const customer = String((order && order.customer) || '').trim() || '-';
    const product = String(r.product || '').trim() || '-';
    const qty = Number.isFinite(Number(r.qty)) ? Math.max(1, Number(r.qty)) : null;
    const amount = Number.isFinite(Number(r.amount)) ? Math.max(0, Number(r.amount)) : 0;
    const rawStatus = String(r.status || 'Pending').trim() || 'Pending';
    const status = /approve/i.test(rawStatus) ? 'Pending' : rawStatus;
    const reason = String(r.reason || 'Unknown').trim() || 'Unknown';
    const requestedBy = String(r.requestedBy || '').trim() || '-';
    const updatedAt = String(r.updatedAt || '-').trim() || '-';
    return {
      id: String(r.id || '').trim() || 'RET-NA',
      oid: String(r.oid || '').trim() || '-',
      customer,
      product,
      qty,
      reason,
      amount,
      status,
      requestedBy,
      updatedAt,
    };
  });
}

export function getSupplierDetails(item) {
  const supplierName = String((item && item.supplier) || '').trim() || 'Unknown Supplier';
  const meta = item && item.supplierDetails && typeof item.supplierDetails === 'object' ? item.supplierDetails : {};
  const directory = SUPPLIER_DIRECTORY[supplierName] || {};
  return {
    name: supplierName,
    contact: String(meta.contact || item.supplierContact || directory.contact || 'Procurement Desk').trim(),
    phone: String(meta.phone || item.supplierPhone || directory.phone || 'Not available').trim(),
    email: String(meta.email || item.supplierEmail || directory.email || 'supplier@na.local').trim(),
    leadTimeDays: Math.max(1, Number(meta.leadTimeDays || item.leadTimeDays || directory.leadTimeDays || 3)),
    moq: Math.max(1, Number(meta.moq || item.minimumOrderQty || directory.moq || 10)),
    rating: Math.max(0, Number(meta.rating || item.supplierRating || directory.rating || 4.2)),
  };
}

/**
 * getRecentProfileActivity(). The original returned HTML strings like
 * `Processed order <strong>#ORD-1</strong> for X`; here each entry is
 * { time, before, strong, after } so it can be rendered as
 * `{before}<strong>{strong}</strong>{after}`.
 */
export function getRecentProfileActivity({ orders, returns, deliveries, inventory }) {
  const items = [];

  const latestOrder = orders
    .map((order) => ({ order, timestamp: parseOrderDate(order && order.date) }))
    .filter((entry) => entry.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (latestOrder) {
    items.push({ time: latestOrder.order.date, before: 'Processed order ', strong: `#${latestOrder.order.id}`, after: ` for ${latestOrder.order.customer}` });
  }

  const latestReturn = returns
    .map((item) => ({ item, timestamp: parseOrderDate(item && item.updatedAt) }))
    .filter((entry) => entry.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (latestReturn) {
    items.push({ time: latestReturn.item.updatedAt, before: 'Updated return ', strong: `#${latestReturn.item.id}`, after: ` to ${latestReturn.item.status}` });
  }

  const latestDelivery = deliveries
    .map((item) => ({ item, timestamp: parseOrderDate(item && (item.updatedAt || item.time)) }))
    .filter((entry) => entry.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (latestDelivery) {
    items.push({
      time: latestDelivery.item.updatedAt || latestDelivery.item.time,
      before: 'Checked delivery ',
      strong: `#${latestDelivery.item.id}`,
      after: ` - ${normalizeDeliveryStatus(latestDelivery.item.status)}`,
    });
  }

  const alertItem = inventory
    .map((item) => ({
      item,
      stock: Math.max(0, Number(item && item.stock) || 0),
      status: normalizeInventoryStatus(item && item.status, item && item.stock),
    }))
    .filter((entry) => entry.status !== 'In Stock')
    .sort((a, b) => a.stock - b.stock)[0];
  if (alertItem) {
    items.push({ time: 'Current inventory snapshot', before: 'Reviewed stock alert for ', strong: alertItem.item.name, after: ` (${alertItem.status})` });
  }

  return items.slice(0, 4);
}

// ── Business records ─────────────────────────────────────────────────
export function normalizeBusinessRecord(raw, fallbackId, fallbackName) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const id = String(safe.id || fallbackId || 'BIZ-000').trim();
  const name = String(safe.name || fallbackName || id).trim();

  const usersList = Array.isArray(safe.users)
    ? safe.users.map((u, idx) => ({
      name: String((u && u.name) || `User ${idx + 1}`).trim(),
      role: String((u && u.role) || 'Staff').trim(),
      status: String((u && u.status) || 'Active').trim(),
    }))
    : [];

  const storesList = Array.isArray(safe.stores)
    ? safe.stores.map((s, idx) => ({
      code: String((s && s.code) || `${id}-S${idx + 1}`).trim(),
      city: String((s && s.city) || 'Unknown').trim(),
      status: String((s && s.status) || 'Active').trim(),
    }))
    : [];

  const paymentsList = Array.isArray(safe.payments)
    ? safe.payments.map((p, idx) => ({
      month: String((p && p.month) || `Entry ${idx + 1}`).trim(),
      amount: Math.max(0, Number((p && p.amount) || 0) || 0),
      status: String((p && p.status) || 'Due').trim(),
    }))
    : [];

  const storesCount = Number.isFinite(Number(safe.storesCount)) ? Math.max(0, Number(safe.storesCount)) : storesList.length;
  const paymentDue = Number.isFinite(Number(safe.paymentDue))
    ? Math.max(0, Number(safe.paymentDue))
    : paymentsList.filter((p) => String(p.status).toLowerCase() !== 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return {
    id,
    name,
    owner: String(safe.owner || 'Unknown Owner').trim(),
    adminName: String(safe.adminName || 'Store Admin').trim(),
    type: String(safe.type || 'Retail').trim(),
    email: String(safe.email || 'na@business.local').trim(),
    phone: String(safe.phone || 'NA').trim(),
    status: String(safe.status || 'Active').trim(),
    productsPlan: String(safe.productsPlan || 'Billing Starter').trim(),
    tenureMonths: Math.max(0, Number(safe.tenureMonths) || 0),
    storesCount,
    profit: Math.max(0, Number(safe.profit) || 0),
    paymentDue,
    users: usersList,
    stores: storesList,
    payments: paymentsList,
  };
}

export function mergeSeedRecords(existingRows, seedRows, key) {
  const existing = Array.isArray(existingRows) ? existingRows : [];
  const seed = Array.isArray(seedRows) ? seedRows : [];
  if (!existing.length) return cloneRows(seed);
  if (!seed.length) return cloneRows(existing);

  const getKey = (row) => String(row && row[key] ? row[key] : '').trim();
  const seedByKey = new Map(seed.map((r) => [getKey(r), r]).filter(([k]) => k));
  const existingKeys = new Set(existing.map(getKey).filter(Boolean));

  const merged = existing.map((row) => {
    const k = getKey(row);
    const seedRow = k ? seedByKey.get(k) : null;
    return seedRow ? { ...seedRow, ...row } : row;
  });
  seed.forEach((row) => {
    const k = getKey(row);
    if (!k || existingKeys.has(k)) return;
    merged.push(row);
  });
  return cloneRows(merged);
}

export function mergePrimaryWithSecondary(primaryRows, secondaryRows, key) {
  const primary = Array.isArray(primaryRows) ? primaryRows : [];
  const secondary = Array.isArray(secondaryRows) ? secondaryRows : [];
  if (!primary.length) return cloneRows(secondary);
  if (!secondary.length) return cloneRows(primary);

  const getKey = (row) => String(row && row[key] ? row[key] : '').trim();
  const primaryKeys = new Set(primary.map(getKey).filter(Boolean));
  const merged = cloneRows(primary);
  secondary.forEach((row) => {
    const k = getKey(row);
    if (!k || primaryKeys.has(k)) return;
    merged.push(cloneRows([row])[0]);
  });
  return merged;
}

/** buildBusinessSeedData(business, idx) - demo data per business (used by the
 *  superuser notification generator for businesses without loaded data). */
export function buildBusinessSeedData(business, idx) {
  const userList = Array.isArray(business.users) ? business.users : [];
  const adminName = userList.find((u) => String(u.role || '').toLowerCase() === 'admin')?.name || business.adminName || 'Store Admin';
  const cashierName = userList.find((u) => String(u.role || '').toLowerCase().includes('cashier'))?.name || 'POS Counter';
  const inventoryManager = userList.find((u) => String(u.role || '').toLowerCase().includes('inventory'))?.name || 'Inventory Desk';
  const deliveryLead = userList.find((u) => String(u.role || '').toLowerCase().includes('delivery'))?.name || 'Delivery Desk';
  const returnLead = userList.find((u) => String(u.role || '').toLowerCase().includes('return'))?.name || 'Returns Desk';
  const city = Array.isArray(business.stores) && business.stores[0] ? business.stores[0].city : 'Primary City';
  const seedNum = 500 + idx * 50;

  const seedOrders = [
    { id: `ORD-${seedNum + 1}`, customer: `${city} Walk-in`, items: 6, total: 4280 + idx * 180, payment: 'Paid Upfront', status: 'Processing', date: '17 Feb 16:42' },
    { id: `ORD-${seedNum + 2}`, customer: 'Anita Verma', items: 2, total: 980 + idx * 90, payment: 'COD', status: 'Processing', date: '17 Feb 16:05' },
  ];

  const addressBook = [
    `12, MG Road, ${city}`,
    `A-204, Green Park, ${city}`,
  ];

  const seedDeliveries = [
    { id: `DEL-${seedNum + 1}`, oid: seedOrders[0].id, customer: seedOrders[0].customer, customerName: seedOrders[0].customer, address: addressBook[0], partner: 'Rajesh K.', partnerPhone: '+91 98214 44770', partnerAgency: 'SwiftDrop Logistics', status: 'Pending', etaMin: 35, updatedAt: '17 Feb 05:30' },
    { id: `DEL-${seedNum + 2}`, oid: seedOrders[1].id, customer: seedOrders[1].customer, customerName: seedOrders[1].customer, address: addressBook[1], partner: 'Sunil M.', partnerPhone: '+91 98214 44771', partnerAgency: 'SwiftDrop Logistics', status: 'In Transit', etaMin: 18, updatedAt: '17 Feb 16:20' },
  ];

  const seedInventory = [
    { sku: `SKU-${seedNum + 1}`, name: 'Basmati Rice', cat: 'Grocery', supplier: 'Agarwal Traders', supplierPhone: '+91 98115 44101', supplierEmail: 'sanjay@agarwaltraders.in', leadTimeDays: 2, stock: 145 - idx * 3, price: 380 + idx * 5, status: 'In Stock' },
    { sku: `SKU-${seedNum + 2}`, name: 'Toor Dal', cat: 'Grocery', supplier: 'Sharma Wholesale', supplierPhone: '+91 98917 22055', supplierEmail: 'orders@sharmawholesale.in', leadTimeDays: 3, stock: 230 - idx * 5, price: 120 + idx * 4, status: 'In Stock' },
    { sku: `SKU-${seedNum + 3}`, name: 'Refined Oil', cat: 'Grocery', supplier: 'Fortune Dist.', supplierPhone: '+91 99004 11233', supplierEmail: 'north@fortunedist.in', leadTimeDays: 4, stock: 18 + idx, price: 155 + idx * 3, status: 'Low Stock' },
    { sku: `SKU-${seedNum + 4}`, name: 'Atta Flour', cat: 'Grocery', supplier: 'Agarwal Traders', supplierPhone: '+91 98115 44101', supplierEmail: 'sanjay@agarwaltraders.in', leadTimeDays: 2, stock: 122 - idx * 2, price: 248 + idx * 3, status: 'In Stock' },
    { sku: `SKU-${seedNum + 5}`, name: 'Sugar', cat: 'Grocery', supplier: 'Sharma Wholesale', supplierPhone: '+91 98917 22055', supplierEmail: 'orders@sharmawholesale.in', leadTimeDays: 3, stock: 64 - idx * 3, price: 48 + idx * 2, status: 'In Stock' },
    { sku: `SKU-${seedNum + 6}`, name: 'Paneer', cat: 'Dairy', supplier: 'City Dairy', supplierPhone: '+91 97170 55544', supplierEmail: 'supply@citydairy.in', leadTimeDays: 1, stock: 21 + idx, price: 78, status: 'Low Stock' },
    { sku: `SKU-${seedNum + 7}`, name: 'Curd Cup', cat: 'Dairy', supplier: 'City Dairy', supplierPhone: '+91 97170 55544', supplierEmail: 'supply@citydairy.in', leadTimeDays: 1, stock: 88 + idx * 2, price: 26, status: 'In Stock' },
    { sku: `SKU-${seedNum + 8}`, name: 'Butter', cat: 'Dairy', supplier: 'City Dairy', supplierPhone: '+91 97170 55544', supplierEmail: 'supply@citydairy.in', leadTimeDays: 1, stock: 14 + idx, price: 60, status: 'Low Stock' },
    { sku: `SKU-${seedNum + 9}`, name: 'Potato Chips', cat: 'Snacks', supplier: 'SnackHub Foods', supplierPhone: '+91 99100 77442', supplierEmail: 'supply@snackhubfoods.in', leadTimeDays: 2, stock: 172 + idx * 6, price: 20, status: 'In Stock' },
    { sku: `SKU-${seedNum + 10}`, name: 'Biscuits', cat: 'Snacks', supplier: 'SnackHub Foods', supplierPhone: '+91 99100 77442', supplierEmail: 'supply@snackhubfoods.in', leadTimeDays: 2, stock: 154 + idx * 5, price: 12, status: 'In Stock' },
    { sku: `SKU-${seedNum + 11}`, name: 'Orange Juice', cat: 'Beverages', supplier: 'Cool Bev', supplierPhone: '+91 98180 33021', supplierEmail: 'ops@coolbev.in', leadTimeDays: 2, stock: 37 - idx, price: 42, status: 'In Stock' },
    { sku: `SKU-${seedNum + 12}`, name: 'Mineral Water', cat: 'Beverages', supplier: 'Cool Bev', supplierPhone: '+91 98180 33021', supplierEmail: 'ops@coolbev.in', leadTimeDays: 2, stock: 9 + idx, price: 20, status: 'Critical' },
    { sku: `SKU-${seedNum + 13}`, name: 'Dishwash Liquid', cat: 'Home Care', supplier: 'HomeSpark Supplies', supplierPhone: '+91 98101 56512', supplierEmail: 'care@homespark.in', leadTimeDays: 3, stock: 48 + idx * 2, price: 58, status: 'In Stock' },
    { sku: `SKU-${seedNum + 14}`, name: 'Detergent Powder', cat: 'Home Care', supplier: 'HomeSpark Supplies', supplierPhone: '+91 98101 56512', supplierEmail: 'care@homespark.in', leadTimeDays: 3, stock: Math.max(0, idx - 1), price: 96, status: idx > 0 ? 'Critical' : 'Out of Stock' },
  ];

  const seedReturns = [
    { id: `RET-${seedNum + 1}`, oid: seedOrders[0].id, product: seedInventory[2].name, sku: seedInventory[2].sku, cat: seedInventory[2].cat, reason: 'Damaged', amount: seedInventory[2].price, qty: 1, status: 'Pending', requestedBy: cashierName, updatedAt: '17 Feb 16:18' },
    { id: `RET-${seedNum + 2}`, oid: seedOrders[1].id, product: seedInventory[5].name, sku: seedInventory[5].sku, cat: seedInventory[5].cat, reason: 'Expired', amount: seedInventory[5].price, qty: 1, status: 'Pending', requestedBy: cashierName, updatedAt: '17 Feb 15:42' },
  ];

  const fallbackUsers = [
    { name: adminName, role: 'Admin', status: 'Active' },
    { name: cashierName, role: 'Cashier', status: 'Active' },
    { name: inventoryManager, role: 'Inventory Manager', status: 'Active' },
    { name: deliveryLead, role: 'Delivery Ops', status: 'Active' },
    { name: returnLead, role: 'Return Handler', status: 'Active' },
  ];

  return {
    orders: seedOrders,
    inventory: seedInventory,
    deliveries: seedDeliveries,
    returns: seedReturns,
    users: userList.length ? mergeSeedRecords(userList, fallbackUsers, 'name') : fallbackUsers,
  };
}
