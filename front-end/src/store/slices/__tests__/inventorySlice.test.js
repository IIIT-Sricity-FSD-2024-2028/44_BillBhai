import assert from 'node:assert/strict';
import { configureStore } from '@reduxjs/toolkit';
import rootStore from '../../store.js';
import { injectStore } from '../../storeBridge.js';
import { resetRedirectGuard, setAuthToken } from '../../../lib/http.js';
import { clearSession } from '../../../lib/dashboard/session.js';
import inventoryReducer, {
  clearInventoryError,
  clearMovements,
  fetchInventoryThunk,
  fetchInventoryByIdThunk,
  fetchInventoryByProductThunk,
  fetchLowStockThunk,
  fetchMovementsThunk,
  adjustStockThunk,
  receiveStockThunk,
  updateInventoryThunk,
  deleteInventoryThunk,
  selectAllInventory,
  selectLowStockState,
  selectLowStockItems,
  selectLowStockForDashboard,
  selectActiveCatalog,
  selectInventoryCategories,
  selectInventorySupplierNames,
  selectInventoryValuation,
  selectInventoryStatus,
  selectInventoryError,
  isLowStock,
} from '../inventorySlice.js';

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
