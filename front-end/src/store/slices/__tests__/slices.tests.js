import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import rootStore from '../../store.js';
import { injectStore } from '../../storeBridge.js';
import { resetRedirectGuard, setAuthToken } from '../../../lib/http.js';
import { clearSession } from '../../../lib/dashboard/session.js';
import inventoryReducer, {
  clearInventoryError, clearMovements, fetchInventoryThunk, fetchInventoryByIdThunk,
  fetchInventoryByProductThunk, fetchLowStockThunk, fetchMovementsThunk, adjustStockThunk,
  receiveStockThunk, updateInventoryThunk, deleteInventoryThunk, selectAllInventory,
  selectLowStockState, selectLowStockItems, selectLowStockForDashboard, selectActiveCatalog,
  selectInventoryCategories, selectInventorySupplierNames, selectInventoryValuation,
  selectInventoryStatus, selectInventoryError, isLowStock,
} from '../inventorySlice.js';
import productsReducer, {
  clearProductsError, clearSelectedProduct, resetProducts, fetchProductsThunk,
  fetchProductByIdThunk, fetchProductCategoriesThunk, fetchProductByBarcodeThunk,
  fetchProductActivityThunk, createProductThunk, updateProductThunk, deleteProductThunk,
  selectAllProducts, selectActiveProducts, selectProductCategories, selectDerivedProductCategories,
  selectSelectedProduct, selectActivityByProduct, selectProductsSaving,
} from '../productsSlice.js';
import suppliersReducer, {
  clearSuppliersError, clearSelectedSupplier, resetSuppliers, fetchSuppliersThunk,
  fetchSupplierByIdThunk, createSupplierThunk, updateSupplierThunk, deleteSupplierThunk,
  selectAllSuppliers, selectSortedSuppliers, selectSelectedSupplier, selectSuppliersSaving,
} from '../suppliersSlice.js';
import uploadsReducer, {
  clearUploadsError, clearLastImportSummary, resetUploads, fetchUploadsThunk,
  fetchUploadByIdThunk, uploadImageThunk, importProductsCsvThunk, attachProductImageThunk,
  deleteUploadThunk, selectAllUploads, selectImageUploads, selectImportUploads,
  selectLastImportSummary, selectLastUploaded, selectSelectedUpload, selectUploadsUploading,
  selectUploadsError,
} from '../uploadsSlice.js';
import ordersReducer, {
  initialFilters, setFilter, resetFilters, setSelectedOrder, clearSelectedOrder, setOrders,
  fetchOrdersThunk, fetchOrderByIdThunk, fetchBillByNoThunk, quoteOrderThunk, placeOrderThunk,
  updateOrderThunk, cancelOrderThunk, deleteOrderThunk, selectAllOrders, selectOrderFilters,
  selectSelectedOrderId, selectOrdersLoading, selectOrdersError, selectSelectedOrder,
  selectFilteredOrders, selectOrderMetrics, selectOrdersSummary,
} from '../ordersSlice.js';
import couponsReducer, {
  clearCouponsError, clearValidationResult, createCouponThunk, deleteCouponThunk,
  fetchCouponAnalyticsThunk, fetchCouponsThunk, resetCoupons, selectActiveCoupons,
  selectCouponById, updateCouponThunk, validateCouponThunk,
} from '../couponsSlice.js';
import reportsReducer, {
  clearReportsError, fetchInventoryReportThunk, fetchReturnsReportThunk,
  fetchSalesReportThunk, resetReports, selectInventoryReport, selectReportsError,
  selectReportsLoading, selectReturnsReport, selectSalesReport, selectSalesReportFor,
} from '../reportsSlice.js';
import deliveriesReducer, {
  fetchDeliveriesThunk, createDeliveryThunk, transitionDeliveryThunk, updateDeliveryThunk,
  deleteDeliveryThunk, selectAllDeliveries, selectActiveDeliveries, selectDeliveryById,
  clearSelectedDelivery, clearDeliveriesError,
} from '../deliveriesSlice.js';
import returnsReducer, {
  fetchReturnsThunk, fetchReturnableOrderThunk, createReturnThunk, transitionReturnThunk,
  deleteReturnThunk, selectAllReturns, selectPendingReturns, selectApprovedReturns,
  selectReturnById, clearReturnableForOrder,
} from '../returnsSlice.js';
import uiReducer, {
  toggleTheme, setTheme, toggleSidebar, setSidebarCollapsed, setMobileDrawer,
  showToast, hideToast, openModal, closeModal, markNotificationRead,
  markAllNotificationsRead, selectCurrentTheme, selectToastState, selectSidebarState,
  selectModals, selectReduxNotifications,
} from '../uiSlice.js';
// ============================================================================
// MERGED FROM: inventorySlice.test.js
// ============================================================================
await (async () => {
console.log('🧪 Starting hardened inventorySlice unit, concurrency & benchmark suite...\n');

if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}
if (typeof globalThis.sessionStorage === 'undefined') {
  const smap = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (smap.has(k) ? smap.get(k) : null),
    setItem: (k, v) => smap.set(k, String(v)),
    removeItem: (k) => smap.delete(k),
    clear: () => smap.clear(),
  };
}

const originalFetch = globalThis.fetch;
function createMockResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// PART 1: INITIAL STATE, DB-FIRST RULE & LIFECYCLE
// ============================================================================

{
  const state = inventoryReducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.items, []);
  assert.deepEqual(state.lowStock, []);
  assert.deepEqual(state.movements, []);
  assert.equal(state.selected, null);
  assert.equal(state.status, 'idle');
  assert.equal(state.movementsStatus, 'idle');
  assert.equal(state.saving, false);
  assert.equal(state.error, null);
  assert.deepEqual(state.requestIds, {
    fetchAll: null,
    fetchLowStock: null,
    fetchMovements: null,
    fetchOne: null,
  });
  console.log('✓ Test 1: Initial state matches 1:1 DB-first schema');
}

// --- Test 2: Strict DB-first check (.pending NEVER mutates items[].stock) ---
{
  const initial = {
    items: [{ productId: 'P001', inventoryId: 'INV-001', name: 'Rice', stock: 20, reorderLevel: 10, active: true, status: 'In Stock' }],
    lowStock: [],
    movements: [],
    selected: null,
    status: 'succeeded',
    movementsStatus: 'idle',
    saving: false,
    error: null,
    requestIds: { fetchAll: null, fetchLowStock: null, fetchMovements: null, fetchOne: null },
  };

  let state = inventoryReducer(initial, {
    type: adjustStockThunk.pending.type,
    meta: { requestId: 'adj-1', arg: { productId: 'P001', adjustment: -15, reason: 'Damaged' } },
  });
  assert.equal(state.saving, true);
  assert.equal(state.items[0].stock, 20, '.pending MUST NOT optimistically subtract stock');

  state = inventoryReducer(state, {
    type: receiveStockThunk.pending.type,
    meta: { requestId: 'rec-1', arg: { productId: 'P001', quantity: 50 } },
  });
  assert.equal(state.items[0].stock, 20, '.pending MUST NOT optimistically add stock');

  state = inventoryReducer(state, {
    type: adjustStockThunk.fulfilled.type,
    payload: { productId: 'P001', inventoryId: 'INV-001', name: 'Rice', stock: 5, reorderLevel: 10, active: true, status: 'Critical' },
  });
  assert.equal(state.saving, false);
  assert.equal(state.items[0].stock, 5, 'Stock updates strictly in .fulfilled from DB payload');
  assert.equal(state.lowStock.length, 1, 'lowStock stays synchronized after adjustStock');
  console.log('✓ Test 2: Strict DB-first rule enforced (zero optimistic mutation in .pending)');
}

// ============================================================================
// PART 2: RACE & CONCURRENCY HARDENING (PER-SLICE, PER-REQUEST-TYPE)
// ============================================================================

