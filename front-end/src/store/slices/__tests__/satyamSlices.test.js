import assert from 'node:assert/strict';
import rootStore from '../../store.js';
import deliveriesReducer, {
  fetchDeliveriesThunk,
  createDeliveryThunk,
  transitionDeliveryThunk,
  updateDeliveryThunk,
  deleteDeliveryThunk,
  selectAllDeliveries,
  selectActiveDeliveries,
  selectDeliveryById,
  clearSelectedDelivery,
  clearDeliveriesError,
} from '../deliveriesSlice.js';

import returnsReducer, {
  fetchReturnsThunk,
  fetchReturnableOrderThunk,
  createReturnThunk,
  transitionReturnThunk,
  deleteReturnThunk,
  selectAllReturns,
  selectPendingReturns,
  selectApprovedReturns,
  selectReturnById,
  clearReturnableForOrder,
} from '../returnsSlice.js';

import uiReducer, {
  toggleTheme,
  setTheme,
  toggleSidebar,
  setSidebarCollapsed,
  setMobileDrawer,
  showToast,
  hideToast,
  openModal,
  closeModal,
  markNotificationRead,
  markAllNotificationsRead,
  selectCurrentTheme,
  selectToastState,
  selectSidebarState,
  selectModals,
  selectReduxNotifications,
} from '../uiSlice.js';

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
