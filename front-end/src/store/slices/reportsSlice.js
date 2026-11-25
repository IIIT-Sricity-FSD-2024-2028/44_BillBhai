import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { reportsRepo } from '../../repositories/reportsRepo.js';
import { toThunkError } from '../thunkUtils.js';

const rangeKey = (query) => `${query?.from || ''}|${query?.to || ''}`;

const createInitialState = () => ({
  sales: null,
  salesByRange: {},
  inventory: null,
  returns: null,
  loading: {
    sales: false,
    inventory: false,
    returns: false,
  },
  error: null,
});

const initialState = createInitialState();

// -------------------------------------------------------------
// ASYNC THUNKS
// -------------------------------------------------------------

export const fetchSalesReportThunk = createAsyncThunk(
  'reports/fetchSales',
  async (query, { rejectWithValue }) => {
    try {
      return await reportsRepo.getSales(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch sales report'));
    }
  }
);

export const fetchInventoryReportThunk = createAsyncThunk(
  'reports/fetchInventory',
  async (query, { rejectWithValue }) => {
    try {
      return await reportsRepo.getInventory(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch inventory report'));
    }
  }
);

export const fetchReturnsReportThunk = createAsyncThunk(
  'reports/fetchReturns',
  async (query, { rejectWithValue }) => {
    try {
      return await reportsRepo.getReturns(query);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch returns report'));
    }
  }
);

// -------------------------------------------------------------
// SLICE
// -------------------------------------------------------------

export const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    clearReportsError(state) {
      state.error = null;
    },
    resetReports() {
      return createInitialState();
    },
  },
  extraReducers: (builder) => {
    builder
      // Sales Report
      .addCase(fetchSalesReportThunk.pending, (state) => {
        state.loading.sales = true;
        state.error = null;
      })
      .addCase(fetchSalesReportThunk.fulfilled, (state, action) => {
        state.loading.sales = false;
        const payload = action.payload ?? null;
        state.sales = payload;
        state.salesByRange[rangeKey(action.meta?.arg)] = payload;
      })
      .addCase(fetchSalesReportThunk.rejected, (state, action) => {
        state.loading.sales = false;
        state.error = action.payload?.message || 'Failed to fetch sales report';
      })

      // Inventory Report
      .addCase(fetchInventoryReportThunk.pending, (state) => {
        state.loading.inventory = true;
        state.error = null;
      })
      .addCase(fetchInventoryReportThunk.fulfilled, (state, action) => {
        state.loading.inventory = false;
        state.inventory = action.payload ?? null;
      })
      .addCase(fetchInventoryReportThunk.rejected, (state, action) => {
        state.loading.inventory = false;
        state.error = action.payload?.message || 'Failed to fetch inventory report';
      })

      // Returns Report
      .addCase(fetchReturnsReportThunk.pending, (state) => {
        state.loading.returns = true;
        state.error = null;
      })
      .addCase(fetchReturnsReportThunk.fulfilled, (state, action) => {
        state.loading.returns = false;
        state.returns = action.payload ?? null;
      })
      .addCase(fetchReturnsReportThunk.rejected, (state, action) => {
        state.loading.returns = false;
        state.error = action.payload?.message || 'Failed to fetch returns report';
      });
  },
});

export const { clearReportsError, resetReports } = reportsSlice.actions;

// -------------------------------------------------------------
// SELECTORS
// -------------------------------------------------------------

export const selectSalesReport = (state) => state.reports.sales;
export const selectSalesReportFor = (state, from, to) =>
  state.reports.salesByRange[`${from || ''}|${to || ''}`] ?? null;
export const selectInventoryReport = (state) => state.reports.inventory;
export const selectReturnsReport = (state) => state.reports.returns;
export const selectReportsLoading = (state) => state.reports.loading;
export const selectReportsError = (state) => state.reports.error;

export default reportsSlice.reducer;