// --- Test 3: Two overlapping fetchInventoryThunk calls resolved OUT OF ORDER ---
{
  const store = configureStore({ reducer: { inventory: inventoryReducer } });
  let resolveReq1;
  let resolveReq2;
  let callIndex = 0;

  globalThis.fetch = () => {
    callIndex += 1;
    if (callIndex === 1) {
      return new Promise((resolve) => {
        resolveReq1 = () =>
          resolve(createMockResponse([{ id: 'INV-001', productId: 'P001', productName: 'Milk', stockAvailable: 11, reorderLevel: 10, status: 'In Stock' }]));
      });
    }
    return new Promise((resolve) => {
      resolveReq2 = () =>
        resolve(createMockResponse([{ id: 'INV-001', productId: 'P001', productName: 'Milk', stockAvailable: 99, reorderLevel: 10, status: 'In Stock' }]));
    });
  };

  try {
    const p1 = store.dispatch(fetchInventoryThunk());
    const p2 = store.dispatch(fetchInventoryThunk());

    // Newer call (#2) resolves FIRST with stock 99
    resolveReq2();
    await p2;
    assert.equal(store.getState().inventory.items[0].stock, 99);

    // Older call (#1) resolves SECOND with stale stock 11 -> MUST be ignored!
    resolveReq1();
    await p1;
    assert.equal(store.getState().inventory.items[0].stock, 99, 'Newest request must win when overlapping fetches resolve out of order');
    console.log('✓ Test 3: Overlapping fetchInventoryThunk calls resolved out of order keep newest data');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 4: Background poll resolving AFTER adjustStock fulfilled must NOT revert stock ---
{
  const store = configureStore({
    reducer: { inventory: inventoryReducer },
    preloadedState: {
      inventory: {
        items: [{ productId: 'P001', inventoryId: 'INV-001', name: 'Flour', stock: 10, reorderLevel: 15, active: true, status: 'Low Stock' }],
        lowStock: [{ productId: 'P001', inventoryId: 'INV-001', name: 'Flour', stock: 10, reorderLevel: 15, active: true, status: 'Low Stock' }],
        movements: [],
        selected: null,
        status: 'succeeded',
        movementsStatus: 'idle',
        saving: false,
        error: null,
        requestIds: { fetchAll: null, fetchLowStock: null, fetchMovements: null, fetchOne: null },
      },
    },
  });

  let resolvePoll;
  globalThis.fetch = (url) => {
    if (String(url).includes('/api/inventory/adjust')) {
      return Promise.resolve(
        createMockResponse({ id: 'INV-001', productId: 'P001', productName: 'Flour', stockAvailable: 25, reorderLevel: 15, status: 'In Stock', active: true }),
      );
    }
    return new Promise((resolve) => {
      resolvePoll = () =>
        resolve(createMockResponse([{ id: 'INV-001', productId: 'P001', productName: 'Flour', stockAvailable: 10, reorderLevel: 15, status: 'Low Stock', active: true }]));
    });
  };

  try {
    const pollPromise = store.dispatch(fetchInventoryThunk());
    assert.ok(store.getState().inventory.requestIds.fetchAll);

    await store.dispatch(adjustStockThunk({ productId: 'P001', adjustment: 15, reason: 'Recount' })).unwrap();
    assert.equal(store.getState().inventory.items[0].stock, 25);
    assert.equal(store.getState().inventory.requestIds.fetchAll, null, 'Mutation invalidates in-flight fetchAll');
    assert.equal(store.getState().inventory.lowStock.length, 0, 'lowStock removes item once stock exceeds reorderLevel');

    resolvePoll();
    await pollPromise;
    assert.equal(store.getState().inventory.items[0].stock, 25, 'Late background poll must NOT revert stock');
    assert.equal(store.getState().inventory.lowStock.length, 0, 'lowStock must remain consistent after stale poll');
    console.log('✓ Test 4: Background poll resolving after adjustStock.fulfilled does not revert stock');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 5: Per-request-type independence (fetchMovements does not cancel fetchAll) ---
{
  const store = configureStore({ reducer: { inventory: inventoryReducer } });
  let resolveInventory;
  let resolveMovements;
  globalThis.fetch = (url) => {
    if (String(url).includes('/movements')) {
      return new Promise((r) => {
        resolveMovements = () => r(createMockResponse([{ id: 'MOV-1', quantity: -2 }]));
      });
    }
    return new Promise((r) => {
      resolveInventory = () => r(createMockResponse([{ id: 'INV-1', productId: 'P001', productName: 'Tea', stockAvailable: 8, reorderLevel: 5, active: true, status: 'In Stock' }]));
    });
  };

  try {
    const invP = store.dispatch(fetchInventoryThunk());
    const movP = store.dispatch(fetchMovementsThunk({ limit: 50 }));
    assert.ok(store.getState().inventory.requestIds.fetchAll);
    assert.ok(store.getState().inventory.requestIds.fetchMovements);

    resolveMovements();
    await movP;
    resolveInventory();
    await invP;

    assert.equal(store.getState().inventory.items.length, 1);
    assert.equal(store.getState().inventory.movements.length, 1);
    console.log('✓ Test 5: Independent requestIds allow concurrent fetchAll & fetchMovements without cancelling each other');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 6: clearSession() / resetInventory during an in-flight thunk ---
{
  injectStore(rootStore);
  let resolveFetch;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      resolveFetch = () =>
        resolve(createMockResponse([{ id: 'INV-1', productId: 'P001', productName: 'Secret Stock', stockAvailable: 44, active: true }]));
    });

  try {
    const fetchPromise = rootStore.dispatch(fetchInventoryThunk());
    assert.ok(rootStore.getState().inventory.requestIds.fetchAll);

    // User logs out mid-request!
    clearSession();
    assert.equal(rootStore.getState().inventory.status, 'idle');
    assert.equal(rootStore.getState().inventory.requestIds.fetchAll, null);

    // Late response arrives after logout -> MUST NOT repopulate store!
    resolveFetch();
    await fetchPromise;
    assert.equal(rootStore.getState().inventory.items.length, 0, 'Late response must NOT repopulate logged-out store');
    assert.equal(rootStore.getState().inventory.status, 'idle');
    console.log('✓ Test 6: clearSession() during in-flight fetch discards late response');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 7: lowStock state vs selectLowStockItems consistency across adjust/receive/update/delete ---
{
  const store = configureStore({ reducer: { inventory: inventoryReducer } });
  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u.endsWith('/api/inventory')) {
      return Promise.resolve(createMockResponse([
        { id: 'INV-1', productId: 'P001', productName: 'Oil', stockAvailable: 5, reorderLevel: 10, status: 'Critical', active: true },
        { id: 'INV-2', productId: 'P002', productName: 'Salt', stockAvailable: 50, reorderLevel: 10, status: 'In Stock', active: true },
      ]));
    }
    if (u.includes('/api/inventory/receive')) {
      return Promise.resolve(createMockResponse({ id: 'INV-1', productId: 'P001', productName: 'Oil', stockAvailable: 30, reorderLevel: 10, status: 'In Stock', active: true }));
    }
    if (u.includes('/api/inventory/adjust')) {
      return Promise.resolve(createMockResponse({ id: 'INV-2', productId: 'P002', productName: 'Salt', stockAvailable: 4, reorderLevel: 10, status: 'Critical', active: true }));
    }
    if (u.includes('/api/inventory/INV-2') && opts.method === 'PUT') {
      return Promise.resolve(createMockResponse({ id: 'INV-2', productId: 'P002', productName: 'Salt', stockAvailable: 4, reorderLevel: 2, status: 'In Stock', active: true }));
    }
    if (u.includes('/api/inventory/INV-1') && opts.method === 'DELETE') {
      return Promise.resolve(createMockResponse({ message: 'Deleted', inventory: { id: 'INV-1' } }));
    }
    throw new Error(`Unexpected URL ${u}`);
  };

  try {
    await store.dispatch(fetchInventoryThunk());
    assert.deepEqual(selectLowStockState(store.getState()).map((i) => i.productId), ['P001']);
    assert.deepEqual(selectLowStockItems(store.getState()).map((i) => i.productId), ['P001']);

    await store.dispatch(receiveStockThunk({ productId: 'P001', quantity: 25 }));
    assert.deepEqual(selectLowStockState(store.getState()), []);
    assert.deepEqual(selectLowStockItems(store.getState()), []);

    await store.dispatch(adjustStockThunk({ productId: 'P002', adjustment: -46, reason: 'Spoiled' }));
    assert.deepEqual(selectLowStockState(store.getState()).map((i) => i.productId), ['P002']);
    assert.deepEqual(selectLowStockItems(store.getState()).map((i) => i.productId), ['P002']);

    await store.dispatch(updateInventoryThunk({ id: 'INV-2', body: { reorderLevel: 2 } }));
    assert.deepEqual(selectLowStockState(store.getState()), []);
    assert.deepEqual(selectLowStockItems(store.getState()), []);

    await store.dispatch(deleteInventoryThunk('INV-1'));
    assert.equal(selectAllInventory(store.getState()).length, 1);
    console.log('✓ Test 7: state.lowStock and selectLowStockItems stay consistent after receive/adjust/update/delete');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// PART 3: FAILURE PATHS & REMAINING ENDPOINTS
// ============================================================================

// --- Test 8: Network failure preserves previous items + consistent { message, status } error ---
{
  const store = configureStore({
    reducer: { inventory: inventoryReducer },
    preloadedState: {
      inventory: {
        items: [{ productId: 'P001', name: 'Saved Row', stock: 8, reorderLevel: 5, active: true, status: 'In Stock' }],
        lowStock: [],
        movements: [],
        selected: null,
        status: 'succeeded',
        movementsStatus: 'idle',
        saving: false,
        error: null,
        requestIds: { fetchAll: null, fetchLowStock: null, fetchMovements: null, fetchOne: null },
      },
    },
  });

  globalThis.fetch = () => Promise.reject(new TypeError('ECONNREFUSED'));
  try {
    let rejectedErr = null;
    try {
      await store.dispatch(fetchInventoryThunk()).unwrap();
    } catch (err) {
      rejectedErr = err;
    }
    assert.equal(rejectedErr.status, 0);
    assert.ok(rejectedErr.message.includes('Cannot reach'));
    assert.equal(selectInventoryStatus(store.getState()), 'failed');
    assert.ok(selectInventoryError(store.getState()).includes('Cannot reach'));
    assert.equal(selectAllInventory(store.getState()).length, 1, 'Previous items preserved on failure');

    store.dispatch(clearInventoryError());
    assert.equal(selectInventoryError(store.getState()), null);
    console.log('✓ Test 8: Network outage sets status=failed, emits { message, status }, and preserves table items');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 9: FetchById, FetchByProduct, FetchLowStock, clearMovements & 401 mid-thunk ---
{
  injectStore(rootStore);
  setAuthToken('jwt-temp');
  resetRedirectGuard();

  const store = rootStore;
  let fetchCalls = 0;
  globalThis.fetch = (url) => {
    fetchCalls += 1;
    const u = String(url);
    if (u.includes('/api/inventory/INV-007')) {
      return Promise.resolve(createMockResponse({ id: 'INV-007', productId: 'P007', productName: 'Sugar', stockAvailable: 12 }));
    }
    if (u.includes('/api/inventory/product/P007')) {
      return Promise.resolve(createMockResponse({ id: 'INV-007', productId: 'P007', productName: 'Sugar', stockAvailable: 12 }));
    }
    if (u.includes('/api/inventory/low-stock')) {
      return Promise.resolve(createMockResponse([{ id: 'INV-007', productId: 'P007', productName: 'Sugar', stockAvailable: 2, reorderLevel: 5, status: 'Critical', active: true }]));
    }
    return Promise.resolve(createMockResponse({ message: 'Token expired' }, 401));
  };

  try {
    await store.dispatch(fetchInventoryByIdThunk('INV-007')).unwrap();
    assert.equal(store.getState().inventory.selected.productId, 'P007');
    await store.dispatch(fetchInventoryByProductThunk('P007')).unwrap();
    await store.dispatch(fetchLowStockThunk()).unwrap();
    assert.equal(store.getState().inventory.lowStock.length, 1);

    // Trigger 401 mid-thunk across parallel thunks -> session cleared, no infinite retry loop
    const beforeCalls = fetchCalls;
    const r1 = store.dispatch(fetchInventoryThunk());
    const r2 = store.dispatch(fetchLowStockThunk());
    await Promise.all([r1, r2]);
    assert.equal(fetchCalls - beforeCalls, 2, 'No infinite retry loop after 401');
    assert.equal(store.getState().inventory.items.length, 0);
    assert.equal(store.getState().inventory.status, 'idle');
    assert.equal(localStorage.getItem('bb_auth_token'), null);

    store.dispatch(clearMovements());
    assert.deepEqual(store.getState().inventory.movements, []);
    console.log('✓ Test 9: 401 mid-thunk resets store cleanly without infinite retries');
  } finally {
    globalThis.fetch = originalFetch;
    resetRedirectGuard();
  }
}

// ============================================================================
// PART 4: SELECTOR MEMOIZATION & 1,000 / 5,000 ROW BENCHMARKS
// ============================================================================

{
  assert.equal(isLowStock({ stock: 5, reorderLevel: 10 }), true);
  assert.equal(isLowStock({ stock: 10, reorderLevel: 10 }), true);
  assert.equal(isLowStock({ stock: 15, reorderLevel: 10 }), false);
  assert.equal(isLowStock({ stock: '5', reorderLevel: '10' }), true);
  assert.equal(isLowStock(null), true);

  const items = [
    { productId: 'P1', name: 'Milk', cat: 'Dairy', supplier: 'Amul', stock: 10, reorderLevel: 20, active: true, price: 50, costPrice: 40, status: 'Low Stock' },
    { productId: 'P2', name: 'Bread', cat: 'Bakery', supplier: 'Britannia', stock: 50, reorderLevel: 10, active: true, price: 40, costPrice: 30, status: 'In Stock' },
    { productId: 'P3', name: 'Soap', cat: 'Care', supplier: 'HUL', stock: 2, reorderLevel: 10, active: false, price: 30, costPrice: 20, status: 'Critical' },
  ];

  const baseState = {
    inventory: { items, lowStock: [], movements: [], status: 'succeeded', error: null },
    ui: { theme: 'dark' },
  };
  const nextUiState = { ...baseState, ui: { theme: 'light' } };

  const activeA = selectActiveCatalog(baseState);
  const activeB = selectActiveCatalog(nextUiState);
  assert.equal(activeA, activeB, 'selectActiveCatalog maintains referential identity');

  const lowA = selectLowStockItems(baseState);
  const lowB = selectLowStockItems(nextUiState);
  assert.equal(lowA, lowB);

  const dashA = selectLowStockForDashboard(baseState);
  const dashB = selectLowStockForDashboard(nextUiState);
  assert.equal(dashA, dashB);

  const catsA = selectInventoryCategories(baseState);
  const catsB = selectInventoryCategories(nextUiState);
  assert.equal(catsA, catsB);

  const supsA = selectInventorySupplierNames(baseState);
  const supsB = selectInventorySupplierNames(nextUiState);
  assert.equal(supsA, supsB);

  const valA = selectInventoryValuation(baseState);
  const valB = selectInventoryValuation(nextUiState);
  assert.equal(valA, valB);
  assert.equal(valA.retailValue, 2500);
  assert.equal(valA.costValue, 1900);
  assert.equal(valA.totalUnits, 60);

  // Changed input -> new reference
  const changedInventoryState = {
    ...baseState,
    inventory: {
      ...baseState.inventory,
      items: [...items, { productId: 'P4', name: 'Eggs', cat: 'Dairy', supplier: 'Local', stock: 1, reorderLevel: 5, active: true, price: 60, costPrice: 45, status: 'Critical' }],
    },
  };
  assert.notEqual(selectLowStockForDashboard(changedInventoryState), dashA, 'Changed items produces new selector reference');
  assert.deepEqual(selectLowStockForDashboard(changedInventoryState).map((r) => r.productId), ['P4', 'P1']);

  console.log('✓ Test 10: Memoized selectors preserve identical refs on unchanged input & recompute on change');
}

// --- Test 11: 1,000-row & 5,000-row selector benchmarks ---
function runBenchmark(count) {
  const categories = ['Beverages', 'Bakery', 'Dairy', 'Snacks', 'Personal Care'];
  const bigItems = [];
  for (let i = 0; i < count; i++) {
    const stock = i % 20;
    bigItems.push({
      productId: `PRD-${i}`,
      inventoryId: `INV-${i}`,
      name: `Product ${i}`,
      cat: categories[i % categories.length],
      supplier: `Supplier ${i % 15}`,
      stock,
      reorderLevel: 10,
      price: 10 + (i % 100),
      costPrice: 8 + (i % 80),
      active: i % 10 !== 0,
      status: stock <= 0 ? 'Out of Stock' : stock <= 5 ? 'Critical' : stock <= 10 ? 'Low Stock' : 'In Stock',
    });
  }

  const bigState = {
    inventory: { items: bigItems, lowStock: [], movements: [], status: 'succeeded', error: null },
    ui: { theme: 'dark' },
  };

  const t0 = performance.now();
  const low = selectLowStockItems(bigState);
  const dash = selectLowStockForDashboard(bigState);
  const val = selectInventoryValuation(bigState);
  const cats = selectInventoryCategories(bigState);
  const firstMs = performance.now() - t0;

  assert.ok(low.length > 0);
  assert.ok(dash.length > 0);
  assert.ok(val.retailValue > 0);
  assert.equal(cats.length, 5);

  const t1 = performance.now();
  for (let j = 0; j < 10000; j++) {
    selectLowStockItems(bigState);
    selectLowStockForDashboard(bigState);
    selectInventoryValuation(bigState);
    selectInventoryCategories(bigState);
  }
  const cacheMs = performance.now() - t1;
  return { firstMs, cacheMs };
}

{
  const r1k = runBenchmark(1000);
  const r5k = runBenchmark(5000);
  assert.ok(r5k.cacheMs < 50, '10,000 memoized cache lookups for 5,000 items must stay near zero-cost');
  console.log(`✓ Test 11: Benchmarks passed:`);
  console.log(`   - 1,000 rows: first compute ${r1k.firstMs.toFixed(3)} ms | 10,000 cache hits ${r1k.cacheMs.toFixed(3)} ms`);
  console.log(`   - 5,000 rows: first compute ${r5k.firstMs.toFixed(3)} ms | 10,000 cache hits ${r5k.cacheMs.toFixed(3)} ms`);
}

console.log('\n========================================================================');
console.log('🎉 ALL 11 HARDENED INVENTORY SLICE & BENCHMARK TESTS PASSED!');
console.log('========================================================================\n');

})();

// ============================================================================
// MERGED FROM: otherSlices.test.js
// ============================================================================
await (async () => {
console.log('🧪 Starting unit test suite for productsSlice, suppliersSlice, uploadsSlice & cross-slice logout...\n');

if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}
if (typeof globalThis.sessionStorage === 'undefined') {
  const smap = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (smap.has(k) ? smap.get(k) : null),
    setItem: (k, v) => smap.set(k, String(v)),
    removeItem: (k) => smap.delete(k),
    clear: () => smap.clear(),
  };
}

const originalFetch = globalThis.fetch;
function mockRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// PART 1: productsSlice (CRUD, soft-delete, 409, race guard, selectors)
// ============================================================================
{
  const store = configureStore({ reducer: { products: productsReducer } });

  let resolveSlow;
  let resolveFast;
  let callNum = 0;

  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u.includes('/categories')) return Promise.resolve(mockRes(['Dairy', 'Groceries']));
    if (u.includes('/barcode/8901200001')) return Promise.resolve(mockRes({ id: 'P001', name: 'Basmati Rice', active: true, category: 'Groceries' }));
    if (u.includes('/activity')) return Promise.resolve(mockRes([{ id: 'ACT-1', summary: 'Price updated' }]));
    if (u.endsWith('/api/products/P001') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes({ id: 'P001', name: 'Basmati Rice', active: true, category: 'Groceries', version: 2 }));
    }
    if (u.endsWith('/api/products') && opts?.method === 'POST') {
      return Promise.resolve(mockRes({ id: 'P050', name: 'Poha', active: true, category: 'Groceries', version: 1 }, 201));
    }
    if (u.endsWith('/api/products/P050') && opts?.method === 'PUT') {
      return Promise.resolve(mockRes({ message: 'Product P050 was modified elsewhere' }, 409));
    }
    if (u.endsWith('/api/products/P050') && opts?.method === 'DELETE') {
      return Promise.resolve(mockRes({ message: 'Product P050 deactivated', product: { id: 'P050', name: 'Poha', active: false, category: 'Groceries', version: 2 } }));
    }
    callNum += 1;
    if (callNum === 1) {
      return new Promise((r) => {
        resolveSlow = () => r(mockRes([{ id: 'P001', name: 'Stale Rice', active: true, category: 'Groceries' }]));
      });
    }
    return new Promise((r) => {
      resolveFast = () => r(mockRes([{ id: 'P001', name: 'Fresh Rice', active: true, category: 'Groceries' }]));
    });
  };

  try {
    // Overlapping fetchProductsThunk out-of-order check
    const pSlow = store.dispatch(fetchProductsThunk({ includeInactive: 'true' }));
    const pFast = store.dispatch(fetchProductsThunk({ includeInactive: 'true' }));
    resolveFast();
    await pFast;
    resolveSlow();
    await pSlow;
    assert.equal(selectAllProducts(store.getState())[0].name, 'Fresh Rice');

    await store.dispatch(fetchProductCategoriesThunk());
    assert.deepEqual(selectProductCategories(store.getState()), ['Dairy', 'Groceries']);

    await store.dispatch(fetchProductByIdThunk('P001'));
    assert.equal(selectSelectedProduct(store.getState()).id, 'P001');

    await store.dispatch(fetchProductByBarcodeThunk({ barcode: '8901200001' }));
    await store.dispatch(fetchProductActivityThunk({ productId: 'P001' }));
    assert.equal(selectActivityByProduct(store.getState()).P001.length, 1);

    // DB-first pending check
    const pendingCreate = store.dispatch(createProductThunk({ name: 'Poha', category: 'Groceries', price: 45, supplierId: 'SUP-001' }));
    assert.equal(selectProductsSaving(store.getState()), true);
    assert.equal(selectAllProducts(store.getState()).length, 1, 'Pending create must not insert product optimistically');
    await pendingCreate.unwrap();
    assert.equal(selectProductsSaving(store.getState()), false);
    assert.equal(selectAllProducts(store.getState()).length, 2);

    // 409 version conflict on update
    let conflictErr = null;
    try {
      await store.dispatch(updateProductThunk({ id: 'P050', body: { price: 99, version: 0 } })).unwrap();
    } catch (err) {
      conflictErr = err;
    }
    assert.equal(conflictErr.status, 409);
    assert.ok(conflictErr.message.includes('modified elsewhere'));

    // Soft-delete preserves record with active=false
    await store.dispatch(deleteProductThunk('P050')).unwrap();
    assert.equal(selectAllProducts(store.getState()).length, 2, 'Soft-delete keeps deactivated item for Show Inactive');
    assert.equal(selectActiveProducts(store.getState()).length, 1);
    assert.deepEqual(selectDerivedProductCategories(store.getState()), ['Groceries']);

    store.dispatch(clearSelectedProduct());
    store.dispatch(clearProductsError());
    assert.equal(selectSelectedProduct(store.getState()), null);

    store.dispatch(resetProducts());
    assert.equal(selectAllProducts(store.getState()).length, 0);
    console.log('✓ Test 1: productsSlice CRUD, soft-delete, 409 conflict & race guard passed');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// PART 2: suppliersSlice (CRUD, 409 conflict, sorted memoization)
// ============================================================================
{
  const store = configureStore({ reducer: { suppliers: suppliersReducer } });
  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u.endsWith('/api/suppliers') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes([{ id: 'SUP-002', name: 'Zebra Foods', version: 1 }, { id: 'SUP-001', name: 'Alpha Dairy', version: 1 }]));
    }
    if (u.endsWith('/api/suppliers/SUP-001') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes({ id: 'SUP-001', name: 'Alpha Dairy', version: 1 }));
    }
    if (u.endsWith('/api/suppliers') && opts?.method === 'POST') {
      return Promise.resolve(mockRes({ id: 'SUP-003', name: 'Beta Spices', version: 1 }, 201));
    }
    if (u.endsWith('/api/suppliers/SUP-003') && opts?.method === 'PUT') {
      return Promise.resolve(mockRes({ id: 'SUP-003', name: 'Beta Spices Co', version: 2 }));
    }
    if (u.endsWith('/api/suppliers/SUP-001') && opts?.method === 'DELETE') {
      return Promise.resolve(mockRes({ message: 'Alpha Dairy is linked to 3 product(s)' }, 409));
    }
    if (u.endsWith('/api/suppliers/SUP-003') && opts?.method === 'DELETE') {
      return Promise.resolve(mockRes({ message: 'Supplier SUP-003 deleted' }));
    }
    throw new Error(`Unexpected URL ${u}`);
  };

  try {
    await store.dispatch(fetchSuppliersThunk()).unwrap();
    const sorted1 = selectSortedSuppliers(store.getState());
    const sorted2 = selectSortedSuppliers(store.getState());
    assert.equal(sorted1, sorted2, 'selectSortedSuppliers returns identical reference');
    assert.deepEqual(sorted1.map((s) => s.name), ['Alpha Dairy', 'Zebra Foods']);

    await store.dispatch(fetchSupplierByIdThunk('SUP-001')).unwrap();
    assert.equal(selectSelectedSupplier(store.getState()).id, 'SUP-001');

    const pCreate = store.dispatch(createSupplierThunk({ name: 'Beta Spices', mobileNo: '9876543210' }));
    assert.equal(selectSuppliersSaving(store.getState()), true);
    await pCreate.unwrap();
    assert.equal(selectSuppliersSaving(store.getState()), false);
    assert.equal(selectAllSuppliers(store.getState()).length, 3);

    await store.dispatch(updateSupplierThunk({ id: 'SUP-003', body: { name: 'Beta Spices Co', version: 1 } })).unwrap();
    assert.ok(selectAllSuppliers(store.getState()).some((s) => s.name === 'Beta Spices Co'));

    let linkedErr = null;
    try {
      await store.dispatch(deleteSupplierThunk('SUP-001')).unwrap();
    } catch (err) {
      linkedErr = err;
    }
    assert.equal(linkedErr.status, 409);

    await store.dispatch(deleteSupplierThunk('SUP-003')).unwrap();
    assert.equal(selectAllSuppliers(store.getState()).length, 2);

    store.dispatch(clearSelectedSupplier());
    store.dispatch(clearSuppliersError());
    store.dispatch(resetSuppliers());
    assert.equal(selectAllSuppliers(store.getState()).length, 0);
    console.log('✓ Test 2: suppliersSlice CRUD, 409 linked-product guard & sorted memoization passed');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// PART 3: uploadsSlice (image, partial CSV import, attach image, error handling)
// ============================================================================
{
  const store = configureStore({ reducer: { uploads: uploadsReducer } });
  const partialSummary = {
    file: { id: 'UPL-002', originalName: 'bulk.csv', kind: 'import' },
    totalRows: 3,
    imported: 2,
    failed: 1,
    createdProductIds: ['P030', 'P031'],
    errors: [{ row: 3, reason: 'price must be more than 0' }],
  };

  globalThis.fetch = (url, opts) => {
    const u = String(url);
    if (u.endsWith('/api/uploads') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes([{ id: 'UPL-001', kind: 'image' }]));
    }
    if (u.endsWith('/api/uploads/UPL-001') && (!opts?.method || opts.method === 'GET')) {
      return Promise.resolve(mockRes({ id: 'UPL-001', kind: 'image', originalName: 'pic.png' }));
    }
    if (u.endsWith('/api/uploads/image')) {
      return Promise.resolve(mockRes({ id: 'UPL-003', kind: 'image', url: '/uploads/images/pic.png' }, 201));
    }
    if (u.endsWith('/api/uploads/products/csv')) {
      return Promise.resolve(mockRes(partialSummary, 201));
    }
    if (u.endsWith('/api/uploads/products/P001/image')) {
      return Promise.resolve(mockRes({ product: { id: 'P001', imageUrl: '/uploads/images/p1.png' }, upload: { id: 'UPL-004', kind: 'image' } }, 201));
    }
    if (u.endsWith('/api/uploads/UPL-099')) {
      return Promise.resolve(mockRes({ message: 'Unsupported file type "text/plain"' }, 400));
    }
    if (u.endsWith('/api/uploads/UPL-001') && opts?.method === 'DELETE') {
      return Promise.resolve(mockRes({ message: 'Deleted' }));
    }
    throw new Error(`Unexpected URL ${u}`);
  };

  try {
    await store.dispatch(fetchUploadsThunk()).unwrap();
    await store.dispatch(fetchUploadByIdThunk('UPL-001')).unwrap();
    assert.equal(selectSelectedUpload(store.getState()).id, 'UPL-001');

    const imgBlob = new Blob(['png'], { type: 'image/png' });
    const upPromise = store.dispatch(uploadImageThunk(imgBlob));
    assert.equal(selectUploadsUploading(store.getState()), true);
    await upPromise.unwrap();
    assert.equal(selectUploadsUploading(store.getState()), false);
    assert.equal(selectLastUploaded(store.getState()).id, 'UPL-003');

    const csvBlob = new Blob(['name,category,price,supplierId\nTea,Drinks,50,SUP-001\n'], { type: 'text/csv' });
    await store.dispatch(importProductsCsvThunk({ file: csvBlob, companyId: 'BIZ-101' })).unwrap();
    assert.equal(selectLastImportSummary(store.getState()).imported, 2);
    assert.equal(selectLastImportSummary(store.getState()).failed, 1);
    assert.equal(selectLastImportSummary(store.getState()).errors[0].row, 3);

    await store.dispatch(attachProductImageThunk({ productId: 'P001', file: imgBlob })).unwrap();
    assert.equal(selectImageUploads(store.getState()).length, 3);
    assert.equal(selectImportUploads(store.getState()).length, 1);

    await store.dispatch(deleteUploadThunk('UPL-001')).unwrap();
    assert.equal(selectAllUploads(store.getState()).some((u) => u.id === 'UPL-001'), false);

    store.dispatch(clearLastImportSummary());
    assert.equal(selectLastImportSummary(store.getState()), null);

    let badErr = null;
    try {
      await store.dispatch(deleteUploadThunk('UPL-099')).unwrap();
    } catch (err) {
      badErr = err;
    }
    assert.equal(badErr.status, 400);

    store.dispatch(clearUploadsError());
    assert.equal(selectUploadsError(store.getState()), null);

    store.dispatch(resetUploads());
    assert.equal(selectAllUploads(store.getState()).length, 0);
    console.log('✓ Test 3: uploadsSlice image, partial CSV summary, attach & delete passed');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// PART 4: Root Store Cross-Slice Logout Reset (clearSession resets ALL 4 slices)
// ============================================================================
{
  injectStore(rootStore);
  rootStore.dispatch(toggleTheme());
  const themeBefore = rootStore.getState().ui.theme;

  rootStore.dispatch({
    type: fetchProductsThunk.fulfilled.type,
    meta: { requestId: rootStore.getState().products.requestIds.fetchAll },
    payload: [{ id: 'P1', name: 'Prod' }],
  });

  // Populate via real mock fetch
  globalThis.fetch = (url) => {
    const u = String(url);
    if (u.includes('/products')) return Promise.resolve(mockRes([{ id: 'P1', name: 'Prod', active: true }]));
    if (u.includes('/suppliers')) return Promise.resolve(mockRes([{ id: 'SUP-1', name: 'Vendor' }]));
    if (u.includes('/uploads')) return Promise.resolve(mockRes([{ id: 'UPL-1', kind: 'image' }]));
    return Promise.resolve(mockRes([{ id: 'INV-1', productId: 'P1', productName: 'Prod', stockAvailable: 10, active: true }]));
  };

  try {
    await rootStore.dispatch(fetchProductsThunk());
    await rootStore.dispatch(fetchSuppliersThunk());
    await rootStore.dispatch(fetchUploadsThunk());

    assert.equal(rootStore.getState().products.items.length, 1);
    assert.equal(rootStore.getState().suppliers.items.length, 1);
    assert.equal(rootStore.getState().uploads.items.length, 1);

    clearSession();

    assert.equal(rootStore.getState().products.items.length, 0);
    assert.equal(rootStore.getState().inventory.items.length, 0);
    assert.equal(rootStore.getState().suppliers.items.length, 0);
    assert.equal(rootStore.getState().uploads.items.length, 0);
    assert.equal(rootStore.getState().ui.theme, themeBefore, 'Logout must keep user UI theme preference');
    console.log('✓ Test 4: clearSession() resets all 4 domain slices cleanly while preserving UI state');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('\n========================================================================');
console.log('🎉 ALL PRODUCTS, SUPPLIERS, UPLOADS & ROOT STORE TESTS PASSED!');
console.log('========================================================================\n');

})();

// ============================================================================
// MERGED FROM: ordersSlice.test.js
// ============================================================================
await (async () => {
console.log('🧪 Starting exhaustive test suite for ordersSlice & Redux store integration...\n');

// ============================================================================
// PART 1: REDUCER UNIT TESTS & STATE LIFECYCLE
// ============================================================================

// --- Test 1: Initial State Isolation ---
{
  const state = ordersReducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.orders, []);
  assert.equal(state.selectedOrderId, null);
  assert.equal(state.loading, false);
  assert.equal(state.error, null);
  assert.equal(state.filters.status, 'all');
  assert.equal(state.filters.search, '');
  assert.equal(state.filters.sort, 'newest');
  console.log('✓ Test 1: Initial state is clean, isolated, and matches schema');
}

// --- Test 2: Synchronous Filter Actions ---
{
  let state = ordersReducer(undefined, setFilter({ key: 'status', value: 'Processing' }));
  assert.equal(state.filters.status, 'Processing');

  state = ordersReducer(state, setFilter({ key: 'search', value: 'ORD-101' }));
  assert.equal(state.filters.search, 'ORD-101');

  state = ordersReducer(state, setFilter({ key: 'paymentMethod', value: 'UPI' }));
  assert.equal(state.filters.paymentMethod, 'UPI');
  assert.equal(state.filters.payment, 'UPI'); // synched

  state = ordersReducer(state, resetFilters());
  assert.equal(state.filters.status, 'all');
  assert.equal(state.filters.search, '');
  assert.equal(state.filters.paymentMethod, 'all');
  console.log('✓ Test 2: setFilter and resetFilters update and restore draft correctly');
}

// --- Test 3: Order Selection Actions ---
{
  let state = ordersReducer(undefined, setSelectedOrder('ORD-90210'));
  assert.equal(state.selectedOrderId, 'ORD-90210');

  state = ordersReducer(state, clearSelectedOrder());
  assert.equal(state.selectedOrderId, null);
  console.log('✓ Test 3: setSelectedOrder & clearSelectedOrder manage bill modal target safely');
}

// --- Test 4: Async Lifecycle for fetchOrdersThunk ---
{
  // Pending
  let state = ordersReducer(undefined, { type: fetchOrdersThunk.pending.type });
  assert.equal(state.loading, true);
  assert.equal(state.error, null);

  // Fulfilled
  const mockOrders = [
    { id: 'ORD-1', status: 'Completed', total: 1200, items: 3, orderDate: '2026-11-20T10:00:00Z', customer: 'Alice' },
    { id: 'ORD-2', status: 'Pending', total: 450, items: 1, orderDate: '2026-11-21T10:00:00Z', customer: 'Bob' },
  ];
  state = ordersReducer(state, { type: fetchOrdersThunk.fulfilled.type, payload: mockOrders });
  assert.equal(state.loading, false);
  assert.equal(state.orders.length, 2);
  assert.equal(state.orders[0].id, 'ORD-1');

  // Rejected
  state = ordersReducer(state, { type: fetchOrdersThunk.rejected.type, payload: 'Network failure' });
  assert.equal(state.loading, false);
  assert.equal(state.error, 'Network failure');
  console.log('✓ Test 4: fetchOrdersThunk pending/fulfilled/rejected lifecycle transitions verified');
}

// --- Test 5: cancelOrderThunk DB-First Replacement ---
{
  const initialStateWithOrders = {
    orders: [
      { id: 'ORD-A', status: 'Pending', total: 300, version: 1 },
      { id: 'ORD-B', status: 'Completed', total: 600, version: 1 },
    ],
    selectedOrderId: null,
    filters: initialFilters,
    loading: false,
    saving: false,
    error: null,
  };

  const state = ordersReducer(initialStateWithOrders, {
    type: cancelOrderThunk.fulfilled.type,
    payload: { id: 'ORD-A', status: 'Cancelled', total: 300, version: 2 },
  });

  assert.equal(state.orders[0].status, 'Cancelled');
  assert.equal(state.orders[0].version, 2);
  assert.equal(state.orders[1].status, 'Completed');
  console.log('✓ Test 5: cancelOrderThunk replaces order with DB response without affecting other items');
}

// --- Test 6: deleteOrderThunk State Pruning ---
{
  const initialStateWithOrders = {
    orders: [
      { id: 'ORD-A', status: 'Cancelled' },
      { id: 'ORD-B', status: 'Completed' },
    ],
    selectedOrderId: null,
    filters: initialFilters,
    loading: false,
    error: null,
  };

  const state = ordersReducer(initialStateWithOrders, {
    type: deleteOrderThunk.fulfilled.type,
    payload: 'ORD-A',
  });

  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].id, 'ORD-B');
  console.log('✓ Test 6: deleteOrderThunk cleanly removes cancelled order from array');
}

// ============================================================================
// PART 2: MEMOIZED SELECTORS & REFERENTIAL STABILITY
// ============================================================================

// --- Test 7: selectOrderMetrics Calculations ---
{
  const testState = {
    orders: {
      orders: [
        { id: 'O1', status: 'Completed', total: 500 },
        { id: 'O2', status: 'Delivered', total: 300 },
        { id: 'O3', status: 'Pending', total: 200 },
        { id: 'O4', status: 'Processing', total: 100 },
        { id: 'O5', status: 'Cancelled', total: 50 },
      ],
      selectedOrderId: null,
      filters: initialFilters,
      loading: false,
      error: null,
    },
  };

  const metrics = selectOrderMetrics(testState);
  assert.equal(metrics.totalRevenue, 1150);
  assert.equal(metrics.completedCount, 2);
  assert.equal(metrics.pendingCount, 2);
  assert.equal(metrics.cancelledCount, 1);
  console.log('✓ Test 7: selectOrderMetrics derives aggregate sums and status counts');
}

// --- Test 8: selectFilteredOrders Multi-Filter Logic ---
{
  const testState = {
    orders: {
      orders: [
        { id: 'ORD-101', customer: 'John Doe', status: 'Completed', payment: 'UPI', orderDate: '2026-11-20T10:00:00Z', total: 500 },
        { id: 'ORD-102', customer: 'Jane Smith', status: 'Pending', payment: 'Cash', orderDate: '2026-11-21T10:00:00Z', total: 300 },
        { id: 'ORD-103', customer: 'Johnathan Ray', status: 'Cancelled', payment: 'UPI', orderDate: '2026-11-22T10:00:00Z', total: 200 },
      ],
      selectedOrderId: 'ORD-101',
      filters: { ...initialFilters, status: 'all', search: 'John' },
      loading: false,
      error: null,
    },
  };

  // Search filter
  const searchResults = selectFilteredOrders(testState);
  assert.equal(searchResults.length, 2);
  assert.equal(searchResults[0].id, 'ORD-103'); // newest first
  assert.equal(searchResults[1].id, 'ORD-101');

  // Status + Search
  const filteredState = {
    ...testState,
    orders: {
      ...testState.orders,
      filters: { ...initialFilters, status: 'Completed', search: 'John' },
    },
  };
  const statusResults = selectFilteredOrders(filteredState);
  assert.equal(statusResults.length, 1);
  assert.equal(statusResults[0].id, 'ORD-101');
  console.log('✓ Test 8: selectFilteredOrders accurately filters across search, status, and sort criteria');
}

// --- Test 9: Referential Stability & Memoization Cache Hit ---
{
  const testState = {
    orders: {
      orders: [{ id: '1', status: 'Completed', total: 100 }],
      selectedOrderId: null,
      filters: initialFilters,
      loading: false,
      error: null,
    },
    ui: { theme: 'light' },
  };

  const firstCall = selectFilteredOrders(testState);
  // Modify unrelated UI slice
  const nextState = { ...testState, ui: { theme: 'dark' } };
  const secondCall = selectFilteredOrders(nextState);

  assert.equal(firstCall, secondCall, 'Selector must return identical cached reference');
  console.log('✓ Test 9: createSelector memoization guarantees referential stability when unrelated state changes');
}

// ============================================================================
// PART 3: ROOT STORE INTEGRATION & SUBSCRIPTION
// ============================================================================

// --- Test 10: Root Store Co-existence ---
{
  const rootState = rootStore.getState();
  assert.ok(rootState.orders, 'orders slice must exist in rootStore');
  assert.ok(rootState.inventory, 'inventory slice must exist in rootStore');
  assert.ok(rootState.delivery, 'delivery slice must exist in rootStore');
  assert.ok(rootState.ui, 'ui slice must exist in rootStore');

  // Dispatch through root store
  rootStore.dispatch(setSelectedOrder('ORD-ROOT-TEST'));
  assert.equal(rootStore.getState().orders.selectedOrderId, 'ORD-ROOT-TEST');
  rootStore.dispatch(clearSelectedOrder());
  assert.equal(rootStore.getState().orders.selectedOrderId, null);
  console.log('✓ Test 10: Root store co-exists cleanly with ui, delivery, and inventory domains');
}

// --- Test 11: New DB-First Thunks & selectOrdersSummary ---
{
  let state = ordersReducer(undefined, { type: quoteOrderThunk.fulfilled.type, payload: { total: 850 } });
  assert.equal(state.quote.total, 850);

  state = ordersReducer(state, { type: placeOrderThunk.pending.type });
  assert.equal(state.saving, true);
  state = ordersReducer(state, {
    type: placeOrderThunk.fulfilled.type,
    payload: { id: 'ORD-NEW', status: 'Completed', total: 850, version: 1 },
  });
  assert.equal(state.saving, false);
  assert.equal(state.orders[0].id, 'ORD-NEW');
  assert.equal(state.lastPlacedOrder.id, 'ORD-NEW');

  state = ordersReducer(state, {
    type: updateOrderThunk.fulfilled.type,
    payload: { id: 'ORD-NEW', status: 'Completed', total: 850, customer: 'Updated Name', version: 2 },
  });
  assert.equal(state.orders[0].customer, 'Updated Name');
  assert.equal(state.orders[0].version, 2);

  state = ordersReducer(state, {
    type: fetchOrderByIdThunk.fulfilled.type,
    payload: { id: 'ORD-NEW', bill: { billNo: 'BILL-9' }, items: [] },
  });
  assert.equal(state.selectedOrder.bill.billNo, 'BILL-9');

  state = ordersReducer(state, {
    type: fetchBillByNoThunk.fulfilled.type,
    payload: { billNo: 'BILL-9', total: 850 },
  });
  assert.equal(state.selectedBill.billNo, 'BILL-9');

  const summary = selectOrdersSummary({ orders: state });
  assert.equal(summary.totalCount, 1);
  assert.equal(summary.totalRevenue, 850);
  assert.equal(summary.completedCount, 1);
  console.log('✓ Test 11: placeOrderThunk, updateOrderThunk, fetchOrderByIdThunk, fetchBillByNoThunk, quoteOrderThunk, and selectOrdersSummary verified');
}

console.log('\n========================================================================');
console.log('🎉 ALL 11 ORDERS SLICE & ROOT STORE TESTS PASSED FLAWLESSLY!');
console.log('========================================================================\n');

})();

// ============================================================================
// MERGED FROM: couponsAndReportsSlices.test.js
// ============================================================================
await (async () => {
console.log('🧪 Starting unit test suite for couponsSlice & reportsSlice...\n');

// ============================================================================
// PART 1: couponsSlice
// ============================================================================

// --- Test 1: Initial State & Sync Reducers ---
{
  let state = couponsReducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.items, []);
  assert.equal(state.analytics, null);
  assert.equal(state.validationResult, null);
  assert.equal(state.status, 'idle');
  assert.equal(state.analyticsStatus, 'idle');
  assert.equal(state.saving, false);
  assert.equal(state.error, null);

  state = couponsReducer(
    { ...state, error: 'Some error', validationResult: { valid: true } },
    clearCouponsError(),
  );
  assert.equal(state.error, null);
  state = couponsReducer(state, clearValidationResult());
  assert.equal(state.validationResult, null);
  state = couponsReducer({ ...state, items: [{ id: 'CPN-1' }], status: 'succeeded' }, resetCoupons());
  assert.deepEqual(state.items, []);
  assert.equal(state.status, 'idle');
  console.log('✓ Test 1: couponsSlice initial state and sync reducers verified');
}

// --- Test 2: fetchCouponsThunk & fetchCouponAnalyticsThunk ---
{
  let state = couponsReducer(undefined, { type: fetchCouponsThunk.pending.type });
  assert.equal(state.status, 'loading');
  state = couponsReducer(state, {
    type: fetchCouponsThunk.fulfilled.type,
    payload: [
      { id: 'CPN-1', code: 'SAVE10', active: true },
      { id: 'CPN-2', code: 'OLD20', active: false },
    ],
  });
  assert.equal(state.status, 'succeeded');
  assert.equal(state.items.length, 2);

  state = couponsReducer(state, { type: fetchCouponAnalyticsThunk.pending.type });
  assert.equal(state.analyticsStatus, 'loading');
  state = couponsReducer(state, {
    type: fetchCouponAnalyticsThunk.fulfilled.type,
    payload: { totalUses: 12, totalDiscount: 650 },
  });
  assert.equal(state.analyticsStatus, 'succeeded');
  assert.equal(state.analytics.totalUses, 12);

  state = couponsReducer(state, {
    type: fetchCouponAnalyticsThunk.rejected.type,
    payload: { message: 'Analytics unavailable' },
  });
  assert.equal(state.analyticsStatus, 'failed');
  assert.equal(state.error, 'Analytics unavailable');
  console.log('✓ Test 2: fetchCouponsThunk & fetchCouponAnalyticsThunk lifecycles verified');
}

// --- Test 3: createCouponThunk, updateCouponThunk, validateCouponThunk ---
{
  let state = couponsReducer(undefined, { type: createCouponThunk.pending.type });
  assert.equal(state.saving, true);

  state = couponsReducer(state, {
    type: createCouponThunk.fulfilled.type,
    payload: { id: 'CPN-10', code: 'NEW10', active: true, version: 1 },
  });
  assert.equal(state.saving, false);
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].version, 1);

  state = couponsReducer(state, { type: updateCouponThunk.pending.type });
  assert.equal(state.saving, true);
  state = couponsReducer(state, {
    type: updateCouponThunk.fulfilled.type,
    payload: { id: 'CPN-10', code: 'NEW10', active: false, version: 2 },
  });
  assert.equal(state.saving, false);
  assert.equal(state.items[0].active, false);
  assert.equal(state.items[0].version, 2);

  state = couponsReducer(state, {
    type: validateCouponThunk.fulfilled.type,
    payload: { valid: true, code: 'NEW10', discount: 100 },
  });
  assert.equal(state.validationResult.discount, 100);

  state = couponsReducer(state, {
    type: validateCouponThunk.rejected.type,
    payload: { message: 'Coupon expired' },
  });
  assert.equal(state.validationResult, null);
  assert.equal(state.error, 'Coupon expired');
  console.log('✓ Test 3: createCouponThunk, updateCouponThunk, and validateCouponThunk verified');
}

