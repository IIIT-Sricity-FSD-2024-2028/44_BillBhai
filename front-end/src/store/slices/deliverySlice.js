import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiRequest } from '../../lib/dashboard/api.js';

const initialState = {
  deliveries: [],
  returns: [],
  statusFilter: 'all',
  loading: false,
  error: null,
};

export const fetchDeliveriesThunk = createAsyncThunk(
  'delivery/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const [deliveries, returns] = await Promise.all([
        apiRequest('/deliveries'),
        apiRequest('/returns'),
      ]);
      return { deliveries: deliveries || [], returns: returns || [] };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to fetch delivery data');
    }
  },
);

export const updateDeliveryStatusThunk = createAsyncThunk(
  'delivery/updateStatus',
  async ({ id, status, rider }, { rejectWithValue }) => {
    try {
      const body = { status };
      if (rider !== undefined) body.rider = rider;
      const updated = await apiRequest(`/deliveries/${encodeURIComponent(String(id))}/status`, {
        method: 'POST',
        body,
      });
      return { id, updated };
    } catch (error) {
      return rejectWithValue(error?.message || `Failed to update delivery ${id}`);
    }
  },
);

export const processRefundThunk = createAsyncThunk(
  'delivery/processRefund',
  async ({ returnId, amount }, { rejectWithValue }) => {
    try {
      const updated = await apiRequest(`/returns/${encodeURIComponent(String(returnId))}/refund`, {
        method: 'POST',
        body: { amount },
      });
      return { returnId, updated };
    } catch (error) {
      return rejectWithValue(error?.message || `Failed to process refund for return ${returnId}`);
    }
  },
);

const deliverySlice = createSlice({
  name: 'delivery',
  initialState,
  reducers: {

    setDeliveryFilter(state, action) {
      state.statusFilter = action.payload;
    },

    clearDeliveryError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDeliveriesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDeliveriesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.deliveries = action.payload.deliveries;
        state.returns = action.payload.returns;
      })
      .addCase(fetchDeliveriesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error';
      });

    builder
      .addCase(updateDeliveryStatusThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateDeliveryStatusThunk.fulfilled, (state, action) => {
        state.loading = false;
        const { id, updated } = action.payload;
        const idx = state.deliveries.findIndex((d) => String(d.id) === String(id));
        if (idx !== -1) {
          state.deliveries[idx] = { ...state.deliveries[idx], ...updated };
        }
      })
      .addCase(updateDeliveryStatusThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error';
      });

    builder
      .addCase(processRefundThunk.pending, (state) => {
        state.loading = true;
      })
      .addCase(processRefundThunk.fulfilled, (state, action) => {
        state.loading = false;
        const { returnId, updated } = action.payload;
        const idx = state.returns.findIndex((r) => String(r.id) === String(returnId));
        if (idx !== -1) {
          state.returns[idx] = { ...state.returns[idx], ...updated };
        }
      })
      .addCase(processRefundThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Unknown error';
      });
  },
});

export const { setDeliveryFilter, clearDeliveryError } = deliverySlice.actions;

export const selectAllDeliveries = (state) => state.delivery.deliveries;
export const selectAllReturns = (state) => state.delivery.returns;
export const selectDeliveryFilter = (state) => state.delivery.statusFilter;
export const selectDeliveryLoading = (state) => state.delivery.loading;
export const selectDeliveryError = (state) => state.delivery.error;

export const selectActiveDeliveries = (state) =>
  state.delivery.deliveries.filter((d) => d.status !== 'Delivered');

export const selectPendingReturns = (state) =>
  state.delivery.returns.filter((r) => r.status === 'Pending');

export default deliverySlice.reducer;
