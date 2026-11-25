import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { returnsRepo } from '../../repositories/returnsRepo.js';

const initialState = {
  items: [],
  selected: null,
  returnableForOrder: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  saving: false,
  error: null,
};

export const fetchReturnsThunk = createAsyncThunk(
  'returns/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      const data = await returnsRepo.list(query);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch returns');
    }
  },
);

/** Fetch single return by ID (Read) */
export const fetchReturnByIdThunk = createAsyncThunk(
  'returns/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      return await returnsRepo.getById(id);
    } catch (err) {
      return rejectWithValue(err.message || `Failed to fetch return ${id}`);
    }
  },
);

/** Fetch returnable items for an order (Replaces local api() in RaiseReturnModal) */
export const fetchReturnableOrderThunk = createAsyncThunk(
  'returns/fetchReturnableForOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      return await returnsRepo.getReturnableByOrderId(orderId);
    } catch (err) {
      return rejectWithValue(err.message || `Failed to fetch returnable items for order ${orderId}`);
    }
  },
);

/** Create a new return request (Create) */
export const createReturnThunk = createAsyncThunk(
  'returns/create',
  async (body, { rejectWithValue }) => {
    try {
      return await returnsRepo.create(body);
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to create return request');
    }
  },
);

export const transitionReturnThunk = createAsyncThunk(
  'returns/transition',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const updated = await returnsRepo.transition(id, body);
      return updated;
    } catch (err) {
      return rejectWithValue(err.message || `Failed to transition return ${id}`);
    }
  },
);

export const updateReturnThunk = createAsyncThunk(
  'returns/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const updated = await returnsRepo.update(id, body);
      return updated;
    } catch (err) {
      return rejectWithValue(err.message || `Failed to update return ${id}`);
    }
  },
);

export const deleteReturnThunk = createAsyncThunk(
  'returns/delete',
  async (id, { rejectWithValue }) => {
    try {
      await returnsRepo.remove(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.message || `Failed to delete return ${id}`);
    }
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────
const returnsSlice = createSlice({
  name: 'returns',
  initialState,
  reducers: {
    clearReturnableForOrder(state) {
      state.returnableForOrder = null;
    },
    clearSelectedReturn(state) {
      state.selected = null;
    },
    clearReturnsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ── Fetch All ──
    builder
      .addCase(fetchReturnsThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchReturnsThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchReturnsThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch returns';
      });

    // ── Fetch By ID ──
    builder.addCase(fetchReturnByIdThunk.fulfilled, (state, action) => {
      state.selected = action.payload;
    });

    // ── Fetch Returnable For Order ──
    builder
      .addCase(fetchReturnableOrderThunk.pending, (state) => {
        state.returnableForOrder = null;
      })
      .addCase(fetchReturnableOrderThunk.fulfilled, (state, action) => {
        state.returnableForOrder = action.payload;
      })
      .addCase(fetchReturnableOrderThunk.rejected, (state, action) => {
        state.returnableForOrder = null;
        state.error = action.payload || 'Failed to fetch returnable lines';
      });

    // ── Create (.fulfilled adds record to items) ──
    builder
      .addCase(createReturnThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createReturnThunk.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload && action.payload.id) {
          state.items.unshift(action.payload);
        }
      })
      .addCase(createReturnThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to create return request';
      });

    // ── Transition (.fulfilled replaces canonical DB record) ──
    builder
      .addCase(transitionReturnThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(transitionReturnThunk.fulfilled, (state, action) => {
        state.saving = false;
        const updated = action.payload;
        if (!updated || !updated.id) return;
        const idx = state.items.findIndex((r) => String(r.id) === String(updated.id));
        if (idx !== -1) {
          state.items[idx] = updated;
        }
        if (state.selected && String(state.selected.id) === String(updated.id)) {
          state.selected = updated;
        }
      })
      .addCase(transitionReturnThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to transition return';
      });

    // ── Update (.fulfilled replaces item) ──
    builder
      .addCase(updateReturnThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateReturnThunk.fulfilled, (state, action) => {
        state.saving = false;
        const updated = action.payload;
        if (!updated || !updated.id) return;
        const idx = state.items.findIndex((r) => String(r.id) === String(updated.id));
        if (idx !== -1) {
          state.items[idx] = updated;
        }
        if (state.selected && String(state.selected.id) === String(updated.id)) {
          state.selected = updated;
        }
      })
      .addCase(updateReturnThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to update return';
      });

    // ── Delete (.fulfilled removes matching item) ──
    builder
      .addCase(deleteReturnThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(deleteReturnThunk.fulfilled, (state, action) => {
        state.saving = false;
        const deletedId = action.payload;
        state.items = state.items.filter((r) => String(r.id) !== String(deletedId));
        if (state.selected && String(state.selected.id) === String(deletedId)) {
          state.selected = null;
        }
      })
      .addCase(deleteReturnThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to delete return';
      });
  },
});

export const { clearReturnableForOrder, clearSelectedReturn, clearReturnsError } = returnsSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectAllReturns = (state) => state.returns?.items || [];
export const selectSelectedReturn = (state) => state.returns?.selected;
export const selectReturnableForOrder = (state) => state.returns?.returnableForOrder;
export const selectReturnsStatus = (state) => state.returns?.status || 'idle';
export const selectReturnsSaving = (state) => Boolean(state.returns?.saving);
export const selectReturnsError = (state) => state.returns?.error;

export const selectPendingReturns = createSelector([selectAllReturns], (items) =>
  items.filter((r) => r.status === 'Pending'),
);

export const selectApprovedReturns = createSelector([selectAllReturns], (items) =>
  items.filter((r) => r.status === 'Approved'),
);

export const selectReturnById = (id) =>
  createSelector([selectAllReturns], (items) => items.find((r) => String(r.id) === String(id)) || null);

export default returnsSlice.reducer;