// --- Test 4: deleteCouponThunk.fulfilled (hard-delete vs backend deactivation) ---
{
  const startState = {
    items: [
      { id: 'CPN-1', code: 'UNUSED', active: true, version: 1 },
      { id: 'CPN-2', code: 'USED', active: true, version: 1 },
      { id: 'CPN-3', code: 'USED2', active: true, version: 1 },
    ],
    analytics: null,
    validationResult: null,
    status: 'succeeded',
    analyticsStatus: 'idle',
    saving: false,
    error: null,
  };

  // Branch A: Hard delete (unused coupon) -> removed from items
  let state = couponsReducer(startState, {
    type: deleteCouponThunk.fulfilled.type,
    payload: {
      id: 'CPN-1',
      response: { message: 'Coupon UNUSED deleted', coupon: { id: 'CPN-1', code: 'UNUSED', active: true } },
    },
  });
  assert.equal(state.items.length, 2);
  assert.equal(state.items.find((c) => c.id === 'CPN-1'), undefined);

  // Branch B: Backend deactivation ("switched off instead of deleted") -> updated in place
  state = couponsReducer(state, {
    type: deleteCouponThunk.fulfilled.type,
    payload: {
      id: 'CPN-2',
      response: {
        message: 'Coupon USED is on 3 bill(s), so it was switched off instead of deleted',
        coupon: { id: 'CPN-2', code: 'USED', active: false, version: 2 },
      },
    },
  });
  assert.equal(state.items.length, 2);
  const updatedCpn2 = state.items.find((c) => c.id === 'CPN-2');
  assert.equal(updatedCpn2.active, false);
  assert.equal(updatedCpn2.version, 2);

  // Branch C: Explicit deactivated flag -> updated in place
  state = couponsReducer(state, {
    type: deleteCouponThunk.fulfilled.type,
    payload: {
      id: 'CPN-3',
      response: { deactivated: true, coupon: { id: 'CPN-3', code: 'USED2', active: false, version: 2 } },
    },
  });
  assert.equal(state.items.find((c) => c.id === 'CPN-3').active, false);
  console.log('✓ Test 4: deleteCouponThunk handles both hard-delete and backend deactivation');
}

