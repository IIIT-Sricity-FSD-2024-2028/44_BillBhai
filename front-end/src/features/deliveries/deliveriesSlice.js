import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { deliveriesRepo } from './deliveriesRepo.js';
import { getState as getDashboardState } from '../../shared/lib/dashboard/store.js';
import { scopedCompanyId } from '../orders/components/orderFormat.js';

const initialState = {
  items: [],
  selected: null,
  status: 'idle',
  saving: false,
  error: null,
  ui: {
    group: 'open',
    query: '',
    partner: 'all',
    onlyCod: false,
    onlyLate: false,
    sort: 'attention',
    detailId: null,
    tick: 0,
    dashboardNotice: '',
    dashboardDetailId: null,
  },
};

export const fetchDeliveriesThunk = createAsyncThunk(
  'deliveries/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      const data = await deliveriesRepo.list(query);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch deliveries');
    }
  },
);

export const fetchDeliveryByIdThunk = createAsyncThunk(
  'deliveries/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      return await deliveriesRepo.getById(id);
    } catch (err) {
      return rejectWithValue(err.message || `Failed to fetch delivery ${id}`);
    }
  },
);

export const fetchDeliveryByOrderThunk = createAsyncThunk(
  'deliveries/fetchByOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      return await deliveriesRepo.getByOrderId(orderId);
    } catch (err) {
      return rejectWithValue(err.message || `Failed to fetch delivery for order ${orderId}`);
    }
  },
);

export const createDeliveryThunk = createAsyncThunk(
  'deliveries/create',
  async (body, { rejectWithValue }) => {
    try {
      return await deliveriesRepo.create(body);
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to create delivery');
    }
  },
);

export const transitionDeliveryThunk = createAsyncThunk(
  'deliveries/transition',
  async ({ id, body }, { dispatch, rejectWithValue }) => {
    try {
      const updated = await deliveriesRepo.transition(id, body);
      return updated;
    } catch (err) {
      if (err?.status === 409) {
        const companyId = scopedCompanyId(getDashboardState());
        const listAction = await dispatch(fetchDeliveriesThunk({ companyId }));
        const latest = Array.isArray(listAction.payload)
          ? listAction.payload.find((d) => String(d.id) === String(id))
          : null;
        const baseMsg = String(err.message || '').replace(/\s*Reload to see the latest version\.?/i, '');
        const detail = latest?.status
          ? ` Current status: ${latest.status}${latest.updatedBy ? ` (by ${latest.updatedBy})` : ''}.`
          : '';
        return rejectWithValue(`${baseMsg}${detail} List refreshed.`.trim());
      }
      return rejectWithValue(err.message || `Failed to transition delivery ${id}`);
    }
  },
);

export const updateDeliveryThunk = createAsyncThunk(
  'deliveries/update',
  async ({ id, body }, { dispatch, rejectWithValue }) => {
    try {
      const updated = await deliveriesRepo.update(id, body);
      return updated;
    } catch (err) {
      if (err?.status === 409) {
        const companyId = scopedCompanyId(getDashboardState());
        const listAction = await dispatch(fetchDeliveriesThunk({ companyId }));
        const latest = Array.isArray(listAction.payload)
          ? listAction.payload.find((d) => String(d.id) === String(id))
          : null;
        const baseMsg = String(err.message || '').replace(/\s*Reload to see the latest version\.?/i, '');
        const detail = latest?.status
          ? ` Current status: ${latest.status}${latest.updatedBy ? ` (by ${latest.updatedBy})` : ''}.`
          : '';
        return rejectWithValue(`${baseMsg}${detail} List refreshed.`.trim());
      }
      return rejectWithValue(err.message || `Failed to update delivery ${id}`);
    }
  },
);

export const deleteDeliveryThunk = createAsyncThunk(
  'deliveries/delete',
  async (id, { rejectWithValue }) => {
    try {
      await deliveriesRepo.remove(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.message || `Failed to delete delivery ${id}`);
    }
  },
);

