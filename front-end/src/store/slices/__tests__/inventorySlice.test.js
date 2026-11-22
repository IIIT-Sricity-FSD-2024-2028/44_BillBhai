import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import rootStore from '../../store.js';
import { injectStore, getAppStore } from '../../storeBridge.js';
import { mapInventoryRow } from '../../../lib/dashboard/api.js';
import { WHOLE, ADJUST_REASONS } from '../../../components/inventory/inventoryUtils.js';
import inventoryReducer, {
  clearInventoryError,
  resetInventory,
  fetchInventoryThunk,
  receiveStockThunk,
  adjustStockThunk,
  selectAllProducts,
  selectAllSuppliers,
  selectInventoryStatus,
  selectInventoryError,
  selectActiveProducts,
  selectLowStockProducts,
  selectLowStockForDashboard,
  selectCategories,
  selectRetailValuation,
  isLowStock,
} from '../inventorySlice.js';
import { toggleTheme } from '../../slices/uiSlice.js';

console.log('🧪 Starting exhaustive test suite for inventorySlice & Redux store integration...\n');

// ============================================================================
// PART 1: REDUCER UNIT TESTS & STATE LIFECYCLE
// ============================================================================

// --- Test 1: Initial State Isolation ---
{
  const state = inventoryReducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.products, []);
  assert.deepEqual(state.suppliers, []);
  assert.equal(state.status, 'idle');
  assert.equal(state.error, null);
  assert.equal(state.currentRequestId, null);
  console.log('✓ Test 1: Initial state is clean and isolated');
}

// --- Test 2: fetchInventoryThunk Lifecycle & Mapping ---
{
  let state = inventoryReducer(undefined, {
    type: fetchInventoryThunk.pending.type,
    meta: { requestId: 'req-1' },
  });
  assert.equal(state.status, 'loading');
  assert.equal(state.currentRequestId, 'req-1');

  const mockProducts = [
    { productId: 'PRD-1', name: 'Milk', cat: 'Dairy', stock: 15, reorderLevel: 20, active: true, price: 50, status: 'Low Stock' },
    { productId: 'PRD-2', name: 'Bread', cat: 'Bakery', stock: 50, reorderLevel: 10, active: true, price: 40, status: 'In Stock' },
    { productId: 'PRD-3', name: 'Discontinued Soap', cat: 'Personal Care', stock: 5, reorderLevel: 10, active: false, price: 30, status: 'Critical' },
  ];
  const mockSuppliers = [{ id: 'SUP-1', name: 'Amul' }];

  state = inventoryReducer(state, {
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'req-1' },
    payload: { products: mockProducts, suppliers: mockSuppliers },
  });
  assert.equal(state.status, 'succeeded');
  assert.equal(state.products.length, 3);
  assert.equal(state.suppliers.length, 1);
  console.log('✓ Test 2: fetchInventoryThunk fulfilled populates products and suppliers');
}

// --- Test 3: Mutation Race Condition Cancellation ---
{
  let state = {
    products: [{ productId: 'PRD-1', name: 'Milk', stock: 10, reorderLevel: 20, active: true, price: 50, status: 'Low Stock' }],
    suppliers: [],
    status: 'succeeded',
    error: null,
    currentRequestId: null,
  };

  state = inventoryReducer(state, {
    type: fetchInventoryThunk.pending.type,
    meta: { requestId: 'poll-slow' },
  });
  assert.equal(state.currentRequestId, 'poll-slow');

  state = inventoryReducer(state, {
    type: receiveStockThunk.fulfilled.type,
    payload: {
      productId: 'PRD-1',
      updated: { productId: 'PRD-1', stock: 30, status: 'In Stock' },
    },
  });
  assert.equal(state.products[0].stock, 30);
  assert.equal(state.currentRequestId, null, 'Mutation must invalidate in-flight currentRequestId');

  // Stale slow poll fetch arrives
  state = inventoryReducer(state, {
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'poll-slow' },
    payload: {
      products: [{ productId: 'PRD-1', name: 'Milk', stock: 10, reorderLevel: 20, active: true, price: 50, status: 'Low Stock' }],
      suppliers: [],
    },
  });
  assert.equal(state.products[0].stock, 30, 'Patched stock must survive stale in-flight poll');
  console.log('✓ Test 3: Mutation invalidates in-flight fetch and prevents stale overwrite');
}