// --- Test 5: couponsSlice selectors ---
{
  const root = {
    coupons: {
      items: [
        { id: 'CPN-1', code: 'LIVE', active: true },
        { id: 'CPN-2', code: 'OFF', active: false },
      ],
    },
  };
  assert.equal(selectCouponById(root, 'CPN-2').code, 'OFF');
  assert.equal(selectActiveCoupons(root).length, 1);
  assert.equal(selectActiveCoupons(root)[0].id, 'CPN-1');
  console.log('✓ Test 5: selectCouponById & selectActiveCoupons verified');
}

// ============================================================================
// PART 2: reportsSlice
// ============================================================================

// --- Test 6: reportsSlice independent loading flags & thunks ---
{
  let state = reportsReducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.loading, { sales: false, inventory: false, returns: false });
  assert.equal(state.sales, null);
  assert.equal(state.inventory, null);
  assert.equal(state.returns, null);

  // Pending sales does not affect inventory or returns
  state = reportsReducer(state, { type: fetchSalesReportThunk.pending.type });
  assert.equal(state.loading.sales, true);
  assert.equal(state.loading.inventory, false);
  assert.equal(state.loading.returns, false);

  // Pending inventory simultaneously
  state = reportsReducer(state, { type: fetchInventoryReportThunk.pending.type });
  assert.equal(state.loading.sales, true);
  assert.equal(state.loading.inventory, true);
  assert.equal(state.loading.returns, false);

  state = reportsReducer(state, {
    type: fetchSalesReportThunk.fulfilled.type,
    payload: { totals: { net: 10000 } },
    meta: { arg: { from: '2026-11-26', to: '2026-11-26' } },
  });
  state = reportsReducer(state, {
    type: fetchSalesReportThunk.fulfilled.type,
    payload: { totals: { net: 45000 } },
    meta: { arg: { from: '2026-10-27', to: '2026-11-26' } },
  });
  assert.equal(state.loading.sales, false);
  assert.equal(state.loading.inventory, true);
  assert.equal(selectSalesReportFor({ reports: state }, '2026-11-26', '2026-11-26').totals.net, 10000);
  assert.equal(selectSalesReportFor({ reports: state }, '2026-10-27', '2026-11-26').totals.net, 45000);

  state = reportsReducer(state, {
    type: fetchInventoryReportThunk.fulfilled.type,
    payload: { totalSkus: 25 },
  });
  assert.equal(state.loading.inventory, false);
  assert.equal(state.inventory.totalSkus, 25);

  state = reportsReducer(state, { type: fetchReturnsReportThunk.pending.type });
  assert.equal(state.loading.returns, true);
  state = reportsReducer(state, {
    type: fetchReturnsReportThunk.fulfilled.type,
    payload: { totalRefunds: 450 },
  });
  assert.equal(state.loading.returns, false);
  assert.equal(state.returns.totalRefunds, 450);

  state = reportsReducer(state, {
    type: fetchSalesReportThunk.rejected.type,
    payload: { message: 'Report failed' },
  });
  assert.equal(state.error, 'Report failed');
  state = reportsReducer(state, clearReportsError());
  assert.equal(state.error, null);

  const mockRoot = { reports: state };
  assert.equal(selectSalesReport(mockRoot).totals.net, 45000);
  assert.equal(selectSalesReportFor(mockRoot, '2026-11-26', '2026-11-26').totals.net, 10000);
  assert.equal(selectInventoryReport(mockRoot).totalSkus, 25);
  assert.equal(selectReturnsReport(mockRoot).totalRefunds, 450);
  assert.deepEqual(selectReportsLoading(mockRoot), { sales: false, inventory: false, returns: false });
  assert.equal(selectReportsError(mockRoot), null);

  state = reportsReducer(state, resetReports());
  assert.equal(state.sales, null);
  assert.equal(state.inventory, null);
  assert.equal(state.returns, null);
  console.log('✓ Test 6: reportsSlice independent loading flags, thunks, and selectors verified');
}

