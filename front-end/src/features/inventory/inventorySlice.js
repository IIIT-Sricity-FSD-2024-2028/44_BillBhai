import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { inventoryRepo } from './inventoryRepo.js';
import { toThunkError } from '../../store/thunkUtils.js';

const sameId = (a, b) => String(a) === String(b);

/** Safe low-stock predicate aligned with back-end InventoryService.computeStatus. */
export const isLowStock = (p) => {
  const stock = Number(p?.stock || 0);
  const reorder = Math.max(0, Number(p?.reorderLevel || 0));
  return stock <= reorder;
};

const createInitialState = () => ({
  items: [],
  lowStock: [],
  movements: [],
  selected: null,
  status: 'idle',
  movementsStatus: 'idle',
  saving: false,
  error: null,
  requestIds: {
    fetchAll: null,
    fetchLowStock: null,
    fetchMovements: null,
    fetchOne: null,
  },
});

const initialState = createInitialState();

function syncLowStockRow(state, row) {
  if (!row) return;
  const idx = state.lowStock.findIndex(
    (entry) => sameId(entry.productId, row.productId) || sameId(entry.inventoryId, row.inventoryId),
  );
  const qualifies = row.active !== false && isLowStock(row);
  if (qualifies) {
    if (idx === -1) state.lowStock.push(row);
    else state.lowStock[idx] = { ...state.lowStock[idx], ...row };
  } else if (idx !== -1) {
    state.lowStock.splice(idx, 1);
  }
}

function patchInventoryItem(state, updated) {
  if (!updated) return;
  const idx = state.items.findIndex(
    (p) => sameId(p.productId, updated.productId) || sameId(p.inventoryId, updated.inventoryId),
  );
  if (idx !== -1) {
    state.items[idx] = { ...state.items[idx], ...updated };
  } else if (updated.productId) {
    state.items.push(updated);
  }
  if (state.selected && sameId(state.selected.productId, updated.productId)) {
    state.selected = { ...state.selected, ...updated };
  }
  syncLowStockRow(state, idx !== -1 ? state.items[idx] : updated);
}

export const fetchInventoryThunk = createAsyncThunk(
  'inventory/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      return await inventoryRepo.getAll(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch inventory'));
    }
  },
);

export const fetchInventoryByIdThunk = createAsyncThunk(
  'inventory/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      return await inventoryRepo.getById(id);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch inventory record'));
    }
  },
);

export const fetchInventoryByProductThunk = createAsyncThunk(
  'inventory/fetchByProduct',
  async (productId, { rejectWithValue }) => {
    try {
      return await inventoryRepo.getByProductId(productId);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch product stock'));
    }
  },
);

export const fetchLowStockThunk = createAsyncThunk(
  'inventory/fetchLowStock',
  async (query, { rejectWithValue }) => {
    try {
      return await inventoryRepo.getLowStock(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch low-stock alerts'));
    }
  },
);

export const fetchMovementsThunk = createAsyncThunk(
  'inventory/fetchMovements',
  async (query, { rejectWithValue }) => {
    try {
      return await inventoryRepo.getMovements(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch stock movements'));
    }
  },
);

export const adjustStockThunk = createAsyncThunk(
  'inventory/adjustStock',
  async (body, { rejectWithValue }) => {
    try {
      return await inventoryRepo.adjustStock(body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not adjust stock'));
    }
  },
);

export const receiveStockThunk = createAsyncThunk(
  'inventory/receiveStock',
  async (body, { rejectWithValue }) => {
    try {
      return await inventoryRepo.receiveStock(body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not receive stock'));
    }
  },
);

export const updateInventoryThunk = createAsyncThunk(
  'inventory/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await inventoryRepo.update(id, body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not update inventory settings'));
    }
  },
);