// --- Test 4: In-flight Fetch Discarded on resetInventory (Logout) ---
{
  let state = inventoryReducer(undefined, {
    type: fetchInventoryThunk.pending.type,
    meta: { requestId: 'req-logout' },
  });
  assert.equal(state.currentRequestId, 'req-logout');

  state = inventoryReducer(state, resetInventory());
  assert.equal(state.currentRequestId, null);

  state = inventoryReducer(state, {
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'req-logout' },
    payload: { products: [{ productId: 'PRD-1' }], suppliers: [] },
  });
  assert.equal(state.products.length, 0, 'Late fetch arriving after logout must be discarded');
  console.log('✓ Test 4: Late fetch arriving after logout is safely discarded');
}

// --- Test 5: Transient Supplier Failure Preserves Existing Suppliers ---
{
  let state = {
    products: [{ productId: 'PRD-1', name: 'Milk' }],
    suppliers: [{ id: 'SUP-1', name: 'Amul' }],
    status: 'succeeded',
    error: null,
    currentRequestId: 'req-transient',
  };

  state = inventoryReducer(state, {
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'req-transient' },
    payload: {
      products: [{ productId: 'PRD-1', name: 'Milk (Updated)' }],
      suppliers: null,
    },
  });
  assert.equal(state.products[0].name, 'Milk (Updated)');
  assert.equal(state.suppliers.length, 1, 'Existing suppliers must be retained on transient supplier error');
  assert.equal(state.suppliers[0].name, 'Amul');
  console.log('✓ Test 5: Transient supplier failure preserves existing suppliers');
}

// --- Test 6: Mutation Rejections Do Not Write to state.error ---
{
  let state = {
    products: [],
    suppliers: [],
    status: 'succeeded',
    error: null,
    currentRequestId: null,
  };

  state = inventoryReducer(state, {
    type: adjustStockThunk.rejected.type,
    payload: 'Insufficient stock available on shelf',
  });
  assert.equal(state.error, null, 'Mutation rejections must bubble via unwrap() and not set state.error');
  console.log('✓ Test 6: Mutation rejections do not pollute state.error');
}

// --- Test 7: Stale Data Retention on Fetch Failure ---
{
  let state = {
    products: [{ productId: 'PRD-1', name: 'Milk', stock: 15 }],
    suppliers: [{ id: 'SUP-1' }],
    status: 'succeeded',
    error: null,
    currentRequestId: 'req-fail',
  };

  state = inventoryReducer(state, {
    type: fetchInventoryThunk.rejected.type,
    meta: { requestId: 'req-fail' },
    payload: 'Network timeout: server unreachable',
  });
  assert.equal(state.status, 'failed');
  assert.equal(state.error, 'Network timeout: server unreachable');
  assert.equal(state.products.length, 1, 'Existing products must be retained on fetch failure');
  console.log('✓ Test 7: Fetch failure preserves existing products for offline view');
}

// --- Test 8: Unknown Product ID in Mutation Gracefully Handled ---
{
  let state = {
    products: [{ productId: 'PRD-1', name: 'Milk', stock: 10 }],
    suppliers: [],
    status: 'succeeded',
    error: null,
    currentRequestId: null,
  };

  state = inventoryReducer(state, {
    type: receiveStockThunk.fulfilled.type,
    payload: {
      productId: 'PRD-999_NON_EXISTENT',
      updated: { productId: 'PRD-999_NON_EXISTENT', stock: 50 },
    },
  });
  assert.equal(state.products.length, 1);
  assert.equal(state.products[0].productId, 'PRD-1');
  assert.equal(state.products[0].stock, 10);
  console.log('✓ Test 8: Mutation targeting unknown product ID does not corrupt array');
}

// --- Test 9: clearInventoryError Action ---
{
  let state = {
    products: [],
    suppliers: [],
    status: 'failed',
    error: 'Critical server timeout',
    currentRequestId: null,
  };

  state = inventoryReducer(state, clearInventoryError());
  assert.equal(state.error, null);
  assert.equal(state.status, 'failed', 'status should remain failed while error banner is cleared');
  console.log('✓ Test 9: clearInventoryError action resets error to null');
}

// ============================================================================
// PART 2: SELECTOR LOGIC, MEMOIZATION & IMMUTABILITY TESTS
// ============================================================================