// --- Test 7: Root Store Co-existence ---
{
  const rootState = rootStore.getState();
  assert.ok(rootState.coupons, 'coupons slice must exist in rootStore');
  assert.ok(rootState.reports, 'reports slice must exist in rootStore');
  console.log('✓ Test 7: coupons & reports slices registered in rootStore');
}

console.log('\n========================================================================');
console.log('🎉 ALL 7 COUPONS & REPORTS SLICE TESTS PASSED!');
console.log('========================================================================\n');

})();

// ============================================================================
// MERGED FROM: satyamSlices.test.js
// ============================================================================
await (async () => {
console.log('🧪 Starting exhaustive verification suite for Satyam slices & Redux store integration...\n');

// ============================================================================
// PART 1: DELIVERIES SLICE TESTS
// ============================================================================

// --- Test 1: Initial State ---
{
  const state = deliveriesReducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.items, []);
  assert.equal(state.selected, null);
  assert.equal(state.status, 'idle');
  assert.equal(state.saving, false);
  assert.equal(state.error, null);
  console.log('✓ Test 1: Deliveries initial state is clean and matches specification');
}

// --- Test 2: Fetch Deliveries Fulfilled ---
{
  const mockDeliveries = [
    { id: 'DEL-1', orderId: 'ORD-101', status: 'Pending', customer: 'Ravi Kumar' },
    { id: 'DEL-2', orderId: 'ORD-102', status: 'Dispatched', customer: 'Priya Sharma' },
    { id: 'DEL-3', orderId: 'ORD-103', status: 'Delivered', customer: 'Amit Singh' },
  ];
  const state = deliveriesReducer(undefined, {
    type: fetchDeliveriesThunk.fulfilled.type,
    payload: mockDeliveries,
  });
  assert.equal(state.status, 'succeeded');
  assert.equal(state.items.length, 3);
  assert.equal(state.items[0].id, 'DEL-1');
  console.log('✓ Test 2: fetchDeliveriesThunk.fulfilled populates items with status=succeeded');
}

// --- Test 3: Create Delivery Fulfilled ---
{
  const initialState = {
    items: [{ id: 'DEL-1', status: 'Pending' }],
    status: 'succeeded',
    saving: true,
    error: null,
  };
  const newDelivery = { id: 'DEL-2', orderId: 'ORD-202', status: 'Pending', partner: null };
  const state = deliveriesReducer(initialState, {
    type: createDeliveryThunk.fulfilled.type,
    payload: newDelivery,
  });
  assert.equal(state.saving, false);
  assert.equal(state.items.length, 2);
  assert.equal(state.items[0].id, 'DEL-2'); // Unshifted to top
  console.log('✓ Test 3: createDeliveryThunk.fulfilled unshifts new record to items array');
}

// --- Test 4: Transition Delivery (Assigned -> Dispatched -> Delivered) ---
{
  const initialState = {
    items: [
      { id: 'DEL-1', status: 'Pending', version: 1 },
      { id: 'DEL-2', status: 'Pending', version: 1 },
    ],
    selected: null,
    saving: true,
    error: null,
  };
  const updatedDelivery = {
    id: 'DEL-1',
    status: 'Assigned',
    partner: 'Express Fleet',
    version: 2,
  };
  const state = deliveriesReducer(initialState, {
    type: transitionDeliveryThunk.fulfilled.type,
    payload: updatedDelivery,
  });
  assert.equal(state.saving, false);
  assert.equal(state.items[0].status, 'Assigned');
  assert.equal(state.items[0].partner, 'Express Fleet');
  assert.equal(state.items[0].version, 2);
  assert.equal(state.items[1].status, 'Pending'); // Unchanged item preserved
  console.log('✓ Test 4: transitionDeliveryThunk.fulfilled updates canonical status & version');
}

// --- Test 5: Delete Delivery ---
{
  const initialState = {
    items: [
      { id: 'DEL-1', status: 'Pending' },
      { id: 'DEL-2', status: 'Cancelled' },
    ],
    selected: { id: 'DEL-2' },
    saving: true,
  };
  const state = deliveriesReducer(initialState, {
    type: deleteDeliveryThunk.fulfilled.type,
    payload: 'DEL-2',
  });
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].id, 'DEL-1');
  assert.equal(state.selected, null);
  console.log('✓ Test 5: deleteDeliveryThunk.fulfilled removes matching record');
}

