import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { ordersRepo } from '../../repositories/ordersRepo.js';
import { mapOrderRow } from '../../lib/dashboard/api.js';
import { DEFAULT_FILTERS } from '../../components/orders/orderFilters.js';

export const initialFilters = {
  ...DEFAULT_FILTERS,
  status: 'all',
  search: '',
  paymentMethod: 'all',
  payment: 'all',
  dateRange: 'all',
  sort: 'newest',
};

const initialState = {
  orders: [],
  selectedOrderId: null,
  selectedOrder: null,
  selectedBill: null,
  quote: null,
  lastPlacedOrder: null,
  filters: initialFilters,
  loading: false,
  saving: false,
  error: null,
};

const sameId = (a, b) => String(a) === String(b);

function replaceOrderInList(state, updatedOrder) {
  if (!updatedOrder || !updatedOrder.id) return;
  const idx = state.orders.findIndex((o) => sameId(o.id, updatedOrder.id));
  if (idx !== -1) {
    state.orders[idx] = updatedOrder;
  }
  if (state.selectedOrder && sameId(state.selectedOrder.id, updatedOrder.id)) {
    state.selectedOrder = updatedOrder;
  }
}

// -------------------------------------------------------------
// ASYNC THUNKS
// -------------------------------------------------------------
export const fetchOrdersThunk = createAsyncThunk(
  'orders/fetchOrders',
  async (query, { rejectWithValue }) => {
    try {
      const data = await ordersRepo.getAll(query);
      return Array.isArray(data) ? data.map(mapOrderRow) : [];
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch orders');
    }
  }
);

export const fetchOrderByIdThunk = createAsyncThunk(
  'orders/fetchOrderById',
  async (id, { rejectWithValue }) => {
    try {
      return await ordersRepo.getById(id);
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch order');
    }
  }
);

export const fetchBillByNoThunk = createAsyncThunk(
  'orders/fetchBillByNo',
  async (billNo, { rejectWithValue }) => {
    try {
      return await ordersRepo.getBillByNo(billNo);
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch bill');
    }
  }
);

export const quoteOrderThunk = createAsyncThunk(
  'orders/quoteOrder',
  async (payload, { rejectWithValue }) => {
    try {
      return await ordersRepo.quote(payload);
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to calculate order quote');
    }
  }
);

export const placeOrderThunk = createAsyncThunk(
  'orders/placeOrder',
  async (payload, { rejectWithValue }) => {
    try {
      const data = await ordersRepo.create(payload);
      return data ? mapOrderRow(data) : null;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to place order');
    }
  }
);

export const updateOrderThunk = createAsyncThunk(
  'orders/updateOrder',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const data = await ordersRepo.update(id, body);
      return data ? mapOrderRow(data) : null;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to update order');
    }
  }
);

export const cancelOrderThunk = createAsyncThunk(
  'orders/cancelOrder',
  async ({ orderId, reason, version }, { rejectWithValue }) => {
    try {
      const data = await ordersRepo.cancel(orderId, { reason, version });
      return data ? mapOrderRow(data) : null;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to cancel order');
    }
  }
);

export const deleteOrderThunk = createAsyncThunk(
  'orders/deleteOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      await ordersRepo.remove(orderId);
      return orderId;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to delete order');
    }
  }
);