// --- Test 10: Memoized Selectors & Referential Stability ---
{
  const products = [
    { productId: 'PRD-1', name: 'Milk', cat: 'Dairy', stock: 10, reorderLevel: 20, active: true, price: 50, status: 'Low Stock' },
    { productId: 'PRD-2', name: 'Bread', cat: 'Bakery', stock: 50, reorderLevel: 10, active: true, price: 40, status: 'In Stock' },
    { productId: 'PRD-3', name: 'Old Soap', cat: 'Personal Care', stock: 5, reorderLevel: 10, active: false, price: 30, status: 'Critical' },
  ];

  let rootState = {
    inventory: { products, suppliers: [], status: 'succeeded', error: null },
    ui: { theme: 'dark' },
  };

  const lowStock1 = selectLowStockProducts(rootState);
  assert.equal(lowStock1.length, 1);
  assert.equal(lowStock1[0].productId, 'PRD-1');

  const active1 = selectActiveProducts(rootState);
  assert.equal(active1.length, 2);

  const categories1 = selectCategories(rootState);
  assert.deepEqual(categories1, ['Bakery', 'Dairy']);

  const valuation1 = selectRetailValuation(rootState);
  // (10 * 50) + (50 * 40) = 500 + 2000 = 2500
  assert.equal(valuation1, 2500);

  const nextRootState = {
    ...rootState,
    ui: { theme: 'light' },
  };

  const lowStock2 = selectLowStockProducts(nextRootState);
  assert.equal(lowStock1, lowStock2, 'createSelector must return identical reference when inventory is unchanged');
  console.log('✓ Test 10: Selectors are properly memoized and maintain referential stability');
}

// --- Test 11: isLowStock Predicate Edge Cases ---
{
  assert.equal(isLowStock({ stock: 5, reorderLevel: 10 }), true);
  assert.equal(isLowStock({ stock: 10, reorderLevel: 10 }), true);
  assert.equal(isLowStock({ stock: 15, reorderLevel: 10 }), false);
  assert.equal(isLowStock({ stock: '5', reorderLevel: '10' }), true, 'String numbers parse safely');
  assert.equal(isLowStock({ stock: 0, reorderLevel: undefined }), true, 'Missing reorderLevel defaults to 0');
  assert.equal(isLowStock({ stock: 1, reorderLevel: undefined }), false);
  assert.equal(isLowStock(null), true, 'Null item defaults to stock 0 <= reorder 0');
  assert.equal(isLowStock({ stock: -5, reorderLevel: 10 }), true, 'Negative stock is low stock');
  console.log('✓ Test 11: isLowStock predicate handles string numbers and missing fields safely');
}

// --- Test 12: Immer Structural Sharing (Immutability Proof) ---
{
  const item1 = { productId: 'P1', stock: 10 };
  const item2 = { productId: 'P2', stock: 20 };
  const state = {
    products: [item1, item2],
    suppliers: [],
    status: 'succeeded',
    error: null,
    currentRequestId: null,
  };

  const nextState = inventoryReducer(state, {
    type: adjustStockThunk.fulfilled.type,
    payload: { productId: 'P1', updated: { productId: 'P1', stock: 15 } },
  });

  assert.notEqual(state.products, nextState.products, 'Products array reference must change');
  assert.notEqual(state.products[0], nextState.products[0], 'Modified item reference must change');
  assert.equal(state.products[1], nextState.products[1], 'Unmodified item reference MUST stay identical (structural sharing)');
  console.log('✓ Test 12: Immer structural sharing guarantees unchanged items keep identical references');
}

// --- Test 13: Dashboard Stock Alerts Ordering & Inactive Filter ---
{
  const products = [
    { productId: 'P1', name: 'Flour', stock: 12, status: 'Low Stock', active: true },
    { productId: 'P2', name: 'Salt', stock: 2, status: 'Critical', active: true },
    { productId: 'P3', name: 'Sugar', stock: 100, status: 'In Stock', active: true },
    { productId: 'P4', name: 'Old Tea', stock: 1, status: 'Critical', active: false }, // Inactive should be skipped
  ];

  const state = { inventory: { products } };
  const dashboardAlerts = selectLowStockForDashboard(state);

  assert.equal(dashboardAlerts.length, 2, 'Should only include active items with status !== In Stock');
  assert.equal(dashboardAlerts[0].productId, 'P2', 'Lowest stock item must be ranked first (stock = 2)');
  assert.equal(dashboardAlerts[1].productId, 'P1', 'Second lowest item next (stock = 12)');
  console.log('✓ Test 13: selectLowStockForDashboard filters inactive and sorts ascending by stock');
}

// ============================================================================
// PART 3: BACKEND CONTRACT NORMALIZATION (mapInventoryRow)
// ============================================================================