// --- Test 6: Deliveries Selectors & Active Filter ---
{
  const rootMockState = {
    deliveries: {
      items: [
        { id: 'DEL-1', status: 'Pending' },
        { id: 'DEL-2', status: 'Out for Delivery' },
        { id: 'DEL-3', status: 'Delivered' },
        { id: 'DEL-4', status: 'Cancelled' },
        { id: 'DEL-5', status: 'Returned to Store' },
      ],
      selected: null,
      status: 'succeeded',
      saving: false,
      error: null,
    },
  };
  const all = selectAllDeliveries(rootMockState);
  assert.equal(all.length, 5);

  const active = selectActiveDeliveries(rootMockState);
  assert.equal(active.length, 2); // Only DEL-1 and DEL-2
  assert.deepEqual(active.map((d) => d.id), ['DEL-1', 'DEL-2']);

  const single = selectDeliveryById('DEL-2')(rootMockState);
  assert.equal(single?.status, 'Out for Delivery');
  console.log('✓ Test 6: selectActiveDeliveries correctly filters out Delivered, Cancelled & Returned');
}

// ============================================================================
// PART 2: RETURNS SLICE TESTS
// ============================================================================

// --- Test 7: Returns Initial State ---
{
  const state = returnsReducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.items, []);
  assert.equal(state.returnableForOrder, null);
  assert.equal(state.selected, null);
  assert.equal(state.status, 'idle');
  assert.equal(state.saving, false);
  assert.equal(state.error, null);
  console.log('✓ Test 7: Returns initial state is clean and matches specification');
}

