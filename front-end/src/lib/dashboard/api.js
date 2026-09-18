// Backend access ported from dashboard.js (apiRequest + return/delivery id
// helpers + loadOperationalDataFromBackend's fetch/mapping part).
import { API_BASE_CANDIDATES, API_BASE_URL } from './constants.js';
import { formatBackendDate, normalizeBusinessRecord, cloneRows } from './helpers.js';
import { normalizeRole } from './session.js';
import { loadObject } from './storage.js';

export function normalizeBackendRole(role) {
  const key = normalizeRole(role);
  if (key === 'superuser' || key === 'super') return 'superuser';
  if (key === 'admin' || key === 'opshead' || key === 'storemanager' || key === 'accountant' || key === 'supportagent') return 'admin';
  if (key === 'cashier') return 'cashier';
  if (key === 'returnhandler' || key === 'returns') return 'returnhandler';
  if (key === 'inventorymanager' || key === 'inventory') return 'inventorymanager';
  if (key === 'deliveryops' || key === 'delivery' || key === 'deliverymanager' || key === 'deliverydriver') return 'deliveryops';
  if (key === 'customer' || key === 'user') return 'customer';
  return 'admin';
}

export function mapBackendRoleToLabel(role) {
  const normalized = normalizeBackendRole(role);
  if (normalized === 'superuser') return 'Super User';
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'cashier') return 'Cashier';
  if (normalized === 'returnhandler') return 'Return Handler';
  if (normalized === 'inventorymanager') return 'Inventory Manager';
  if (normalized === 'deliveryops') return 'Delivery Ops';
  return 'Customer';
}

export function mapRoleLabelToBackendRole(role) {
  return normalizeBackendRole(role);
}

// The original fell back to the page's activeRoleKey; the store registers it here.
let activeRoleKeyForApi = 'customer';
export function setApiActiveRole(roleKey) {
  activeRoleKeyForApi = roleKey || 'customer';
}

export function getCurrentSessionRole() {
  return normalizeBackendRole(localStorage.getItem('userRole') || activeRoleKeyForApi || 'admin');
}

/**
 * apiRequest(path, { method = 'GET', role = session role, body })
 * Sends `x-role`, tries each base URL in turn on network errors, throws an
 * Error with `.status` for HTTP errors.
 */