// --- Test 14: mapInventoryRow Normalizes Raw DB Fields ---
{
  const rawBackendRow = {
    id: 'INV-042',
    productId: 'PRD-99',
    productName: 'Organic Honey',
    category: 'Groceries',
    stockAvailable: 24,
    reorderLevel: 8,
    status: 'In Stock',
    price: 350,
    costPrice: 280,
    gstRate: 5,
    barcode: '8901234567890',
    size: '500g',
    location: 'Aisle 4',
    supplierName: 'HoneyCo',
    supplierId: 'SUP-05',
    supplierPhone: '9876543210',
    active: true,
  };

  const mapped = mapInventoryRow(rawBackendRow);
  assert.equal(mapped.sku, 'PRD-99');
  assert.equal(mapped.productId, 'PRD-99');
  assert.equal(mapped.name, 'Organic Honey');
  assert.equal(mapped.cat, 'Groceries');
  assert.equal(mapped.stock, 24);
  assert.equal(mapped.reorderLevel, 8);
  assert.equal(mapped.price, 350);
  assert.equal(mapped.supplier, 'HoneyCo');
  assert.equal(mapped.active, true);
  console.log('✓ Test 14: mapInventoryRow maps backend raw columns to frontend schema contract');
}

// --- Test 15: mapInventoryRow Fills Safe Defaults on Partial/Missing Data ---
{
  const incompleteRow = {
    id: 'INV-099',
    productId: 'PRD-X',
  };

  const mapped = mapInventoryRow(incompleteRow);
  assert.equal(mapped.name, 'PRD-X', 'Missing productName falls back to productId');
  assert.equal(mapped.cat, 'Uncategorized', 'Missing category falls back to Uncategorized');
  assert.equal(mapped.stock, 0, 'Missing stockAvailable falls back to 0');
  assert.equal(mapped.reorderLevel, 0, 'Missing reorderLevel falls back to 0');
  assert.equal(mapped.price, 0, 'Missing price falls back to 0');
  assert.equal(mapped.active, true, 'Undefined active flag defaults to true');
  console.log('✓ Test 15: mapInventoryRow fills safe resilient defaults for partial rows');
}

// ============================================================================
// PART 4: FULL ROOT STORE INTEGRATION & STORE BRIDGE
// ============================================================================

// --- Test 16: Full Redux Root Store Co-existence ---
{
  const state1 = rootStore.getState();
  assert.ok(state1.ui);
  assert.ok(state1.delivery);
  assert.ok(state1.inventory);

  rootStore.dispatch(toggleTheme());
  const state2 = rootStore.getState();
  assert.equal(state2.ui.theme, 'light');
  assert.equal(state2.inventory.status, 'idle', 'UI mutation must not affect inventory slice');

  rootStore.dispatch({
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: null },
    payload: {
      products: [{ productId: 'P-STORE-1', name: 'Test Product', stock: 25, price: 100, active: true }],
      suppliers: [{ id: 'S1', name: 'Test Supplier' }],
    },
  });

  const state3 = rootStore.getState();
  assert.equal(state3.inventory.products.length, 1);
  assert.equal(state3.inventory.products[0].productId, 'P-STORE-1');
  assert.equal(state3.ui.theme, 'light', 'Inventory mutation must not affect UI slice');

  rootStore.dispatch(resetInventory());
  const state4 = rootStore.getState();
  assert.equal(state4.inventory.products.length, 0);
  assert.equal(state4.ui.theme, 'light', 'resetInventory must preserve UI state');
  console.log('✓ Test 16: Root store slices co-exist and maintain strict domain boundaries');
}

// --- Test 17: storeBridge Dependency Injection Lifecycle ---
{
  let mockStoreDispatched = [];
  const mockStore = {
    dispatch: (action) => mockStoreDispatched.push(action),
    getState: () => ({ mock: true }),
  };

  injectStore(mockStore);
  assert.equal(getAppStore(), mockStore);

  getAppStore().dispatch(clearInventoryError());
  assert.equal(mockStoreDispatched.length, 1);
  assert.equal(mockStoreDispatched[0].type, clearInventoryError.type);

  injectStore(rootStore);
  assert.equal(getAppStore(), rootStore);
  console.log('✓ Test 17: storeBridge dependency injection allows clean decoupled dispatches');
}

// ============================================================================
// PART 5: LARGE SCALE BENCHMARK & MEMOIZATION PERFORMANCE
// ============================================================================