// --- Test 8: Fetch Returnable Items for Order ---
{
  const mockReturnable = {
    orderId: 'ORD-500',
    eligible: true,
    lines: [{ productId: 'PROD-1', productName: 'Basmati Rice', returnable: 2, unitPrice: 120 }],
  };
  const state = returnsReducer(undefined, {
    type: fetchReturnableOrderThunk.fulfilled.type,
    payload: mockReturnable,
  });
  assert.deepEqual(state.returnableForOrder, mockReturnable);
  assert.equal(state.returnableForOrder.lines[0].returnable, 2);
  console.log('✓ Test 8: fetchReturnableOrderThunk.fulfilled stores eligible lines for modal');
}

// --- Test 9: Create Return Fulfilled ---
{
  const initialState = {
    items: [],
    saving: true,
    error: null,
  };
  const newReturn = {
    id: 'RET-101',
    orderId: 'ORD-500',
    amount: 240,
    status: 'Pending',
    reason: 'Damaged',
  };
  const state = returnsReducer(initialState, {
    type: createReturnThunk.fulfilled.type,
    payload: newReturn,
  });
  assert.equal(state.saving, false);
  assert.equal(state.items.length, 1);
  assert.equal(state.items[0].id, 'RET-101');
  console.log('✓ Test 9: createReturnThunk.fulfilled adds return record to items array');
}