export async function apiRequest(path, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const method = String(opts.method || 'GET').toUpperCase();
  const role = normalizeBackendRole(opts.role || getCurrentSessionRole());
  const headers = { 'Content-Type': 'application/json', 'x-role': role };
  const request = { method, headers, cache: 'no-store' };
  if (opts.body !== undefined) request.body = JSON.stringify(opts.body);

  const candidateBases = [API_BASE_URL, ...API_BASE_CANDIDATES].filter((base, idx, arr) => arr.indexOf(base) === idx);
  let lastNetworkError = null;

  for (const baseUrl of candidateBases) {
    try {
      const response = await fetch(`${baseUrl}${path}`, request);
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();
      if (!response.ok) {
        const message = payload && typeof payload === 'object' && payload.message ? payload.message : `HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error && typeof error.status === 'number') throw error;
      lastNetworkError = error;
    }
  }

  const networkError = new Error('Cannot connect to backend API. Ensure backend is running on http://localhost:4000');
  networkError.cause = lastNetworkError || null;
  throw networkError;
}

export function mutationErrorMessage(actionLabel, error) {
  const message = error && error.message ? error.message : 'Backend unavailable';
  return `${actionLabel} failed: ${message}`;
}

export function isNotFoundError(error) {
  return Number(error && error.status) === 404 || /not found/i.test(String((error && error.message) || ''));
}

// ── Returns ──────────────────────────────────────────────────────────
export function buildBackendReturnPayload(item, overrides) {
  const patch = overrides && typeof overrides === 'object' ? overrides : {};
  const currentUser = loadObject('currentUser', {});
  const companyId = String(localStorage.getItem('activeBusinessId') || currentUser.companyId || '').trim();
  const nextRequestedBy = String(
    patch.requestedBy !== undefined ? patch.requestedBy : (item && item.requestedBy) || localStorage.getItem('userName') || 'Operator'
  ).trim() || 'Operator';

  return {
    companyId: companyId || undefined,
    orderId: String(patch.orderId !== undefined ? patch.orderId : ((item && (item.oid || item.orderId)) || '')).trim().toUpperCase(),
    staffId: String(patch.staffId !== undefined ? patch.staffId : ((item && item.staffId) || currentUser.id || 'USR-005')).trim() || 'USR-005',
    reason: String(patch.reason !== undefined ? patch.reason : ((item && item.reason) || '')).trim(),
    refundAmount: Math.max(0, Number(patch.refundAmount !== undefined ? patch.refundAmount : ((item && item.amount) || 0)) || 0),
    returnType: String(patch.returnType !== undefined ? patch.returnType : ((item && item.returnType) || 'refund')).trim() || 'refund',
    product: String(patch.product !== undefined ? patch.product : ((item && (item.backendProduct || item.product)) || '')).trim(),
    qty: Math.max(1, Number(patch.qty !== undefined ? patch.qty : ((item && item.qty) || 1)) || 1),
    requestedBy: nextRequestedBy,
  };
}

/** NOTE: mutates `item` (backendId, id, backendProduct, staffId) like the original. Pass a copy. */
export async function resolveBackendReturnId(item) {
  if (!item) throw new Error('Return item missing');
  const currentId = String(item.backendId || item.id || '').trim();
  const rows = await apiRequest('/returns', { role: 'returnhandler' });
  const list = Array.isArray(rows) ? rows : [];

  let match = currentId ? list.find((row) => String((row && row.id) || '').trim() === currentId) : null;
  if (!match) {
    const orderId = String(item.oid || '').trim();
    const reason = String(item.reason || '').trim().toLowerCase();
    const qty = Math.max(1, Number(item.qty) || 1);
    const amount = Math.max(0, Number(item.amount) || 0);
    const requestedBy = String(item.requestedBy || '').trim().toLowerCase();
    match = list.find((row) =>
      String((row && row.orderId) || '').trim() === orderId
      && String((row && row.reason) || '').trim().toLowerCase() === reason
      && Math.max(1, Number(row && row.qty) || 1) === qty
      && Math.abs((Math.max(0, Number(row && row.refundAmount) || 0)) - amount) < 0.01
      && (!requestedBy || String((row && row.requestedBy) || '').trim().toLowerCase() === requestedBy));
  }

  if (!match || !match.id) throw new Error(`Return ${currentId || item.oid || ''} not found`);

  item.backendId = String(match.id).trim();
  item.id = item.backendId;
  if (match.product) item.backendProduct = String(match.product).trim();
  if (match.staffId) item.staffId = String(match.staffId).trim();
  return item.backendId;
}

/** NOTE: mutates `item`. Pass a copy. */
export async function ensureBackendReturnId(item, overrides) {
  try {
    return await resolveBackendReturnId(item);
  } catch (error) {
    if (!isNotFoundError(error) && !/not found/i.test(String((error && error.message) || ''))) throw error;
  }

  const created = await apiRequest('/returns', {
    method: 'POST',
    role: 'returnhandler',
    body: buildBackendReturnPayload(item, overrides),
  });

  const backendId = String((created && created.id) || '').trim();
  if (!backendId) throw new Error('Return could not be recreated in backend');

  item.backendId = backendId;
  item.id = backendId;
  item.status = String((created && created.status) || item.status || 'Pending').trim();
  item.staffId = String((created && created.staffId) || item.staffId || '').trim();
  item.backendProduct = String((created && created.product) || item.backendProduct || item.product || '').trim();
  return backendId;
}

/** NOTE: mutates `item`. Pass a copy. */
export async function updateReturnOnBackend(item, payload) {
  const updatePayload = payload && typeof payload === 'object' ? payload : {};
  const preferredId = String((item && (item.backendId || item.id)) || '').trim();

  try {
    if (!preferredId) throw new Error('Return id missing');
    await apiRequest(`/returns/${encodeURIComponent(preferredId)}`, { method: 'PUT', role: 'returnhandler', body: updatePayload });
    item.backendId = preferredId;
    return preferredId;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    const resolvedId = await ensureBackendReturnId(item, updatePayload);
    await apiRequest(`/returns/${encodeURIComponent(String(resolvedId))}`, { method: 'PUT', role: 'returnhandler', body: updatePayload });
    item.backendId = resolvedId;
    item.id = resolvedId;
    return resolvedId;
  }
}

// ── Deliveries ───────────────────────────────────────────────────────
/** NOTE: mutates `item.id`. Pass a copy. */
export async function resolveBackendDeliveryId(item) {
  if (!item) throw new Error('Delivery item missing');
  const orderId = String(item.orderId || item.oid || '').trim();
  if (!orderId) throw new Error('Delivery order id missing');
  const delivery = await apiRequest(`/deliveries/order/${encodeURIComponent(orderId)}`, { role: 'deliveryops' });
  if (!delivery || !delivery.id) throw new Error(`Delivery for order ${orderId} not found`);
  item.id = String(delivery.id).trim();
  return item.id;
}

// ── Initial load ─────────────────────────────────────────────────────
/**
 * Fetch + mapping half of loadOperationalDataFromBackend(). Returns `false`
 * when the core collections could not be loaded, otherwise
 * { inventory, orders, deliveries, returns, users, businesses } where
 * `businesses` is null when no companies were returned (leave as-is).
 */
export async function fetchOperationalData({ activeBusinessId, roleKey, sessionCompanyId, existingBusinesses = [] }) {
  const scopedCompanyId = String(activeBusinessId || '').trim();
  const isScopedBusiness = Boolean(scopedCompanyId);
  const isSeedBusiness = scopedCompanyId === 'BIZ-101' || scopedCompanyId === 'BIZ-102';
  const shouldUseEmptyOperationalSeed = isScopedBusiness && !isSeedBusiness;

  const [productsData, suppliersData, inventoryData, ordersData, customersData, deliveriesData, returnsData, usersData, companiesData] = await Promise.all([
    apiRequest('/products', { role: 'cashier' }).catch(() => []),
    apiRequest('/suppliers', { role: 'inventorymanager' }).catch(() => []),
    apiRequest('/inventory', { role: 'inventorymanager' }).catch(() => []),
    apiRequest(scopedCompanyId ? `/orders?companyId=${encodeURIComponent(scopedCompanyId)}` : '/orders', { role: 'cashier' }).catch(() => []),
    apiRequest(scopedCompanyId ? `/customers?companyId=${encodeURIComponent(scopedCompanyId)}` : '/customers', { role: 'cashier' }).catch(() => []),
    apiRequest('/deliveries', { role: 'deliveryops' }).catch(() => []),
    apiRequest('/returns', { role: 'returnhandler' }).catch(() => []),
    apiRequest(scopedCompanyId ? `/users?companyId=${encodeURIComponent(scopedCompanyId)}` : '/users', { role: 'admin' }).catch(() => []),
    roleKey === 'superuser'
      ? apiRequest('/companies', { role: 'superuser' }).catch(() => [])
      : (scopedCompanyId
        ? apiRequest(`/companies/${encodeURIComponent(scopedCompanyId)}`, { role: 'admin' }).then((company) => (company ? [company] : [])).catch(() => [])
        : []),
  ]);

  if (!Array.isArray(productsData) || !Array.isArray(inventoryData) || !Array.isArray(ordersData)) return false;

  const customerById = new Map((Array.isArray(customersData) ? customersData : []).map((item) => [String(item.id || ''), item]));
  const orderById = new Map((Array.isArray(ordersData) ? ordersData : []).map((item) => [String(item.id || ''), item]));

  const effectiveProductsData = shouldUseEmptyOperationalSeed ? [] : productsData;
  const effectiveSuppliersData = shouldUseEmptyOperationalSeed ? [] : suppliersData;
  const effectiveInventoryData = shouldUseEmptyOperationalSeed ? [] : inventoryData;

  const effectiveDeliveryRows = (Array.isArray(deliveriesData) ? deliveriesData : []).filter((delivery) => {
    if (!isScopedBusiness) return true;
    return orderById.has(String((delivery && delivery.orderId) || '').trim());
  });

  const effectiveReturnRows = (Array.isArray(returnsData) ? returnsData : []).filter((ret) => {
    if (!isScopedBusiness) return true;
    const retCompanyId = String((ret && ret.companyId) || '').trim();
    if (retCompanyId) return retCompanyId === scopedCompanyId;
    return orderById.has(String((ret && ret.orderId) || '').trim());
  });

  const supplierById = new Map((Array.isArray(effectiveSuppliersData) ? effectiveSuppliersData : []).map((item) => [String(item.id || ''), item]));
  const productById = new Map((Array.isArray(effectiveProductsData) ? effectiveProductsData : []).map((item) => [String(item.id || ''), item]));

  const mappedInventory = effectiveInventoryData.map((inv, idx) => {
    const product = productById.get(String(inv.productId || '')) || {};
    const supplier = supplierById.get(String(product.supplierId || '')) || {};
    const fallbackSku = `SKU-${String(idx + 1).padStart(2, '0')}`;
    return {
      sku: String(inv.id || fallbackSku).replace('INV-', 'SKU-'),
      inventoryId: inv.id,
      productId: inv.productId,
      name: String(product.name || inv.productId || 'Unknown Product').trim(),
      cat: String(product.category || 'Uncategorized').trim(),
      supplier: String(supplier.name || product.supplierId || 'Unknown Supplier').trim(),
      stock: Math.max(0, Number(inv.stockAvailable || 0)),
      price: Math.max(0, Number(product.price || 0)),
      status: String(inv.status || 'In Stock').trim(),
      reorderLevel: Math.max(0, Number(inv.reorderLevel || 0)),
      location: String(inv.location || '').trim(),
    };
  });

  const mappedOrders = ordersData.map((order) => {
    const customer = customerById.get(String(order.customerId || ''));
    const itemCount = Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + Math.max(0, Number((item && item.quantity) || 0)), 0)
      : 0;
    return {
      id: String(order.id || '').trim(),
      customer: String(order.customerName || (customer && customer.name) || order.customerId || 'Unknown Customer').trim(),
      items: Math.max(0, Number(order.itemsCount || itemCount || 0)),
      total: Math.max(0, Number(order.total || 0)),
      payment: String(order.paymentMethod || 'Pending').trim(),
      status: String(order.status || 'Pending').trim(),
      date: formatBackendDate(order.orderDate),
      companyId: String(order.companyId || '').trim(),
    };
  });

  const mappedDeliveries = effectiveDeliveryRows.map((delivery) => {
    const order = orderById.get(String(delivery.orderId || '')) || {};
    const customer = customerById.get(String(order.customerId || '')) || {};
    const status = String(delivery.status || 'Pending').trim();
    const updatedAtRaw = delivery.deliveryDate || delivery.dispatchDate || '';
    return {
      id: String(delivery.id || '').trim(),
      oid: String(delivery.orderId || '').trim(),
      orderId: String(delivery.orderId || '').trim(),
      customer: String(delivery.customerName || order.customerName || customer.name || order.customerId || 'Unknown Customer').trim(),
      address: String(delivery.address || order.customerAddress || customer.address || 'Address unavailable').trim(),
      partner: String(delivery.partnerName || 'Unassigned').trim(),
      partnerPhone: String(delivery.partnerPhone || '').trim(),
      partnerAgency: String(delivery.partnerAgency || '').trim(),
      partnerVehicle: String(delivery.partnerVehicle || '').trim(),
      dispatchDate: String(delivery.dispatchDate || '').trim(),
      deliveryDate: String(delivery.deliveryDate || '').trim(),
      status,
      etaMin: status === 'In Transit' ? 20 : (status === 'Pending' ? 35 : 0),
      updatedAt: formatBackendDate(updatedAtRaw || new Date().toISOString()),
      time: formatBackendDate(updatedAtRaw || new Date().toISOString()).split(' ').slice(-1)[0],
    };
  });

  const mappedReturns = effectiveReturnRows.map((ret) => {
    const order = orderById.get(String(ret.orderId || '')) || {};
    const customer = customerById.get(String(order.customerId || '')) || {};
    const product = productById.get(String(ret.product || '')) || {};
    return {
      id: String(ret.id || '').trim(),
      backendId: String(ret.id || '').trim(),
      companyId: String(ret.companyId || order.companyId || '').trim(),
      oid: String(ret.orderId || '').trim(),
      orderId: String(ret.orderId || '').trim(),
      customer: String(customer.name || order.customerId || 'Unknown Customer').trim(),
      product: String(product.name || ret.product || 'Unknown Product').trim(),
      backendProduct: String(ret.product || '').trim(),
      reason: String(ret.reason || '').trim(),
      amount: Math.max(0, Number(ret.refundAmount ?? ret.amount ?? 0)),
      qty: Math.max(1, Number(ret.qty || 1)),
      status: String(ret.status || 'Pending').trim(),
      requestedBy: String(ret.requestedBy || '').trim() || 'Operator',
      staffId: String(ret.staffId || '').trim(),
      returnType: String(ret.returnType || 'refund').trim() || 'refund',
      updatedAt: formatBackendDate(ret.returnDate || new Date().toISOString()),
    };
  });

  const mappedUsers = (Array.isArray(usersData) ? usersData : []).map((user) => ({
    id: String(user.id || '').trim(),
    companyId: String(user.companyId || '').trim(),
    name: String(user.name || '').trim(),
    role: mapBackendRoleToLabel(user.role),
    status: String(user.status || 'Active').trim(),
    email: String(user.email || '').trim(),
    phone: String(user.mobileNo || '').trim(),
    username: String(user.username || '').trim(),
  }));

  let businesses = null;
  if (Array.isArray(companiesData) && companiesData.length) {
    const existingById = new Map(existingBusinesses.map((item) => [item.id, item]));
    const usersByCompanyId = new Map();
    mappedUsers.forEach((user) => {
      const cid = String(user.companyId || '').trim();
      if (!cid) return;
      if (!usersByCompanyId.has(cid)) usersByCompanyId.set(cid, []);
      usersByCompanyId.get(cid).push({
        name: String(user.name || '').trim(),
        role: String(user.role || '').trim() || 'Staff',
        status: String(user.status || 'Active').trim() || 'Active',
      });
    });
    const mapped = companiesData.map((company) => {
      const existing = existingById.get(String(company.id || '').trim()) || {};
      return normalizeBusinessRecord({
        ...existing,
        ...company,
        users: usersByCompanyId.get(String((company && company.id) || '').trim()) || company.users || existing.users || [],
      }, company.id, company.name);
    });
    const scopeId = String(activeBusinessId || sessionCompanyId || '').trim();
    businesses = roleKey === 'superuser'
      ? mapped
      : mapped.filter((business) => String((business && business.id) || '').trim() === scopeId);
  }

  return {
    inventory: cloneRows(mappedInventory),
    orders: cloneRows(mappedOrders),
    deliveries: cloneRows(mappedDeliveries),
    returns: cloneRows(mappedReturns),
    users: cloneRows(mappedUsers),
    businesses,
  };
}
