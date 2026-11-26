import { api, errorText } from '../http.js';
import { formatBackendDate, normalizeBusinessRecord, cloneRows } from './helpers.js';
import { normalizeRole } from './session.js';
import { mapInventoryRow } from '../../../features/inventory/inventoryRepo.js';

export function normalizeBackendRole(role) {
  const key = normalizeRole(role);
  if (key === 'superuser' || key === 'super') return 'superuser';
  if (key === 'cashier') return 'cashier';
  if (key === 'returnhandler' || key === 'returns') return 'returnhandler';
  if (key === 'inventorymanager' || key === 'inventory') return 'inventorymanager';
  if (key === 'deliveryops' || key === 'delivery' || key === 'deliverymanager') return 'deliveryops';
  if (key === 'customer' || key === 'user') return 'customer';
  if (key === 'admin') return 'admin';
  return '';
}

export function mapBackendRoleToLabel(role) {
  const normalized = normalizeBackendRole(role);
  if (normalized === 'superuser') return 'Super User';
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'cashier') return 'Cashier';
  if (normalized === 'returnhandler') return 'Return Handler';
  if (normalized === 'inventorymanager') return 'Inventory Manager';
  if (normalized === 'deliveryops') return 'Delivery Ops';
  if (normalized === 'customer') return 'Customer';
  return String(role || '');
}

export function mapRoleLabelToBackendRole(role) {
  return normalizeBackendRole(role);
}

let activeRoleKeyForApi = 'customer';
export function setApiActiveRole(roleKey) {
  activeRoleKeyForApi = roleKey || 'customer';
}

export function getCurrentSessionRole() {
  return normalizeBackendRole(localStorage.getItem('userRole') || activeRoleKeyForApi);
}

/**
 * apiRequest(path, { method, body, query })
 *
 * The `role` option older pages pass is ignored: the server reads the role
 * from the sign-in token.
 */
export async function apiRequest(path, options) {
  const opts = options && typeof options === 'object' ? options : {};
  return api(path, { method: opts.method, body: opts.body, query: opts.query });
}

export function mutationErrorMessage(actionLabel, error) {
  return `${actionLabel} failed: ${errorText(error, 'server unavailable')}`;
}

export function isNotFoundError(error) {
  return Number(error && error.status) === 404;
}

/** What each role's screens read. Calls a role may not make are skipped. */
const READS = {
  inventory: ['superuser', 'admin', 'inventorymanager', 'cashier', 'returnhandler'],
  orders: ['superuser', 'admin', 'cashier', 'returnhandler', 'deliveryops', 'inventorymanager'],
  deliveries: ['superuser', 'admin', 'deliveryops', 'cashier'],
  returns: ['superuser', 'admin', 'returnhandler', 'cashier'],
  users: ['superuser', 'admin'],
  suppliers: ['superuser', 'admin', 'inventorymanager'],
  coupons: ['superuser', 'admin', 'cashier'],
};

function can(roleKey, what) {
  return READS[what].includes(roleKey);
}

export function mapOrderRow(order) {
  const lines = (Array.isArray(order.items) ? order.items : []).map((item) => ({
    productId: item.productId,
    productName: item.productName || item.productId,
    quantity: Number(item.quantity) || 0,
    itemPrice: Number(item.itemPrice) || 0,
    gstRate: Number(item.gstRate) || 0,
  }));
  const total = Math.max(0, Number(order.total) || 0);
  const refunded = Math.max(0, Number(order.refundedAmount) || 0);
  return {
    id: String(order.id || ''),
    version: order.version,
    companyId: String(order.companyId || ''),
    customer: String(order.customerName || 'Walk-in Customer'),
    customerId: String(order.customerId || ''),
    customerPhone: String(order.customerPhone || ''),
    address: String(order.customerAddress || ''),
    items: Number(order.itemsCount) || lines.reduce((s, l) => s + l.quantity, 0),
    lines,
    subtotal: Number(order.subtotal ?? total + (Number(order.discountAmount) || 0)),
    discount: Number(order.discountAmount) || 0,
    deliveryCharge: Number(order.deliveryCharge) || 0,
    tax: Number(order.taxAmount) || 0,
    total,
    cashReceived: order.cashReceived,
    changeDue: order.changeDue,
    refunded,
    net: Math.max(0, total - refunded),
    payment: String(order.paymentMethod || ''),
    paymentStatus: String(order.paymentStatus || ''),
    status: String(order.status || 'Processing'),
    orderType: String(order.orderType || 'pickup'),
    checkoutMode: String(order.checkoutMode || ''),
    promoCode: order.promoCode ? String(order.promoCode) : '',
    staffId: String(order.staffId || ''),
    staffName: String(order.staffName || order.staffId || ''),
    notes: String(order.notes || ''),
    deliveryNote: String(order.deliveryNote || ''),
    cancelReason: String(order.cancelReason || ''),
    billNo: order.bill ? String(order.bill.billNo || '') : '',
    orderDate: String(order.orderDate || ''),
    date: formatBackendDate(order.orderDate),
    updatedAt: order.updatedAt,
    updatedBy: order.updatedBy,
  };
}

export { mapInventoryRow };

