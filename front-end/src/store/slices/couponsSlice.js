import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { couponsRepo } from '../../repositories/couponsRepo.js';
import { toThunkError } from '../thunkUtils.js';

const sameId = (a, b) => String(a) === String(b);

const createInitialState = () => ({
  items: [],
  analytics: null,
  validationResult: null,
  status: 'idle',
  analyticsStatus: 'idle',
  saving: false,
  error: null,
});

const initialState = createInitialState();

function upsertCoupon(state, coupon) {
  if (!coupon || !coupon.id) return;
  const idx = state.items.findIndex((c) => sameId(c.id, coupon.id));
  if (idx === -1) state.items.unshift(coupon);
  else state.items[idx] = { ...state.items[idx], ...coupon };
}

// -------------------------------------------------------------
// ASYNC THUNKS
// -------------------------------------------------------------

export const fetchCouponsThunk = createAsyncThunk(
  'coupons/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      return await couponsRepo.getAll(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch coupons'));
    }
  }
);

export const fetchCouponAnalyticsThunk = createAsyncThunk(
  'coupons/fetchAnalytics',
  async (query, { rejectWithValue }) => {
    try {
      return await couponsRepo.getAnalytics(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch coupon analytics'));
    }
  }
);

export const createCouponThunk = createAsyncThunk(
  'coupons/create',
  async (body, { rejectWithValue }) => {
    try {
      return await couponsRepo.create(body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to create coupon'));
    }
  }
);

export const updateCouponThunk = createAsyncThunk(
  'coupons/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await couponsRepo.update(id, body);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to update coupon'));
    }
  }
);

export const deleteCouponThunk = createAsyncThunk(
  'coupons/delete',
  async (id, { rejectWithValue }) => {
    try {
      const response = await couponsRepo.remove(id);
      return { id, response };
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to delete coupon'));
    }
  }
);

export const validateCouponThunk = createAsyncThunk(
  'coupons/validate',
  async ({ code, subtotal, customerPhone, customerId, companyId }, { rejectWithValue }) => {
    try {
      return await couponsRepo.validate({ code, subtotal, customerPhone, customerId, companyId });
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Coupon validation failed'));
    }
  }
);

// -------------------------------------------------------------
// SLICE
// -------------------------------------------------------------

export const couponsSlice = createSlice({
  name: 'coupons',
  initialState,
  reducers: {
    clearCouponsError(state) {
      state.error = null;
    },
    clearValidationResult(state) {
      state.validationResult = null;
    },
    resetCoupons() {
      return createInitialState();
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Coupons
      .addCase(fetchCouponsThunk.pending, (state) => {
        if (state.status !== 'succeeded') state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCouponsThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchCouponsThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message || 'Failed to fetch coupons';
      })

      // Fetch Coupon Analytics
      .addCase(fetchCouponAnalyticsThunk.pending, (state) => {
        if (state.analyticsStatus !== 'succeeded') state.analyticsStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchCouponAnalyticsThunk.fulfilled, (state, action) => {
        state.analyticsStatus = 'succeeded';
        state.analytics = action.payload || null;
      })
      .addCase(fetchCouponAnalyticsThunk.rejected, (state, action) => {
        state.analyticsStatus = 'failed';
        state.error = action.payload?.message || 'Failed to fetch coupon analytics';
      })

      // Create Coupon
      .addCase(createCouponThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createCouponThunk.fulfilled, (state, action) => {
        state.saving = false;
        upsertCoupon(state, action.payload);
      })
      .addCase(createCouponThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload?.message || 'Failed to create coupon';
      })

      // Update Coupon
      .addCase(updateCouponThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateCouponThunk.fulfilled, (state, action) => {
        state.saving = false;
        upsertCoupon(state, action.payload);
      })
      .addCase(updateCouponThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload?.message || 'Failed to update coupon';
      })

      // Delete (or Deactivate) Coupon (DB-first)
      .addCase(deleteCouponThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(deleteCouponThunk.fulfilled, (state, action) => {
        state.saving = false;
        const { id, response } = action.payload || {};
        const message = String(response?.message || '').toLowerCase();
        const couponRecord = response?.coupon || (response?.id ? response : null);
        const wasDeactivated =
          Boolean(response?.deactivated) ||
          message.includes('switched off') ||
          Boolean(couponRecord && couponRecord.active === false && !message.includes('deleted'));

        if (wasDeactivated && couponRecord) {
          upsertCoupon(state, couponRecord);
        } else if (id !== undefined) {
          state.items = state.items.filter((c) => !sameId(c.id, id));
        }
      })
      .addCase(deleteCouponThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload?.message || 'Failed to delete coupon';
      })

      // Validate Coupon
      .addCase(validateCouponThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(validateCouponThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.validationResult = action.payload || null;
      })
      .addCase(validateCouponThunk.rejected, (state, action) => {
        state.saving = false;
        state.validationResult = null;
        state.error = action.payload?.message || 'Coupon validation failed';
      });
  },
});

export const {
  clearCouponsError,
  clearValidationResult,
  resetCoupons,
} = couponsSlice.actions;

// -------------------------------------------------------------
// SELECTORS
// -------------------------------------------------------------

export const selectAllCoupons = (state) => state.coupons.items;
export const selectCouponAnalytics = (state) => state.coupons.analytics;
export const selectCouponValidationResult = (state) => state.coupons.validationResult;
export const selectCouponsStatus = (state) => state.coupons.status;
export const selectCouponAnalyticsStatus = (state) => state.coupons.analyticsStatus;
export const selectCouponsSaving = (state) => state.coupons.saving;
export const selectCouponsError = (state) => state.coupons.error;

export const selectCouponById = createSelector(
  [selectAllCoupons, (_state, id) => id],
  (items, id) => (id ? items.find((c) => sameId(c.id, id)) || null : null)
);

export const selectActiveCoupons = createSelector(
  [selectAllCoupons],
  (items) => items.filter((c) => c.active !== false)
);

export default couponsSlice.reducer;
