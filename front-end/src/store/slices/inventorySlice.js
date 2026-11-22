import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { apiRequest, mapInventoryRow } from '../../lib/dashboard/api.js';

const initialState = {
  products: [],
  suppliers: [],
  status: 'idle',
  error: null,
  currentRequestId: null,
};

const sameId = (a, b) => String(a) === String(b);

/** Safe low-stock predicate handling undefined or string levels */
export const isLowStock = (p) => {
  const stock = Number(p?.stock || 0);
  const reorder = Math.max(0, Number(p?.reorderLevel || 0));
  return stock <= reorder;
};

/**
 * Merges updated product. The incoming `updated` object has ALREADY
 * been normalized through mapInventoryRow in the thunk.
 */
const patchProduct = (state, { productId, updated }) => {
  if (!updated) return;
  const idx = state.products.findIndex((p) => sameId(p.productId, productId));
  if (idx !== -1) {
    state.products[idx] = { ...state.products[idx], ...updated };
  }
};

export const fetchInventoryThunk = createAsyncThunk(
  'inventory/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const [invRes, supRes] = await Promise.allSettled([
        apiRequest('/inventory'),
        apiRequest('/suppliers'),
      ]);

      if (invRes.status === 'rejected') {
        throw invRes.reason;
      }

      const rawProducts = Array.isArray(invRes.value) ? invRes.value : [];
      const suppliers =
        supRes.status === 'fulfilled' && Array.isArray(supRes.value)
          ? supRes.value
          : null;

      return {
        products: rawProducts.map(mapInventoryRow),
        suppliers,
      };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to fetch inventory');
    }
  },
);

export const receiveStockThunk = createAsyncThunk(
  'inventory/receiveStock',
  async ({ productId, quantity, supplierId, note }, { rejectWithValue }) => {
    try {
      const response = await apiRequest('/inventory/receive', {
        method: 'POST',
        body: {
          productId,
          quantity,
          supplierId: supplierId || undefined,
          note: note ? note.trim() : undefined,
        },
      });
      return { productId, updated: mapInventoryRow(response) };
    } catch (error) {
      return rejectWithValue(error?.message || 'Could not receive stock');
    }
  },
);

export const adjustStockThunk = createAsyncThunk(
  'inventory/adjustStock',
  async ({ productId, adjustment, reason }, { rejectWithValue }) => {
    try {
      const response = await apiRequest('/inventory/adjust', {
        method: 'POST',
        body: { productId, adjustment, reason },
      });
      return { productId, updated: mapInventoryRow(response) };
    } catch (error) {
      return rejectWithValue(error?.message || 'Could not adjust stock');
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
    resetInventory() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch lifecycle with race-condition guard
      .addCase(fetchInventoryThunk.pending, (state, action) => {
        state.currentRequestId = action.meta.requestId;
        if (state.status !== 'succeeded') state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchInventoryThunk.fulfilled, (state, action) => {
        if (action.meta.requestId === state.currentRequestId) {
          state.status = 'succeeded';
          state.products = action.payload.products;
          if (action.payload.suppliers !== null) {
            state.suppliers = action.payload.suppliers;
          }
        }
      })
      .addCase(fetchInventoryThunk.rejected, (state, action) => {
        if (action.meta.requestId === state.currentRequestId) {
          state.status = 'failed';
          state.error = action.payload || 'Unknown error';
          // Existing state.products is retained so table remains readable
        }
      })
      // Mutations invalidate in-flight fetches to prevent stale overwrites
      .addCase(receiveStockThunk.fulfilled, (state, action) => {
        state.currentRequestId = null;
        patchProduct(state, action.payload);
      })
      .addCase(adjustStockThunk.fulfilled, (state, action) => {
        state.currentRequestId = null;
        patchProduct(state, action.payload);
      });
  },
});

export const { clearInventoryError, resetInventory } = inventorySlice.actions;

// Base Selectors
export const selectAllProducts = (state) => state.inventory.products;
export const selectAllSuppliers = (state) => state.inventory.suppliers;
export const selectInventoryStatus = (state) => state.inventory.status;
export const selectInventoryError = (state) => state.inventory.error;

// Memoized Selectors (solving deliverySlice's referential instability)
export const selectActiveProducts = createSelector(
  [selectAllProducts],
  (products) => products.filter((p) => p.active !== false)
);

export const selectLowStockProducts = createSelector(
  [selectActiveProducts],
  (products) => products.filter(isLowStock)
);

export const selectLowStockForDashboard = createSelector(
  [selectActiveProducts],
  (products) =>
    products
      .filter((p) => p.status !== 'In Stock')
      .sort((a, b) => Number(a.stock) - Number(b.stock))
);

// Pure domain categories: UI layer handles prepending 'all'
export const selectCategories = createSelector(
  [selectActiveProducts],
  (products) => Array.from(new Set(products.map((p) => p.cat || 'Uncategorized'))).sort()
);

export const selectRetailValuation = createSelector(
  [selectActiveProducts],
  (products) =>
    products.reduce((sum, p) => sum + (Number(p.price) * Number(p.stock) || 0), 0)
);

export default inventorySlice.reducer;