export const deleteInventoryThunk = createAsyncThunk(
  'inventory/delete',
  async (id, { rejectWithValue }) => {
    try {
      await inventoryRepo.remove(id);
      return id;
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not delete inventory record'));
    }
  },
);

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    clearInventoryError(state) {
      state.error = null;
    },
    clearMovements(state) {
      state.movements = [];
      state.movementsStatus = 'idle';
      state.requestIds.fetchMovements = null;
    },
    resetInventory() {
      return createInitialState();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventoryThunk.pending, (state, action) => {
        state.requestIds.fetchAll = action.meta.requestId;
        if (state.status !== 'succeeded') state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchInventoryThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchAll) return;
        state.requestIds.fetchAll = null;
        state.status = 'succeeded';
        const rows = Array.isArray(action.payload) ? action.payload : [];
        state.items = rows;
        state.lowStock = rows.filter((p) => p.active !== false && isLowStock(p));
      })
      .addCase(fetchInventoryThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchAll) return;
        state.requestIds.fetchAll = null;
        state.status = 'failed';
        state.error = action.payload?.message || 'Failed to fetch inventory';
      })

      .addCase(fetchLowStockThunk.pending, (state, action) => {
        state.requestIds.fetchLowStock = action.meta.requestId;
      })
      .addCase(fetchLowStockThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchLowStock) return;
        state.requestIds.fetchLowStock = null;
        state.lowStock = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchLowStockThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchLowStock) return;
        state.requestIds.fetchLowStock = null;
      })

      .addCase(fetchMovementsThunk.pending, (state, action) => {
        state.requestIds.fetchMovements = action.meta.requestId;
        state.movementsStatus = 'loading';
      })
      .addCase(fetchMovementsThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchMovements) return;
        state.requestIds.fetchMovements = null;
        state.movementsStatus = 'succeeded';
        state.movements = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchMovementsThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchMovements) return;
        state.requestIds.fetchMovements = null;
        state.movementsStatus = 'failed';
      })

      .addCase(fetchInventoryByIdThunk.pending, (state, action) => {
        state.requestIds.fetchOne = action.meta.requestId;
      })
      .addCase(fetchInventoryByIdThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
        state.selected = action.payload;
      })
      .addCase(fetchInventoryByIdThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
      })

      .addCase(fetchInventoryByProductThunk.pending, (state, action) => {
        state.requestIds.fetchOne = action.meta.requestId;
      })
      .addCase(fetchInventoryByProductThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
        state.selected = action.payload;
      })
      .addCase(fetchInventoryByProductThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
      })

      // Strict DB-first stock updates: NEVER touch stock in .pending; patch only in .fulfilled.
      .addCase(adjustStockThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(adjustStockThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        state.requestIds.fetchLowStock = null;
        patchInventoryItem(state, action.payload);
      })
      .addCase(adjustStockThunk.rejected, (state) => {
        state.saving = false;
      })

      .addCase(receiveStockThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(receiveStockThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        state.requestIds.fetchLowStock = null;
        patchInventoryItem(state, action.payload);
      })
      .addCase(receiveStockThunk.rejected, (state) => {
        state.saving = false;
      })

      .addCase(updateInventoryThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(updateInventoryThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        state.requestIds.fetchLowStock = null;
        patchInventoryItem(state, action.payload);
      })
      .addCase(updateInventoryThunk.rejected, (state) => {
        state.saving = false;
      })

      .addCase(deleteInventoryThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(deleteInventoryThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        state.requestIds.fetchLowStock = null;
        state.items = state.items.filter((i) => !sameId(i.inventoryId, action.payload));
        state.lowStock = state.lowStock.filter((i) => !sameId(i.inventoryId, action.payload));
        if (state.selected && sameId(state.selected.inventoryId, action.payload)) {
          state.selected = null;
        }
      })
      .addCase(deleteInventoryThunk.rejected, (state) => {
        state.saving = false;
      });
  },
});

export const { clearInventoryError, clearMovements, resetInventory } = inventorySlice.actions;

export const selectAllInventory = (state) => state.inventory.items;
export const selectLowStockState = (state) => state.inventory.lowStock;
export const selectMovements = (state) => state.inventory.movements;
export const selectSelectedInventory = (state) => state.inventory.selected;
export const selectInventoryStatus = (state) => state.inventory.status;
export const selectMovementsStatus = (state) => state.inventory.movementsStatus;
export const selectInventorySaving = (state) => state.inventory.saving;
export const selectInventoryError = (state) => state.inventory.error;

export const selectActiveCatalog = createSelector([selectAllInventory], (items) =>
  items.filter((p) => p.active !== false),
);

export const selectLowStockItems = createSelector([selectActiveCatalog], (items) =>
  items.filter(isLowStock),
);

export const selectLowStockForDashboard = createSelector([selectActiveCatalog], (items) =>
  items
    .filter((p) => p.status !== 'In Stock')
    .sort((a, b) => Number(a.stock) - Number(b.stock)),
);

export const selectInventoryCategories = createSelector([selectAllInventory], (items) =>
  Array.from(new Set(items.map((p) => p.cat || 'Uncategorized'))).sort(),
);

export const selectInventorySupplierNames = createSelector([selectAllInventory], (items) =>
  Array.from(new Set(items.map((p) => p.supplier).filter(Boolean))).sort(),
);

export const selectInventoryValuation = createSelector([selectActiveCatalog], (items) =>
  items.reduce(
    (acc, p) => {
      const stock = Number(p.stock) || 0;
      const price = Number(p.price) || 0;
      const cost = Number(p.costPrice ?? p.price) || 0;
      acc.totalUnits += stock;
      acc.retailValue += price * stock || 0;
      acc.costValue += cost * stock || 0;
      return acc;
    },
    { retailValue: 0, costValue: 0, totalUnits: 0 },
  ),
);

export default inventorySlice.reducer;
