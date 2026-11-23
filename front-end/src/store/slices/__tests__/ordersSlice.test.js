import assert from 'node:assert/strict';
import rootStore from '../../store.js';
import ordersReducer, {
  initialFilters,
  setFilter,
  resetFilters,
  setSelectedOrder,
  clearSelectedOrder,
  setOrders,
  fetchOrdersThunk,
  cancelOrderThunk,
  deleteOrderThunk,
  selectAllOrders,
  selectOrderFilters,
  selectSelectedOrderId,
  selectOrdersLoading,
  selectOrdersError,
  selectSelectedOrder,
  selectFilteredOrders,
  selectOrderMetrics,
} from '../ordersSlice.js';

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

// --- Test 5: cancelOrderThunk Immer Mutation ---
{
  const initialStateWithOrders = {
    orders: [
      { id: 'ORD-A', status: 'Pending', total: 300 },
      { id: 'ORD-B', status: 'Completed', total: 600 },
    ],
    selectedOrderId: null,
    filters: initialFilters,
    loading: false,
    error: null,
  };

  const state = ordersReducer(initialStateWithOrders, {
    type: cancelOrderThunk.fulfilled.type,
    payload: { orderId: 'ORD-A' },
  });

  assert.equal(state.orders[0].status, 'Cancelled');
  assert.equal(state.orders[1].status, 'Completed');
  console.log('✓ Test 5: cancelOrderThunk marks order Cancelled without affecting other items');
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

console.log('\n========================================================================');
console.log('🎉 ALL 10 ORDERS SLICE & ROOT STORE TESTS PASSED FLAWLESSLY!');
console.log('========================================================================\n');