export const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setFilter: (state, action) => {
      const { key, value } = action.payload;
      state.filters[key] = value;
      // Keep payment and paymentMethod in sync if either is set
      if (key === 'paymentMethod') state.filters.payment = value;
      if (key === 'payment') state.filters.paymentMethod = value;
    },
    resetFilters: (state) => {
      state.filters = { ...initialFilters };
    },
    setSelectedOrder: (state, action) => {
      state.selectedOrderId = action.payload;
    },
    clearSelectedOrder: (state) => {
      state.selectedOrderId = null;
      state.selectedOrder = null;
    },
    setOrders: (state, action) => {
      state.orders = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Orders
      .addCase(fetchOrdersThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrdersThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchOrdersThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Order By ID
      .addCase(fetchOrderByIdThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrderByIdThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedOrder = action.payload;
      })
      .addCase(fetchOrderByIdThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Bill By No
      .addCase(fetchBillByNoThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBillByNoThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedBill = action.payload;
      })
      .addCase(fetchBillByNoThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Quote Order
      .addCase(quoteOrderThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(quoteOrderThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.quote = action.payload;
      })
      .addCase(quoteOrderThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Place Order
      .addCase(placeOrderThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(placeOrderThunk.fulfilled, (state, action) => {
        state.saving = false;
        const created = action.payload;
        if (created) {
          const idx = state.orders.findIndex((o) => sameId(o.id, created.id));
          if (idx === -1) state.orders.unshift(created);
          else state.orders[idx] = created;
          state.lastPlacedOrder = created;
        }
      })
      .addCase(placeOrderThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      // Update Order
      .addCase(updateOrderThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateOrderThunk.fulfilled, (state, action) => {
        state.saving = false;
        replaceOrderInList(state, action.payload);
      })
      .addCase(updateOrderThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      // Cancel Order (DB-first)
      .addCase(cancelOrderThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(cancelOrderThunk.fulfilled, (state, action) => {
        state.saving = false;
        replaceOrderInList(state, action.payload);
      })
      .addCase(cancelOrderThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      // Delete Order
      .addCase(deleteOrderThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(deleteOrderThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.orders = state.orders.filter((o) => !sameId(o.id, action.payload));
        if (state.selectedOrder && sameId(state.selectedOrder.id, action.payload)) {
          state.selectedOrder = null;
        }
      })
      .addCase(deleteOrderThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const {
  setFilter,
  resetFilters,
  setSelectedOrder,
  clearSelectedOrder,
  setOrders,
} = ordersSlice.actions;

export const selectAllOrders = (state) => state.orders.orders;
export const selectOrderFilters = (state) => state.orders.filters;
export const selectSelectedOrderId = (state) => state.orders.selectedOrderId;
export const selectSelectedOrderDetail = (state) => state.orders.selectedOrder;
export const selectSelectedBill = (state) => state.orders.selectedBill;
export const selectOrderQuote = (state) => state.orders.quote;
export const selectLastPlacedOrder = (state) => state.orders.lastPlacedOrder;
export const selectOrdersLoading = (state) => state.orders.loading;
export const selectOrdersSaving = (state) => state.orders.saving;
export const selectOrdersError = (state) => state.orders.error;

export const selectSelectedOrder = createSelector(
  [selectAllOrders, selectSelectedOrderId],
  (orders, selectedId) => (selectedId ? orders.find((o) => sameId(o.id, selectedId)) || null : null)
);

export const selectOrderById = createSelector(
  [selectAllOrders, (_state, id) => id],
  (orders, id) => (id ? orders.find((o) => sameId(o.id, id)) || null : null)
);

export const selectFilteredOrders = createSelector(
  [selectAllOrders, selectOrderFilters],
  (orders, filters) => {
    if (!Array.isArray(orders)) return [];
    const f = filters || {};

    const filtered = orders.filter((order) => {
      // 1. Status filter
      if (f.status && f.status !== 'all' && order.status !== f.status) {
        return false;
      }
      // 2. Search filter
      if (f.search) {
        const query = String(f.search).trim().toLowerCase();
        const matchesName = order.customer?.toLowerCase().includes(query);
        const matchesId = String(order.id).toLowerCase().includes(query);
        const matchesPhone = order.customerPhone?.toLowerCase().includes(query);
        const matchesBill = String(order.billNo || '').toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesPhone && !matchesBill) {
          return false;
        }
      }
      // 3. Payment Method filter
      const pMethod = f.paymentMethod || f.payment;
      if (pMethod && pMethod !== 'all') {
        const orderPayment = order.payment || order.paymentMethod;
        if (orderPayment !== pMethod) return false;
      }
      return true;
    });

    // 4. Sorting
    if (f.sort === 'oldest') {
      return [...filtered].sort((a, b) => new Date(a.orderDate || 0) - new Date(b.orderDate || 0));
    }
    if (f.sort === 'total_high') {
      return [...filtered].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
    }
    if (f.sort === 'total_low') {
      return [...filtered].sort((a, b) => (Number(a.total) || 0) - (Number(b.total) || 0));
    }
    // Default newest
    return [...filtered].sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));
  }
);

export const selectOrderMetrics = createSelector(
  [selectAllOrders],
  (orders) => {
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const completedCount = orders.filter((o) => o.status === 'Completed' || o.status === 'Delivered').length;
    const pendingCount = orders.filter((o) => o.status === 'Pending' || o.status === 'Processing').length;
    const cancelledCount = orders.filter((o) => o.status === 'Cancelled').length;
    return { totalRevenue, completedCount, pendingCount, cancelledCount };
  }
);

export const selectOrdersSummary = createSelector(
  [selectAllOrders, selectOrderMetrics],
  (orders, metrics) => ({
    totalCount: orders.length,
    ...metrics,
  })
);

export default ordersSlice.reducer;
