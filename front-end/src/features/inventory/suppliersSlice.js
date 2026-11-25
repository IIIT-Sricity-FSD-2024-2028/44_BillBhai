import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { suppliersRepo } from './suppliersRepo.js';
import { toThunkError } from '../../store/thunkUtils.js';

const sameId = (a, b) => String(a) === String(b);

const createInitialState = () => ({
  items: [],
  selected: null,
  status: 'idle',
  saving: false,
  error: null,
  requestIds: {
    fetchAll: null,
    fetchOne: null,
  },
});

const initialState = createInitialState();

export const fetchSuppliersThunk = createAsyncThunk(
  'suppliers/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      return await suppliersRepo.getAll(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch suppliers'));
    }
  },
);

export const fetchSupplierByIdThunk = createAsyncThunk(
  'suppliers/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      return await suppliersRepo.getById(id);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch supplier'));
    }
  },
);

export const createSupplierThunk = createAsyncThunk(
  'suppliers/create',
  async (body, { rejectWithValue }) => {
    try {
      return await suppliersRepo.create(body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not add supplier'));
    }
  },
);

export const updateSupplierThunk = createAsyncThunk(
  'suppliers/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await suppliersRepo.update(id, body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not update supplier'));
    }
  },
);

export const deleteSupplierThunk = createAsyncThunk(
  'suppliers/delete',
  async (id, { rejectWithValue }) => {
    try {
      await suppliersRepo.remove(id);
      return id;
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not delete supplier'));
    }
  },
);

const suppliersSlice = createSlice({
  name: 'suppliers',
  initialState,
  reducers: {
    clearSuppliersError(state) {
      state.error = null;
    },
    clearSelectedSupplier(state) {
      state.selected = null;
    },
    resetSuppliers() {
      return createInitialState();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSuppliersThunk.pending, (state, action) => {
        state.requestIds.fetchAll = action.meta.requestId;
        if (state.status !== 'succeeded') state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSuppliersThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchAll) return;
        state.requestIds.fetchAll = null;
        state.status = 'succeeded';
        state.items = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchSuppliersThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchAll) return;
        state.requestIds.fetchAll = null;
        state.status = 'failed';
        state.error = action.payload?.message || 'Failed to fetch suppliers';
      })

      .addCase(fetchSupplierByIdThunk.pending, (state, action) => {
        state.requestIds.fetchOne = action.meta.requestId;
      })
      .addCase(fetchSupplierByIdThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
        state.selected = action.payload;
      })
      .addCase(fetchSupplierByIdThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
      })

      .addCase(createSupplierThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(createSupplierThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        if (action.payload) {
          const idx = state.items.findIndex((s) => sameId(s.id, action.payload.id));
          if (idx === -1) state.items.push(action.payload);
          else state.items[idx] = action.payload;
        }
      })
      .addCase(createSupplierThunk.rejected, (state) => {
        state.saving = false;
      })

      .addCase(updateSupplierThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(updateSupplierThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        if (action.payload) {
          const idx = state.items.findIndex((s) => sameId(s.id, action.payload.id));
          if (idx !== -1) state.items[idx] = { ...state.items[idx], ...action.payload };
          if (state.selected && sameId(state.selected.id, action.payload.id)) {
            state.selected = { ...state.selected, ...action.payload };
          }
        }
      })
      .addCase(updateSupplierThunk.rejected, (state) => {
        state.saving = false;
      })

      .addCase(deleteSupplierThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(deleteSupplierThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        state.items = state.items.filter((s) => !sameId(s.id, action.payload));
        if (state.selected && sameId(state.selected.id, action.payload)) {
          state.selected = null;
        }
      })
      .addCase(deleteSupplierThunk.rejected, (state) => {
        state.saving = false;
      });
  },
});

export const { clearSuppliersError, clearSelectedSupplier, resetSuppliers } = suppliersSlice.actions;

export const selectAllSuppliers = (state) => state.suppliers.items;
export const selectSelectedSupplier = (state) => state.suppliers.selected;
export const selectSuppliersStatus = (state) => state.suppliers.status;
export const selectSuppliersSaving = (state) => state.suppliers.saving;
export const selectSuppliersError = (state) => state.suppliers.error;

export const selectSortedSuppliers = createSelector([selectAllSuppliers], (items) =>
  [...items].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
);

export default suppliersSlice.reducer;