export function mapDeliveryRow(d) {
  const history = Array.isArray(d.history) ? d.history : [];
  const lastAt = history.length ? history[history.length - 1].at : d.updatedAt || d.createdAt;
  return {
    id: String(d.id || ''),
    version: d.version,
    oid: String(d.orderId || ''),
    orderId: String(d.orderId || ''),
    customer: String(d.customerName || ''),
    customerPhone: String(d.customerPhone || ''),
    address: String(d.address || ''),
    partner: String(d.partnerName || ''),
    partnerPhone: String(d.partnerPhone || ''),
    partnerAgency: String(d.partnerAgency || ''),
    partnerVehicle: String(d.partnerVehicle || ''),
    etaMin: d.etaMinutes ?? null,
    dispatchDate: String(d.dispatchDate || ''),
    deliveryDate: String(d.deliveryDate || ''),
    status: String(d.status || 'Pending'),
    codAmount: Number(d.codAmount) || 0,
    cashCollected: Number(d.cashCollected) || 0,
    attempts: Number(d.attempts) || 0,
    failureReason: String(d.failureReason || ''),
    receiverName: String(d.receiverName || ''),
    history,
    items: Array.isArray(d.items) ? d.items : [],
    orderTotal: Number(d.orderTotal) || 0,
    paymentMethod: String(d.paymentMethod || ''),
    paymentStatus: String(d.paymentStatus || ''),
    orderStatus: String(d.orderStatus || ''),
    lastChangeAt: lastAt,
    updatedAt: formatBackendDate(lastAt),
    time: formatBackendDate(lastAt).split(' ').slice(-1)[0],
  };
}

export function mapReturnRow(r) {
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    id: String(r.id || ''),
    backendId: String(r.id || ''),
    version: r.version,
    companyId: String(r.companyId || ''),
    oid: String(r.orderId || ''),
    orderId: String(r.orderId || ''),
    customer: String(r.customerName || r.requestedBy || ''),
    customerPhone: String(r.customerPhone || ''),
    product: String(r.product || items.map((i) => `${i.productName} ×${i.qty}`).join(', ')),
    items,
    reason: String(r.reason || ''),
    condition: r.condition || '',
    amount: Math.max(0, Number(r.refundAmount) || 0),
    qty: Math.max(0, Number(r.qty) || items.reduce((s, i) => s + i.qty, 0)),
    status: String(r.status || 'Pending'),
    requestedBy: String(r.requestedBy || ''),
    staffId: String(r.staffId || ''),
    returnType: String(r.returnType || 'refund'),
    refundMethod: String(r.refundMethod || ''),
    restock: r.restock,
    rejectReason: String(r.rejectReason || ''),
    note: String(r.note || ''),
    orderTotal: Number(r.orderTotal) || 0,
    orderDate: r.orderDate,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    resolvedBy: r.resolvedBy,
    returnDate: r.returnDate,
    updatedAt: formatBackendDate(r.updatedAt || r.createdAt || r.returnDate),
  };
}

export function mapUserRow(user) {
  return {
    id: String(user.id || ''),
    version: user.version,
    companyId: String(user.companyId || ''),
    name: String(user.name || ''),
    roleKey: normalizeBackendRole(user.role),
    role: mapBackendRoleToLabel(user.role),
    status: String(user.status || 'Active'),
    email: String(user.email || ''),
    phone: String(user.mobileNo || ''),
    username: String(user.username || ''),
    updatedAt: user.updatedAt,
    updatedBy: user.updatedBy,
  };
}

/**
 * Loads everything the signed-in role's screens need, for one business.
 * Returns false only if the server cannot be reached at all.
 */
export async function fetchOperationalData({ activeBusinessId, roleKey, existingBusinesses = [] }) {
  const companyId = String(activeBusinessId || '').trim();
  const scoped = companyId && companyId !== 'PLATFORM' ? { companyId } : undefined;
  const get = (path, what, query) => (what && !can(roleKey, what) ? Promise.resolve([]) : api(path, { query }));

  // One call decides whether the server is reachable at all.
  const probe = await Promise.allSettled([
    get('/inventory', 'inventory', scoped),
    get('/orders', 'orders', scoped),
  ]);
  if (probe.every((p) => p.status === 'rejected' && Number(p.reason && p.reason.status) === 0)) return false;
  const [inventoryData, ordersData] = probe.map((p) => (p.status === 'fulfilled' && Array.isArray(p.value) ? p.value : []));

  const settled = await Promise.allSettled([
    get('/deliveries', 'deliveries', scoped),
    get('/returns', 'returns', scoped),
    get('/users', 'users', scoped),
    get('/suppliers', 'suppliers', scoped),
    get('/coupons', 'coupons', scoped),
    roleKey === 'superuser'
      ? api('/companies')
      : roleKey === 'admin' && companyId
        ? api(`/companies/${encodeURIComponent(companyId)}`).then((c) => (c ? [c] : []))
        : Promise.resolve([]),
  ]);
  const [deliveriesData, returnsData, usersData, suppliersData, couponsData, companiesData] = settled.map((s) =>
    s.status === 'fulfilled' && Array.isArray(s.value) ? s.value : [],
  );

  const users = usersData.map(mapUserRow);
  let businesses = null;
  if (companiesData.length) {
    const existingById = new Map(existingBusinesses.map((item) => [item.id, item]));
    businesses = companiesData.map((company) => {
      const existing = existingById.get(String(company.id || '')) || {};
      return normalizeBusinessRecord(
        {
          ...existing,
          ...company,
          users: users
            .filter((u) => u.companyId === company.id)
            .map((u) => ({ id: u.id, name: u.name, role: u.role, status: u.status })),
        },
        company.id,
        company.name,
      );
    });
  }

  return {
    inventory: cloneRows(inventoryData.map(mapInventoryRow)),
    orders: cloneRows(ordersData.map(mapOrderRow)),
    deliveries: cloneRows(deliveriesData.map(mapDeliveryRow)),
    returns: cloneRows(returnsData.map(mapReturnRow)),
    users: cloneRows(users),
    suppliers: cloneRows(suppliersData),
    coupons: cloneRows(couponsData),
    businesses,
  };
}