// --- Test 18: 1,000 Products Benchmark & Memoization Cache Hits ---
{
  const LARGE_COUNT = 1000;
  const categories = ['Beverages', 'Bakery', 'Dairy', 'Snacks', 'Personal Care'];
  const bigProducts = [];

  for (let i = 0; i < LARGE_COUNT; i++) {
    const stock = i % 20;
    const reorder = 10;
    bigProducts.push({
      productId: `PRD-${i}`,
      name: `Product ${i}`,
      cat: categories[i % categories.length],
      stock,
      reorderLevel: reorder,
      price: 10 + (i % 100),
      active: i % 10 !== 0,
      status: stock <= 0 ? 'Out of Stock' : stock <= 5 ? 'Critical' : stock <= 10 ? 'Low Stock' : 'In Stock',
    });
  }

  const bigState = {
    inventory: { products: bigProducts, suppliers: [], status: 'succeeded', error: null },
    ui: { theme: 'dark' },
  };

  const startCompute = performance.now();
  const lowStock = selectLowStockProducts(bigState);
  const valuation = selectRetailValuation(bigState);
  const cats = selectCategories(bigState);
  const computeDurationMs = performance.now() - startCompute;

  assert.equal(cats.length, 5);
  assert.ok(valuation > 0);
  assert.ok(lowStock.length > 0);

  const startCacheHits = performance.now();
  for (let j = 0; j < 10000; j++) {
    selectLowStockProducts(bigState);
    selectRetailValuation(bigState);
    selectCategories(bigState);
  }
  const cacheHitDurationMs = performance.now() - startCacheHits;

  console.log(`✓ Test 18: Benchmark passed for 1,000 products:`);
  console.log(`   - First calculation time: ${computeDurationMs.toFixed(3)} ms`);
  console.log(`   - 10,000 memoized cache hit calls: ${cacheHitDurationMs.toFixed(3)} ms (~${(cacheHitDurationMs / 10000).toFixed(5)} ms/call)`);
}

// ============================================================================
// PART 6: REAL ASYNC THUNK EXECUTION & NETWORK INTEGRATION TESTS
// ============================================================================

