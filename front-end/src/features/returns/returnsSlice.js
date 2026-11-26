import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { returnsRepo } from './returnsRepo.js';
import { api } from '../../shared/lib/http.js';
import { getState as getDashboardState } from '../../shared/lib/dashboard/store.js';
import { scopedCompanyId } from '../orders/components/orderFormat.js';

const NOT_SELLABLE_REASONS = ['damaged', 'expired', 'stale', 'defective'];

const initialActionForm = {
  refundMethod: 'Cash',
  restock: true,
  rejectReason: '',
  note: '',
  error: '',
  saving: false,
};

const initialRaiseForm = {
  orderInput: '',
  loading: false,
  order: null,
  matches: [],
  qty: {},
  reason: '',
  otherReason: '',
  condition: 'good',
  returnType: 'refund',
  requestedBy: '',
  note: '',
  error: '',
  saving: false,
};

const initialEditForm = {
  reason: '',
  note: '',
  error: '',
  saving: false,
};

const initialState = {
  items: [],
  selected: null,
  returnableForOrder: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  saving: false,
  error: null,
  ui: {
    tab: 'pending',
    sortKey: 'new',
    search: '',
    reasonFilter: 'all',
    typeFilter: 'all',
    from: '',
    to: '',
    raiseOpen: false,
    actionModal: null,
    editModal: null,
    detailItem: null,
    detailHistory: { loading: false, rows: [], error: '' },
    actionForm: { ...initialActionForm },
    raiseForm: { ...initialRaiseForm },
    editForm: { ...initialEditForm },
    weekReport: null,
  },
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

export const fetchReturnsWeekReportThunk = createAsyncThunk(
  'returns/fetchWeekReport',
  async ({ from, to }, { rejectWithValue }) => {
    try {
      return await api('/reports/returns', { query: { from, to } });
    } catch {
      return rejectWithValue(null);
    }
  },
);

export const fetchReturnHistoryThunk = createAsyncThunk(
  'returns/fetchHistory',
  async (returnId, { rejectWithValue }) => {
    try {
      const rows = await api('/activity', { query: { entity: 'return', entityId: returnId, limit: 50 } });
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      return rejectWithValue(err.message || 'History unavailable');
    }
  },
);

export const transitionReturnThunk = createAsyncThunk(
  'returns/transition',
  async ({ id, body }, { dispatch, rejectWithValue }) => {
    try {
      const updated = await returnsRepo.transition(id, body);
      return updated;
    } catch (err) {
      if (err?.status === 409) {
        const companyId = scopedCompanyId(getDashboardState());
        const listAction = await dispatch(fetchReturnsThunk({ companyId }));
        const latest = Array.isArray(listAction.payload)
          ? listAction.payload.find((r) => String(r.id) === String(id))
          : null;
        const baseMsg = String(err.message || '').replace(/\s*Reload to see the latest version\.?/i, '');
        const detail = latest?.status
          ? ` Current status: ${latest.status}${latest.updatedBy ? ` (by ${latest.updatedBy})` : ''}.`
          : '';
        return rejectWithValue(`${baseMsg}${detail} List refreshed.`.trim());
      }
      return rejectWithValue(err.message || `Failed to transition return ${id}`);
    }
  },
);

export const updateReturnThunk = createAsyncThunk(
  'returns/update',
  async ({ id, body }, { dispatch, rejectWithValue }) => {
    try {
      const updated = await returnsRepo.update(id, body);
      return updated;
    } catch (err) {
      if (err?.status === 409) {
        const companyId = scopedCompanyId(getDashboardState());
        const listAction = await dispatch(fetchReturnsThunk({ companyId }));
        const latest = Array.isArray(listAction.payload)
          ? listAction.payload.find((r) => String(r.id) === String(id))
          : null;
        const baseMsg = String(err.message || '').replace(/\s*Reload to see the latest version\.?/i, '');
        const detail = latest?.status
          ? ` Current status: ${latest.status}${latest.updatedBy ? ` (by ${latest.updatedBy})` : ''}.`
          : '';
        return rejectWithValue(`${baseMsg}${detail} List refreshed.`.trim());
      }
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
    setReturnFilter(state, action) {
      const { key, value } = action.payload || {};
      if (key && key in state.ui) state.ui[key] = value;
    },
    clearReturnFilters(state) {
      state.ui.search = '';
      state.ui.reasonFilter = 'all';
      state.ui.typeFilter = 'all';
      state.ui.from = '';
      state.ui.to = '';
    },
    setRaiseReturnOpen(state, action) {
      state.ui.raiseOpen = Boolean(action.payload);
    },
    openReturnActionModal(state, action) {
      state.ui.actionModal = action.payload;
      const item = action.payload?.item;
      const order = action.payload?.order;
      const isNotSellable =
        item?.condition === 'damaged' ||
        NOT_SELLABLE_REASONS.includes(String(item?.reason || '').toLowerCase());
      const billMethod = order?.payment;
      const defaultMethod = ['Cash', 'UPI', 'Card'].includes(billMethod) ? billMethod : 'Cash';
      state.ui.actionForm = {
        ...initialActionForm,
        refundMethod: defaultMethod,
        restock: !isNotSellable,
      };
    },
    closeReturnActionModal(state) {
      state.ui.actionModal = null;
      state.ui.actionForm = { ...initialActionForm };
    },
    setReturnActionFormField(state, action) {
      const { key, value } = action.payload || {};
      if (key && key in state.ui.actionForm) state.ui.actionForm[key] = value;
    },
    openReturnEditModal(state, action) {
      const item = action.payload || null;
      state.ui.editModal = item;
      state.ui.editForm = {
        ...initialEditForm,
        reason: item?.reason || '',
        note: item?.note || '',
      };
    },
    closeReturnEditModal(state) {
      state.ui.editModal = null;
      state.ui.editForm = { ...initialEditForm };
    },
    setReturnEditFormField(state, action) {
      const { key, value } = action.payload || {};
      if (key && key in state.ui.editForm) state.ui.editForm[key] = value;
    },
    setRaiseFormField(state, action) {
      const { key, value } = action.payload || {};
      if (key && key in state.ui.raiseForm) {
        state.ui.raiseForm[key] = value;
        if (key === 'reason') {
          state.ui.raiseForm.condition = NOT_SELLABLE_REASONS.includes(String(value || '').toLowerCase())
            ? 'damaged'
            : 'good';
        }
      }
    },
    setRaiseLineQty(state, action) {
      const { productId, value } = action.payload || {};
      if (productId) state.ui.raiseForm.qty[productId] = value;
    },
    setRaiseOrderResult(state, action) {
      const { order, orderInput } = action.payload || {};
      state.ui.raiseForm.order = order || null;
      if (orderInput !== undefined) state.ui.raiseForm.orderInput = orderInput;
      state.ui.raiseForm.qty = {};
      state.ui.raiseForm.requestedBy = order?.customerName || '';
    },
    resetRaiseForm(state) {
      state.ui.raiseForm = { ...initialRaiseForm };
    },
    setReturnDetailItem(state, action) {
      state.ui.detailItem = action.payload ?? null;
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

    builder
      .addCase(fetchReturnsWeekReportThunk.fulfilled, (state, action) => {
        state.ui.weekReport = action.payload || null;
      })
      .addCase(fetchReturnsWeekReportThunk.rejected, (state) => {
        state.ui.weekReport = null;
      });

    builder
      .addCase(fetchReturnHistoryThunk.pending, (state) => {
        state.ui.detailHistory = { loading: true, rows: [], error: '' };
      })
      .addCase(fetchReturnHistoryThunk.fulfilled, (state, action) => {
        state.ui.detailHistory = { loading: false, rows: action.payload || [], error: '' };
      })
      .addCase(fetchReturnHistoryThunk.rejected, (state, action) => {
        state.ui.detailHistory = { loading: false, rows: [], error: action.payload || 'History unavailable' };
      });
  },
});

export const {
  clearReturnableForOrder,
  clearSelectedReturn,
  clearReturnsError,
  setReturnFilter,
  clearReturnFilters,
  setRaiseReturnOpen,
  openReturnActionModal,
  closeReturnActionModal,
  setReturnActionFormField,
  openReturnEditModal,
  closeReturnEditModal,
  setReturnEditFormField,
  setRaiseFormField,
  setRaiseLineQty,
  setRaiseOrderResult,
  resetRaiseForm,
  setReturnDetailItem,
} = returnsSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectAllReturns = (state) => state.returns?.items || [];
export const selectSelectedReturn = (state) => state.returns?.selected;
export const selectReturnableForOrder = (state) => state.returns?.returnableForOrder;
export const selectReturnsStatus = (state) => state.returns?.status || 'idle';
export const selectReturnsSaving = (state) => Boolean(state.returns?.saving);
export const selectReturnsError = (state) => state.returns?.error;
export const selectReturnsUi = (state) => state.returns?.ui || initialState.ui;

export const selectPendingReturns = createSelector([selectAllReturns], (items) =>
  items.filter((r) => r.status === 'Pending'),
);

export const selectApprovedReturns = createSelector([selectAllReturns], (items) =>
  items.filter((r) => r.status === 'Approved'),
);

export const selectReturnById = (id) =>
  createSelector([selectAllReturns], (items) => items.find((r) => String(r.id) === String(id)) || null);

export default returnsSlice.reducer;