// --- Test 10: Transition Return (Pending -> Approved -> Refunded) ---
{
  const initialState = {
    items: [
      { id: 'RET-1', status: 'Pending', amount: 500, version: 1 },
      { id: 'RET-2', status: 'Approved', amount: 300, version: 1 },
    ],
    saving: true,
  };
  const refundedReturn = {
    id: 'RET-2',
    status: 'Refunded',
    amount: 300,
    resolvedAt: '2026-11-25T10:00:00Z',
    version: 2,
  };
  const state = returnsReducer(initialState, {
    type: transitionReturnThunk.fulfilled.type,
    payload: refundedReturn,
  });
  assert.equal(state.saving, false);
  assert.equal(state.items[1].status, 'Refunded');
  assert.equal(state.items[1].version, 2);
  console.log('✓ Test 10: transitionReturnThunk.fulfilled updates refund status strictly on success');
}

// --- Test 11: Returns Selectors (Pending vs Approved) ---
{
  const rootMockState = {
    returns: {
      items: [
        { id: 'RET-1', status: 'Pending' },
        { id: 'RET-2', status: 'Approved' },
        { id: 'RET-3', status: 'Refunded' },
        { id: 'RET-4', status: 'Pending' },
      ],
      selected: null,
      returnableForOrder: null,
      status: 'succeeded',
      saving: false,
      error: null,
    },
  };
  const pending = selectPendingReturns(rootMockState);
  assert.equal(pending.length, 2);
  assert.deepEqual(pending.map((r) => r.id), ['RET-1', 'RET-4']);

  const approved = selectApprovedReturns(rootMockState);
  assert.equal(approved.length, 1);
  assert.equal(approved[0].id, 'RET-2');
  console.log('✓ Test 11: selectPendingReturns & selectApprovedReturns filter accurately');
}

// ============================================================================
// PART 3: UI SLICE TESTS
// ============================================================================

// --- Test 12: Theme Toggle & Explicit Set ---
{
  let state = uiReducer(undefined, { type: '@@INIT' });
  const startTheme = state.theme;
  state = uiReducer(state, toggleTheme());
  assert.equal(state.theme, startTheme === 'dark' ? 'light' : 'dark');

  state = uiReducer(state, setTheme('dark'));
  assert.equal(state.theme, 'dark');
  console.log('✓ Test 12: toggleTheme and setTheme operate predictably');
}

// --- Test 13: Sidebar & Drawer Reducers ---
{
  let state = uiReducer(undefined, { type: '@@INIT' });
  state = uiReducer(state, toggleSidebar());
  assert.equal(state.sidebarCollapsed, true);

  state = uiReducer(state, setMobileDrawer(true));
  assert.equal(state.mobileDrawerOpen, true);
  console.log('✓ Test 13: Sidebar and Mobile Drawer state updates verified');
}

// --- Test 14: Toast Dispatch and Dismiss ---
{
  let state = uiReducer(undefined, { type: '@@INIT' });
  state = uiReducer(state, showToast({ message: 'Refund Processed!', type: 'success' }));
  assert.equal(state.toast.show, true);
  assert.equal(state.toast.message, 'Refund Processed!');

  state = uiReducer(state, hideToast());
  assert.equal(state.toast.show, false);
  console.log('✓ Test 14: showToast and hideToast manage toast display lifecycle');
}

// --- Test 15: Modal Stack Management ---
{
  let state = uiReducer(undefined, { type: '@@INIT' });
  state = uiReducer(state, openModal({ kind: 'confirm', config: { title: 'Approve' } }));
  assert.equal(state.modals.length, 1);
  const modalId = state.modals[0].id;

  state = uiReducer(state, closeModal(modalId));
  assert.equal(state.modals.length, 0);
  console.log('✓ Test 15: openModal and closeModal correctly manage modal stack');
}

// --- Test 16: Read Notifications Tracking ---
{
  let state = uiReducer(undefined, { type: '@@INIT' });
  state = uiReducer(state, markNotificationRead('notif_1'));
  assert.deepEqual(state.readNotificationIds, ['notif_1']);

  state = uiReducer(state, markAllNotificationsRead(['notif_2', 'notif_3']));
  assert.equal(state.readNotificationIds.length, 3);
  console.log('✓ Test 16: markNotificationRead and markAllNotificationsRead maintain read set');
}

// --- Test 17: Redux Notifications Cross-Domain Derived Selector ---
{
  const mockRootState = {
    orders: { orders: [] },
    inventory: {
      products: [
        { productId: 'P-1', name: 'Almonds 500g', stock: 2, reorderLevel: 5 }, // Low stock!
        { productId: 'P-2', name: 'Olive Oil', stock: 50, reorderLevel: 10 },   // Healthy
      ],
    },
    deliveries: {
      items: [
        { id: 'DEL-99', customer: 'Sanjay', status: 'Failed Attempt', failureReason: 'Door locked' },
      ],
    },
    returns: {
      items: [
        { id: 'RET-77', orderId: 'ORD-90', status: 'Pending', reason: 'Damaged' },
      ],
    },
    ui: {
      readNotificationIds: ['notif_lowstock_P-1'], // P-1 marked read
    },
  };

  const notifs = selectReduxNotifications(mockRootState);
  assert.equal(notifs.length, 3);

  const lowStockNotif = notifs.find((n) => n.id === 'notif_lowstock_P-1');
  assert.equal(lowStockNotif.unread, false); // Was in readNotificationIds!

  const returnNotif = notifs.find((n) => n.id === 'notif_return_RET-77');
  assert.equal(returnNotif.unread, true);
  assert.equal(returnNotif.category, 'returns');

  const deliveryNotif = notifs.find((n) => n.id === 'notif_deliv_fail_DEL-99');
  assert.equal(deliveryNotif.unread, true);
  assert.equal(deliveryNotif.priority, 'critical');
  console.log('✓ Test 17: selectReduxNotifications derives live alerts across slices with accurate unread flags');
}

// ============================================================================
// PART 4: ROOT STORE CO-EXISTENCE & BOUNDARY VERIFICATION
// ============================================================================

// --- Test 18: Root Store Co-existence ---
{
  const state = rootStore.getState();
  assert.ok(state.ui, 'ui slice registered');
  assert.ok(state.deliveries, 'deliveries slice registered');
  assert.ok(state.returns, 'returns slice registered');
  assert.ok(state.inventory, 'inventory slice registered');
  assert.ok(state.orders, 'orders slice registered');

  // Verify dispatching delivery action does not mutate returns or inventory
  const initialReturns = state.returns.items;
  const initialProducts = state.inventory.products;

  rootStore.dispatch(
    transitionDeliveryThunk.fulfilled(
      { id: 'DEL-X', status: 'Dispatched', version: 1 },
      'test-req',
      { id: 'DEL-X', body: { status: 'Dispatched' } },
    ),
  );

  const nextState = rootStore.getState();
  assert.equal(nextState.returns.items, initialReturns, 'returns reference preserved');
  assert.equal(nextState.inventory.products, initialProducts, 'inventory reference preserved');
  console.log('✓ Test 18: Root store domain boundaries isolated; no cross-slice pollution');
}

console.log('\n========================================================================');
console.log('🎉 ALL 18 SATYAM DELIVERIES, RETURNS & UI TESTS PASSED FLAWLESSLY!');
console.log('========================================================================\n');

})();