const deliveriesSlice = createSlice({
  name: 'deliveries',
  initialState,
  reducers: {
    clearSelectedDelivery(state) {
      state.selected = null;
    },
    clearDeliveriesError(state) {
      state.error = null;
    },
    setDeliveryFilter(state, action) {
      const { key, value } = action.payload || {};
      if (key && key in state.ui) state.ui[key] = value;
    },
    setDeliveryDetailId(state, action) {
      state.ui.detailId = action.payload ?? null;
    },
    bumpDeliveryTick(state) {
      state.ui.tick += 1;
    },
    setDeliveryDashboardNotice(state, action) {
      state.ui.dashboardNotice = action.payload || '';
    },
    setDeliveryDashboardDetailId(state, action) {
      state.ui.dashboardDetailId = action.payload ?? null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDeliveriesThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchDeliveriesThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchDeliveriesThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch deliveries';
      });

    builder.addCase(fetchDeliveryByIdThunk.fulfilled, (state, action) => {
      state.selected = action.payload;
    });

    builder
      .addCase(createDeliveryThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createDeliveryThunk.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload && action.payload.id) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(createDeliveryThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to create delivery';
      });

    builder
      .addCase(transitionDeliveryThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(transitionDeliveryThunk.fulfilled, (state, action) => {
        state.saving = false;
        const updated = action.payload;
        if (!updated || !updated.id) return;
        const idx = state.items.findIndex((d) => String(d.id) === String(updated.id));
        if (idx !== -1) {
          state.items[idx] = updated;
        }
        if (state.selected && String(state.selected.id) === String(updated.id)) {
          state.selected = updated;
        }
      })
      .addCase(transitionDeliveryThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to transition delivery';
      });

    builder
      .addCase(updateDeliveryThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateDeliveryThunk.fulfilled, (state, action) => {
        state.saving = false;
        const updated = action.payload;
        if (!updated || !updated.id) return;
        const idx = state.items.findIndex((d) => String(d.id) === String(updated.id));
        if (idx !== -1) {
          state.items[idx] = updated;
        }
        if (state.selected && String(state.selected.id) === String(updated.id)) {
          state.selected = updated;
        }
      })
      .addCase(updateDeliveryThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to update delivery';
      });

    builder
      .addCase(deleteDeliveryThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(deleteDeliveryThunk.fulfilled, (state, action) => {
        state.saving = false;
        const deletedId = action.payload;
        state.items = state.items.filter((d) => String(d.id) !== String(deletedId));
        if (state.selected && String(state.selected.id) === String(deletedId)) {
          state.selected = null;
        }
      })
      .addCase(deleteDeliveryThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to delete delivery';
      });
  },
});

export const {
  clearSelectedDelivery,
  clearDeliveriesError,
  setDeliveryFilter,
  setDeliveryDetailId,
  bumpDeliveryTick,
  setDeliveryDashboardNotice,
  setDeliveryDashboardDetailId,
} = deliveriesSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectAllDeliveries = (state) => state.deliveries?.items || [];
export const selectSelectedDelivery = (state) => state.deliveries?.selected;
export const selectDeliveriesStatus = (state) => state.deliveries?.status || 'idle';
export const selectDeliveriesSaving = (state) => Boolean(state.deliveries?.saving);
export const selectDeliveriesError = (state) => state.deliveries?.error;
export const selectDeliveriesUi = (state) => state.deliveries?.ui || initialState.ui;

export const selectActiveDeliveries = createSelector([selectAllDeliveries], (items) =>
  items.filter((d) => !['Delivered', 'Cancelled', 'Returned to Store'].includes(d.status)),
);

export const selectDeliveryById = (id) =>
  createSelector([selectAllDeliveries], (items) => items.find((d) => String(d.id) === String(id)) || null);

export default deliveriesSlice.reducer;
