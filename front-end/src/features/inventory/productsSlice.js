import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { productsRepo } from './productsRepo.js';
import { toThunkError } from '../../store/thunkUtils.js';

const sameId = (a, b) => String(a) === String(b);

const createInitialState = () => ({
  items: [],
  categories: [],
  selected: null,
  activityByProduct: {},
  status: 'idle',
  activityStatus: 'idle',
  saving: false,
  error: null,
  requestIds: {
    fetchAll: null,
    fetchCategories: null,
    fetchOne: null,
    fetchActivity: null,
  },
});

const initialState = createInitialState();

function upsertProduct(state, product) {
  if (!product) return;
  const idx = state.items.findIndex((p) => sameId(p.id, product.id));
  if (idx === -1) state.items.push(product);
  else state.items[idx] = { ...state.items[idx], ...product };
  if (state.selected && sameId(state.selected.id, product.id)) {
    state.selected = { ...state.selected, ...product };
  }
}

export const fetchProductsThunk = createAsyncThunk(
  'products/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      return await productsRepo.getAll(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch products'));
    }
  },
);

export const fetchProductByIdThunk = createAsyncThunk(
  'products/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      return await productsRepo.getById(id);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch product'));
    }
  },
);

export const fetchProductCategoriesThunk = createAsyncThunk(
  'products/fetchCategories',
  async (query, { rejectWithValue }) => {
    try {
      return await productsRepo.getCategories(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch product categories'));
    }
  },
);

export const fetchProductByBarcodeThunk = createAsyncThunk(
  'products/fetchByBarcode',
  async (arg, { rejectWithValue }) => {
    try {
      const barcode = typeof arg === 'string' ? arg : arg?.barcode;
      const query = typeof arg === 'object' ? arg?.query : undefined;
      return await productsRepo.getByBarcode(barcode, query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Product barcode lookup failed'));
    }
  },
);

export const fetchProductActivityThunk = createAsyncThunk(
  'products/fetchActivity',
  async (arg, { rejectWithValue }) => {
    try {
      const productId = typeof arg === 'string' ? arg : arg?.productId;
      const query = typeof arg === 'object' ? arg?.query : undefined;
      const entries = await productsRepo.getActivity(productId, query);
      return { productId, entries };
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to load product change history'));
    }
  },
);

export const createProductThunk = createAsyncThunk(
  'products/create',
  async (body, { rejectWithValue }) => {
    try {
      return await productsRepo.create(body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not add product'));
    }
  },
);

export const updateProductThunk = createAsyncThunk(
  'products/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await productsRepo.update(id, body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not update product'));
    }
  },
);

export const deleteProductThunk = createAsyncThunk(
  'products/delete',
  async (id, { rejectWithValue }) => {
    try {
      return await productsRepo.remove(id);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not deactivate product'));
    }
  },
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    clearProductsError(state) {
      state.error = null;
    },
    clearSelectedProduct(state) {
      state.selected = null;
    },
    resetProducts() {
      return createInitialState();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductsThunk.pending, (state, action) => {
        state.requestIds.fetchAll = action.meta.requestId;
        if (state.status !== 'succeeded') state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProductsThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchAll) return;
        state.requestIds.fetchAll = null;
        state.status = 'succeeded';
        state.items = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchProductsThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchAll) return;
        state.requestIds.fetchAll = null;
        state.status = 'failed';
        state.error = action.payload?.message || 'Failed to fetch products';
      })

      .addCase(fetchProductCategoriesThunk.pending, (state, action) => {
        state.requestIds.fetchCategories = action.meta.requestId;
      })
      .addCase(fetchProductCategoriesThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchCategories) return;
        state.requestIds.fetchCategories = null;
        state.categories = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchProductCategoriesThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchCategories) return;
        state.requestIds.fetchCategories = null;
      })

      .addCase(fetchProductByIdThunk.pending, (state, action) => {
        state.requestIds.fetchOne = action.meta.requestId;
      })
      .addCase(fetchProductByIdThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
        state.selected = action.payload;
      })
      .addCase(fetchProductByIdThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
      })

      .addCase(fetchProductByBarcodeThunk.pending, (state, action) => {
        state.requestIds.fetchOne = action.meta.requestId;
      })
      .addCase(fetchProductByBarcodeThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
        state.selected = action.payload;
      })
      .addCase(fetchProductByBarcodeThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
      })

      .addCase(fetchProductActivityThunk.pending, (state, action) => {
        state.requestIds.fetchActivity = action.meta.requestId;
        state.activityStatus = 'loading';
      })
      .addCase(fetchProductActivityThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchActivity) return;
        state.requestIds.fetchActivity = null;
        state.activityStatus = 'succeeded';
        if (action.payload?.productId) {
          state.activityByProduct[action.payload.productId] = action.payload.entries || [];
        }
      })
      .addCase(fetchProductActivityThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchActivity) return;
        state.requestIds.fetchActivity = null;
        state.activityStatus = 'failed';
      })

      .addCase(createProductThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(createProductThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        state.requestIds.fetchCategories = null;
        upsertProduct(state, action.payload);
        if (action.payload?.category && !state.categories.includes(action.payload.category)) {
          state.categories = [...state.categories, action.payload.category].sort();
        }
      })
      .addCase(createProductThunk.rejected, (state) => {
        state.saving = false;
      })

      .addCase(updateProductThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(updateProductThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        state.requestIds.fetchCategories = null;
        upsertProduct(state, action.payload);
      })
      .addCase(updateProductThunk.rejected, (state) => {
        state.saving = false;
      })

      .addCase(deleteProductThunk.pending, (state) => {
        state.saving = true;
      })
      .addCase(deleteProductThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.requestIds.fetchAll = null;
        state.requestIds.fetchCategories = null;
        // Soft-deactivate from DB result so Show Inactive continues working.
        const deactivated = action.payload?.product || action.payload;
        upsertProduct(state, deactivated);
      })
      .addCase(deleteProductThunk.rejected, (state) => {
        state.saving = false;
      });
  },
});

export const { clearProductsError, clearSelectedProduct, resetProducts } = productsSlice.actions;

export const selectAllProducts = (state) => state.products.items;
export const selectProductCategories = (state) => state.products.categories;
export const selectSelectedProduct = (state) => state.products.selected;
export const selectProductsStatus = (state) => state.products.status;
export const selectProductsActivityStatus = (state) => state.products.activityStatus;
export const selectProductsSaving = (state) => state.products.saving;
export const selectProductsError = (state) => state.products.error;
export const selectActivityByProduct = (state) => state.products.activityByProduct;

export const selectActiveProducts = createSelector([selectAllProducts], (items) =>
  items.filter((p) => p.active !== false),
);

export const selectDerivedProductCategories = createSelector([selectActiveProducts], (items) =>
  Array.from(new Set(items.map((p) => p.category || 'Uncategorized'))).sort(),
);

export default productsSlice.reducer;