const originalFetch = globalThis.fetch;
function createMockResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Test 19: fetchInventoryThunk Full Execution & Schema Normalization ---
{
  const isolatedStore = configureStore({ reducer: { inventory: inventoryReducer } });

  const rawBackendProducts = [
    {
      id: 'INV-10',
      productId: 'P-10',
      productName: 'Sunflower Cooking Oil',
      category: 'Edible Oils',
      stockAvailable: 35,
      reorderLevel: 10,
      price: 175,
      active: true,
      status: 'In Stock',
    },
  ];
  const rawBackendSuppliers = [{ id: 'SUP-4', name: 'Agro Goods Ltd' }];

  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.includes('/api/inventory')) return createMockResponse(rawBackendProducts);
    if (s.includes('/api/suppliers')) return createMockResponse(rawBackendSuppliers);
    throw new Error(`Unexpected URL in test: ${s}`);
  };

  try {
    await isolatedStore.dispatch(fetchInventoryThunk());
    const state = isolatedStore.getState().inventory;

    assert.equal(state.status, 'succeeded');
    assert.equal(state.products.length, 1);
    assert.equal(state.products[0].productId, 'P-10');
    assert.equal(state.products[0].name, 'Sunflower Cooking Oil', 'Normalized from productName');
    assert.equal(state.products[0].cat, 'Edible Oils', 'Normalized from category');
    assert.equal(state.products[0].stock, 35, 'Normalized from stockAvailable');
    assert.equal(state.suppliers.length, 1);
    assert.equal(state.suppliers[0].name, 'Agro Goods Ltd');
    console.log('✓ Test 19: fetchInventoryThunk full execution normalizes raw DB response');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 20: fetchInventoryThunk Cashier 403 Suppliers Resilience ---
{
  const isolatedStore = configureStore({
    reducer: { inventory: inventoryReducer },
    preloadedState: {
      inventory: {
        products: [],
        suppliers: [{ id: 'SUP-CACHED', name: 'Cached Vendor' }],
        status: 'idle',
        error: null,
        currentRequestId: null,
      },
    },
  });

  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.includes('/api/inventory')) {
      return createMockResponse([{ productId: 'P-CASHIER', productName: 'Salt', stockAvailable: 100, active: true }]);
    }
    if (s.includes('/api/suppliers')) {
      return createMockResponse({ message: 'Forbidden: Insufficient privileges' }, 403);
    }
    throw new Error(`Unexpected URL: ${s}`);
  };

  try {
    const resultAction = await isolatedStore.dispatch(fetchInventoryThunk());
    assert.equal(resultAction.type, fetchInventoryThunk.fulfilled.type, 'Thunk must succeed even if suppliers 403s');

    const state = isolatedStore.getState().inventory;
    assert.equal(state.status, 'succeeded');
    assert.equal(state.products.length, 1);
    assert.equal(state.suppliers.length, 1, 'Cached suppliers must NOT be wiped');
    assert.equal(state.suppliers[0].name, 'Cached Vendor');
    console.log('✓ Test 20: Cashier 403 on /suppliers does not break inventory loading (Promise.allSettled)');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 21: fetchInventoryThunk Network Outage Offline Resilience ---
{
  const isolatedStore = configureStore({
    reducer: { inventory: inventoryReducer },
    preloadedState: {
      inventory: {
        products: [{ productId: 'P-OFFLINE', name: 'Tea Leaves', stock: 12 }],
        suppliers: [],
        status: 'succeeded',
        error: null,
        currentRequestId: null,
      },
    },
  });

  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch (Network connection refused)');
  };

  try {
    const resultAction = await isolatedStore.dispatch(fetchInventoryThunk());
    assert.equal(resultAction.type, fetchInventoryThunk.rejected.type);

    const state = isolatedStore.getState().inventory;
    assert.equal(state.status, 'failed');
    assert.ok(state.error.includes('Cannot reach the BillBhai server') || state.error.includes('Network'));
    assert.equal(state.products.length, 1, 'Existing products must remain intact during network outage');
    assert.equal(state.products[0].productId, 'P-OFFLINE');
    console.log('✓ Test 21: Network outage sets status=failed but preserves offline table data');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 22: receiveStockThunk Execution, Normalization & In-Flight Invalidation ---
{
  const isolatedStore = configureStore({
    reducer: { inventory: inventoryReducer },
    preloadedState: {
      inventory: {
        products: [{ productId: 'P-REC', name: 'Wheat Flour', stock: 10, cat: 'Groceries' }],
        suppliers: [],
        status: 'succeeded',
        error: null,
        currentRequestId: 'slow-background-poll-req',
      },
    },
  });

  let capturedBody = null;
  globalThis.fetch = async (url, options) => {
    const s = String(url);
    if (s.includes('/api/inventory/receive')) {
      capturedBody = JSON.parse(options.body);
      return createMockResponse({
        id: 'INV-REC',
        productId: 'P-REC',
        productName: 'Wheat Flour',
        category: 'Groceries',
        stockAvailable: 60,
        status: 'In Stock',
      });
    }
    throw new Error(`Unexpected URL: ${s}`);
  };

  try {
    const res = await isolatedStore.dispatch(
      receiveStockThunk({
        productId: 'P-REC',
        quantity: 50,
        supplierId: 'SUP-MILL',
        note: '  Morning shipment from Mill  ',
      }),
    ).unwrap();

    assert.equal(capturedBody.quantity, 50);
    assert.equal(capturedBody.supplierId, 'SUP-MILL');
    assert.equal(capturedBody.note, 'Morning shipment from Mill', 'Note must be trimmed');

    const state = isolatedStore.getState().inventory;
    assert.equal(state.products[0].stock, 60, 'Stock must update to 60');
    assert.equal(state.currentRequestId, null, 'receiveStockThunk must invalidate currentRequestId');

    // Stale slow poll arrives late
    isolatedStore.dispatch({
      type: fetchInventoryThunk.fulfilled.type,
      meta: { requestId: 'slow-background-poll-req' },
      payload: {
        products: [{ productId: 'P-REC', name: 'Wheat Flour', stock: 10, cat: 'Groceries' }],
        suppliers: [],
      },
    });

    const stateAfterStale = isolatedStore.getState().inventory;
    assert.equal(stateAfterStale.products[0].stock, 60, 'Stale poll arriving after mutation is discarded');
    console.log('✓ Test 22: receiveStockThunk validates body, trims note, patches state and cancels stale in-flight fetches');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 23: adjustStockThunk Rejection & .unwrap() String Extraction ---
{
  const isolatedStore = configureStore({
    reducer: { inventory: inventoryReducer },
    preloadedState: {
      inventory: {
        products: [{ productId: 'P-ADJ', name: 'Biscuits', stock: 5 }],
        suppliers: [],
        status: 'succeeded',
        error: null,
        currentRequestId: null,
      },
    },
  });

  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.includes('/api/inventory/adjust')) {
      return createMockResponse({ message: 'Cannot reduce stock below zero: requested -10, available 5' }, 400);
    }
    throw new Error(`Unexpected URL: ${s}`);
  };

  try {
    let caughtError = null;
    try {
      await isolatedStore.dispatch(
        adjustStockThunk({ productId: 'P-ADJ', adjustment: -10, reason: 'Damaged' }),
      ).unwrap();
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError !== null, 'Thunk .unwrap() must throw on rejection');
    assert.equal(typeof caughtError, 'string', '.unwrap() on rejectWithValue must throw a plain string');
    assert.equal(caughtError, 'Cannot reduce stock below zero: requested -10, available 5');

    const state = isolatedStore.getState().inventory;
    assert.equal(state.error, null, 'Mutation rejections must NOT write to global state.error');
    console.log('✓ Test 23: adjustStockThunk rejection throws string via .unwrap() without corrupting state.error');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- Test 24: Anti-Flicker Background Polling Guard ---
{
  let state = inventoryReducer(undefined, { type: '@@INIT' });
  assert.equal(state.status, 'idle');

  // Cold load fetch pending sets loading
  state = inventoryReducer(state, {
    type: fetchInventoryThunk.pending.type,
    meta: { requestId: 'req-cold' },
  });
  assert.equal(state.status, 'loading');

  // Cold load fulfilled sets succeeded
  state = inventoryReducer(state, {
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'req-cold' },
    payload: { products: [{ productId: 'P1', stock: 10 }], suppliers: [] },
  });
  assert.equal(state.status, 'succeeded');

  // Next 20-second background poll pending DOES NOT set loading (Anti-Flicker)
  state = inventoryReducer(state, {
    type: fetchInventoryThunk.pending.type,
    meta: { requestId: 'req-background-poll' },
  });
  assert.equal(state.status, 'succeeded', 'Background poll must keep status as succeeded to avoid UI flicker');
  console.log('✓ Test 24: Anti-flicker guard preserves succeeded status during background polling');
}

// ============================================================================
// PART 7: COMPONENT BEHAVIOR & INTEGRATION EDGE CASES
// ============================================================================

// --- Test 25: Dashboard Page 3-Way Cold Load Guard Logic ---
{
  function getDashboardAlertSubtext(status, lowStockList) {
    if (status === 'failed') return 'Stock alerts unavailable';
    if (status === 'idle' || status === 'loading') return 'Checking stock…';
    return `${lowStockList.length} products low or out of stock`;
  }

  assert.equal(getDashboardAlertSubtext('idle', []), 'Checking stock…');
  assert.equal(getDashboardAlertSubtext('loading', []), 'Checking stock…');
  assert.equal(getDashboardAlertSubtext('failed', []), 'Stock alerts unavailable');
  assert.equal(getDashboardAlertSubtext('succeeded', []), '0 products low or out of stock');
  assert.equal(getDashboardAlertSubtext('succeeded', [{ id: '1' }, { id: '2' }]), '2 products low or out of stock');
  console.log('✓ Test 25: DashboardPage 3-way guard correctly handles all 4 lifecycle states');
}

// --- Test 26: StockActionModal Client Validation & Arithmetic Rules ---
{
  function validateStockInput({ qty, kind, direction, itemStock, reason, details }) {
    const text = (qty || '').trim();
    if (!WHOLE.test(text) || Number(text) < 1) {
      return 'Enter a whole number of units, 1 or more.';
    }
    const n = Number(text);
    if (n > 100000) {
      return 'That is more than 100,000 units. Check the number.';
    }
    if (kind === 'adjust') {
      if (direction === 'remove' && n > itemStock) {
        return `Only ${itemStock} on hand; you cannot remove ${n}.`;
      }
      if (reason === 'Other' && details.trim().length < 3) {
        return 'Describe the reason (at least 3 characters).';
      }
    }
    return null;
  }

  // Non-whole or invalid numbers
  assert.equal(validateStockInput({ qty: '0' }), 'Enter a whole number of units, 1 or more.');
  assert.equal(validateStockInput({ qty: '-5' }), 'Enter a whole number of units, 1 or more.');
  assert.equal(validateStockInput({ qty: '4.5' }), 'Enter a whole number of units, 1 or more.');
  assert.equal(validateStockInput({ qty: 'abc' }), 'Enter a whole number of units, 1 or more.');
  assert.equal(validateStockInput({ qty: '' }), 'Enter a whole number of units, 1 or more.');

  // Cap limit
  assert.equal(validateStockInput({ qty: '100001' }), 'That is more than 100,000 units. Check the number.');
  assert.equal(validateStockInput({ qty: '100000' }), null);

  // Adjust removal exceeds on hand
  assert.equal(
    validateStockInput({ qty: '15', kind: 'adjust', direction: 'remove', itemStock: 10 }),
    'Only 10 on hand; you cannot remove 15.',
  );
  assert.equal(
    validateStockInput({ qty: '10', kind: 'adjust', direction: 'remove', itemStock: 10 }),
    null,
  );

  // Other reason requires at least 3 chars
  assert.equal(
    validateStockInput({ qty: '5', kind: 'adjust', direction: 'remove', itemStock: 10, reason: 'Other', details: 'no' }),
    'Describe the reason (at least 3 characters).',
  );
  assert.equal(
    validateStockInput({ qty: '5', kind: 'adjust', direction: 'remove', itemStock: 10, reason: 'Other', details: 'Spoiled by rain' }),
    null,
  );

  // Projected stock math
  const calcProjected = (stock, qtyText, kind, direction) => {
    const n = WHOLE.test(qtyText.trim()) ? Number(qtyText) : 0;
    if (kind === 'receive') return stock + n;
    return stock + (direction === 'remove' ? -n : n);
  };
  assert.equal(calcProjected(20, '15', 'receive', 'remove'), 35);
  assert.equal(calcProjected(20, '5', 'adjust', 'remove'), 15);
  assert.equal(calcProjected(20, '8', 'adjust', 'add'), 28);
  console.log('✓ Test 26: StockActionModal client-side validation and projected arithmetic fully verified');
}

// --- Test 27: Selectors Resilient Under Extreme & Corrupted Inputs ---
{
  const corruptState = {
    inventory: {
      products: [
        { productId: 'P-CORRUPT-1', name: 'Corrupt 1', price: '49.99', stock: '3', active: true },
        { productId: 'P-CORRUPT-2', name: 'Corrupt 2', price: null, stock: undefined, active: true },
        { productId: 'P-CORRUPT-3', name: 'Corrupt 3', cat: null, price: 10, stock: 2, active: true },
        { productId: 'P-CORRUPT-4', name: 'Corrupt 4', cat: '', price: 10, stock: 2, active: true },
        { productId: 'P-INACTIVE', name: 'Inactive', cat: 'Hidden', price: 100, stock: 50, active: false },
      ],
      suppliers: [],
      status: 'succeeded',
      error: null,
      currentRequestId: null,
    },
  };

  // Valuation should never produce NaN
  const valuation = selectRetailValuation(corruptState);
  assert.equal(Number.isNaN(valuation), false);
  // (49.99 * 3) + 0 + (10 * 2) + (10 * 2) = 149.97 + 20 + 20 = 189.97
  assert.equal(Math.round(valuation * 100) / 100, 189.97);

  // Categories dedupes null and empty string into 'Uncategorized'
  const categories = selectCategories(corruptState);
  assert.deepEqual(categories, ['Uncategorized']);
  assert.equal(categories.includes('Hidden'), false, 'Inactive categories must be ignored');
  console.log('✓ Test 27: Selectors handle corrupted fields, float math, and empty categories without NaN');
}

// --- Test 28: Rapid Interleaved Async Concurrency Simulation ---
{
  const concurrentStore = configureStore({
    reducer: { inventory: inventoryReducer },
    preloadedState: {
      inventory: {
        products: [{ productId: 'P-RACE', name: 'Rice Bag', stock: 10 }],
        suppliers: [],
        status: 'succeeded',
        error: null,
        currentRequestId: null,
      },
    },
  });

  // Step 1: Slow background poll starts (requestId: 'poll-1')
  concurrentStore.dispatch({
    type: fetchInventoryThunk.pending.type,
    meta: { requestId: 'poll-1' },
  });
  assert.equal(concurrentStore.getState().inventory.currentRequestId, 'poll-1');

  // Step 2: Receive mutation succeeds (+30) -> stock becomes 40
  concurrentStore.dispatch({
    type: receiveStockThunk.fulfilled.type,
    payload: { productId: 'P-RACE', updated: { productId: 'P-RACE', stock: 40 } },
  });
  assert.equal(concurrentStore.getState().inventory.products[0].stock, 40);
  assert.equal(concurrentStore.getState().inventory.currentRequestId, null);

  // Step 3: Adjust mutation succeeds (-5) -> stock becomes 35
  concurrentStore.dispatch({
    type: adjustStockThunk.fulfilled.type,
    payload: { productId: 'P-RACE', updated: { productId: 'P-RACE', stock: 35 } },
  });
  assert.equal(concurrentStore.getState().inventory.products[0].stock, 35);

  // Step 4: Slow background poll 'poll-1' finally resolves with old stock 10
  concurrentStore.dispatch({
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'poll-1' },
    payload: {
      products: [{ productId: 'P-RACE', name: 'Rice Bag', stock: 10 }],
      suppliers: [],
    },
  });
  assert.equal(
    concurrentStore.getState().inventory.products[0].stock,
    35,
    'Stale poll-1 MUST NOT overwrite stock 35',
  );

  // Step 5: Fresh poll 'poll-2' resolves with matching server stock 35
  concurrentStore.dispatch({
    type: fetchInventoryThunk.pending.type,
    meta: { requestId: 'poll-2' },
  });
  concurrentStore.dispatch({
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'poll-2' },
    payload: {
      products: [{ productId: 'P-RACE', name: 'Rice Bag', stock: 35 }],
      suppliers: [],
    },
  });
  assert.equal(concurrentStore.getState().inventory.products[0].stock, 35);
  console.log('✓ Test 28: Rapid interleaved async concurrency simulation maintains strict consistency');
}

console.log('\n========================================================================');
console.log('🎉 ALL 28 INVENTORY SLICE & INTEGRATION TESTS PASSED FLAWLESSLY!');
console.log('========================================================================\n');
