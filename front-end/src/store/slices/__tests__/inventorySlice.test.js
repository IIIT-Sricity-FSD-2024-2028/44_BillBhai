import assert from 'node:assert/strict';
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

console.log('Running inventorySlice unit tests...\n');

// --- Test 1: Initial State ---
{
  const state = inventoryReducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.products, []);
  assert.deepEqual(state.suppliers, []);
  assert.equal(state.status, 'idle');
  assert.equal(state.error, null);
  assert.equal(state.currentRequestId, null);
  console.log('✓ Test 1: Initial state is clean');
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
  // 1. Initial populated state
  let state = {
    products: [{ productId: 'PRD-1', name: 'Milk', stock: 10, reorderLevel: 20, active: true, price: 50, status: 'Low Stock' }],
    suppliers: [],
    status: 'succeeded',
    error: null,
    currentRequestId: null,
  };

  // 2. Poll fetch starts with requestId: 'poll-slow'
  state = inventoryReducer(state, {
    type: fetchInventoryThunk.pending.type,
    meta: { requestId: 'poll-slow' },
  });
  assert.equal(state.currentRequestId, 'poll-slow');

  // 3. User receives stock (+20 units -> stock becomes 30)
  state = inventoryReducer(state, {
    type: receiveStockThunk.fulfilled.type,
    payload: {
      productId: 'PRD-1',
      updated: { productId: 'PRD-1', stock: 30, status: 'In Stock' },
    },
  });
  assert.equal(state.products[0].stock, 30);
  assert.equal(state.currentRequestId, null, 'Mutation must invalidate in-flight currentRequestId');

  // 4. Stale slow poll fetch resolves with old stock (10)
  state = inventoryReducer(state, {
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'poll-slow' },
    payload: {
      products: [{ productId: 'PRD-1', name: 'Milk', stock: 10, reorderLevel: 20, active: true, price: 50, status: 'Low Stock' }],
      suppliers: [],
    },
  });
  // The stale poll should have been DISCARDED because currentRequestId was null!
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

  // User logs out
  state = inventoryReducer(state, resetInventory());
  assert.equal(state.currentRequestId, null);

  // Late arriving fetch payload
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

  // /suppliers failed on server (e.g. 403 or network drop), so payload.suppliers is null
  state = inventoryReducer(state, {
    type: fetchInventoryThunk.fulfilled.type,
    meta: { requestId: 'req-transient' },
    payload: {
      products: [{ productId: 'PRD-1', name: 'Milk (Updated)' }],
      suppliers: null, // represents failed supplier fetch
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

// --- Test 8: Memoized Selectors & Referential Stability ---
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

  // Now create a NEW rootState with a changed UI slice (theme toggled to 'light')
  const nextRootState = {
    ...rootState,
    ui: { theme: 'light' },
  };

  const lowStock2 = selectLowStockProducts(nextRootState);
  assert.equal(lowStock1, lowStock2, 'createSelector must return identical reference when inventory is unchanged');
  console.log('✓ Test 8: Selectors are properly memoized and maintain referential stability');
}

// --- Test 9: isLowStock Edge Cases ---
{
  assert.equal(isLowStock({ stock: 5, reorderLevel: 10 }), true);
  assert.equal(isLowStock({ stock: 10, reorderLevel: 10 }), true);
  assert.equal(isLowStock({ stock: 15, reorderLevel: 10 }), false);
  assert.equal(isLowStock({ stock: '5', reorderLevel: '10' }), true, 'String numbers should parse safely');
  assert.equal(isLowStock({ stock: 0, reorderLevel: undefined }), true, 'Missing reorderLevel defaults to 0');
  assert.equal(isLowStock({ stock: 1, reorderLevel: undefined }), false);
  console.log('✓ Test 9: isLowStock predicate handles string numbers and missing fields safely');
}

console.log('\nAll 9 inventorySlice unit tests passed successfully! 🎉');
