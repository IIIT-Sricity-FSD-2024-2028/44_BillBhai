import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { apiRequest, mapOrderRow } from '../../lib/dashboard/api.js';
import { DEFAULT_FILTERS, filterOrders, sortOrders } from '../../components/orders/orderFilters.js';

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
  filters: initialFilters,
  loading: false,
  error: null,
};

// -------------------------------------------------------------
// ASYNC THUNKS
// -------------------------------------------------------------

export const fetchOrdersThunk = createAsyncThunk(
  'orders/fetchOrders',
  async (_, { rejectWithValue }) => {
    try {
      const data = await apiRequest('/orders');
      return Array.isArray(data) ? data.map(mapOrderRow) : [];
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch orders');
    }
  }
);

export const cancelOrderThunk = createAsyncThunk(
  'orders/cancelOrder',
  async ({ orderId, reason, version }, { rejectWithValue }) => {
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        body: { reason, version },
      });
      return { orderId };
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to cancel order');
    }
  }
);

export const deleteOrderThunk = createAsyncThunk(
  'orders/deleteOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      await apiRequest(`/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
      });
      return orderId;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to delete order');
    }
  }
);

// -------------------------------------------------------------
// SLICE
// -------------------------------------------------------------

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
      // Cancel Order
      .addCase(cancelOrderThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelOrderThunk.fulfilled, (state, action) => {
        state.loading = false;
        const target = state.orders.find((o) => o.id === action.payload.orderId);
        if (target) {
          target.status = 'Cancelled';
        }
      })
      .addCase(cancelOrderThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Delete Order
      .addCase(deleteOrderThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteOrderThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = state.orders.filter((o) => o.id !== action.payload);
      })
      .addCase(deleteOrderThunk.rejected, (state, action) => {
        state.loading = false;
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

// -------------------------------------------------------------
// SELECTORS
// -------------------------------------------------------------

export const selectAllOrders = (state) => state.orders.orders;
export const selectOrderFilters = (state) => state.orders.filters;
export const selectSelectedOrderId = (state) => state.orders.selectedOrderId;
export const selectOrdersLoading = (state) => state.orders.loading;
export const selectOrdersError = (state) => state.orders.error;

export const selectSelectedOrder = createSelector(
  [selectAllOrders, selectSelectedOrderId],
  (orders, selectedId) => (selectedId ? orders.find((o) => o.id === selectedId) || null : null)
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

export default ordersSlice.reducer;
