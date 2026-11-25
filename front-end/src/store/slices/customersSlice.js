import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { customersRepo } from '../../repositories/customersRepo.js';
import { errorText } from '../../lib/http.js';

export const lookupCustomerByPhoneThunk = createAsyncThunk(
  'customers/lookupByPhone',
  async (phone, { rejectWithValue }) => {
    try {
      const profile = await customersRepo.findByPhone(phone);
      return { phone: String(phone || '').replace(/\D/g, ''), profile };
    } catch (err) {
      return rejectWithValue(errorText(err, 'Customer lookup failed.'));
    }
  },
);

export const fetchCustomersThunk = createAsyncThunk(
  'customers/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      const rows = await customersRepo.getAll(query);
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not load customers.'));
    }
  },
);

export const fetchCustomerByIdThunk = createAsyncThunk(
  'customers/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      return await customersRepo.getById(id);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not load customer.'));
    }
  },
);

export const createCustomerThunk = createAsyncThunk(
  'customers/create',
  async (body, { rejectWithValue }) => {
    try {
      return await customersRepo.create(body);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not create customer.'));
    }
  },
);

export const updateCustomerThunk = createAsyncThunk(
  'customers/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await customersRepo.update(id, body);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not update customer.'));
    }
  },
);

export const deleteCustomerThunk = createAsyncThunk(
  'customers/delete',
  async (id, { rejectWithValue }) => {
    try {
      await customersRepo.remove(id);
      return String(id);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not delete customer.'));
    }
  },
);

const initialState = {
  items: [],
  selected: null,
  lookupResult: null,
  lookupPhone: '',
  lookupStatus: 'idle',
  status: 'idle',
  saving: false,
  error: null,
};

const customersSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    clearCustomerLookup(state) {
      state.lookupResult = null;
      state.lookupPhone = '';
      state.lookupStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(lookupCustomerByPhoneThunk.pending, (state, action) => {
        state.lookupStatus = 'loading';
        state.lookupPhone = String(action.meta.arg || '').replace(/\D/g, '');
      })
      .addCase(lookupCustomerByPhoneThunk.fulfilled, (state, action) => {
        state.lookupStatus = 'succeeded';
        state.lookupPhone = action.payload.phone;
        state.lookupResult = action.payload.profile;
      })
      .addCase(lookupCustomerByPhoneThunk.rejected, (state) => {
        state.lookupStatus = 'failed';
        state.lookupResult = null;
      })
      .addCase(fetchCustomersThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCustomersThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchCustomersThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchCustomerByIdThunk.fulfilled, (state, action) => {
        state.selected = action.payload;
      })
      .addCase(createCustomerThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createCustomerThunk.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) state.items.push(action.payload);
      })
      .addCase(createCustomerThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateCustomerThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateCustomerThunk.fulfilled, (state, action) => {
        state.saving = false;
        const updated = action.payload;
        if (updated && updated.id) {
          state.items = state.items.map((c) => (c.id === updated.id ? updated : c));
          if (state.selected && state.selected.id === updated.id) state.selected = updated;
        }
      })
      .addCase(updateCustomerThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(deleteCustomerThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(deleteCustomerThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.filter((c) => c.id !== action.payload);
      })
      .addCase(deleteCustomerThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { clearCustomerLookup } = customersSlice.actions;

export const selectAllCustomers = (state) => state.customers.items;
export const selectCustomerLookup = (state) => state.customers.lookupResult;
export const selectCustomerLookupStatus = (state) => state.customers.lookupStatus;

export default customersSlice.reducer;
