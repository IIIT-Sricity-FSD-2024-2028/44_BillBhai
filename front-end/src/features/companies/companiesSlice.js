import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { companiesRepo } from './companiesRepo.js';
import { normalizeBusinessRecord } from '../../shared/lib/dashboard/helpers.js';
import { errorText, storeLoginSession } from '../../shared/lib/http.js';

function toBusinessRecord(company) {
  return normalizeBusinessRecord(company, company && company.id, company && company.name);
}

export const registerCompanyThunk = createAsyncThunk(
  'companies/register',
  async (body, { rejectWithValue }) => {
    try {
      const result = await companiesRepo.register(body);
      if (result && result.session) {
        storeLoginSession(result.session);
      }
      return result;
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not create the business right now.'));
    }
  },
);

export const fetchCompaniesThunk = createAsyncThunk(
  'companies/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const rows = await companiesRepo.getAll();
      return (Array.isArray(rows) ? rows : []).map(toBusinessRecord);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not load businesses'));
    }
  },
);

export const fetchMyCompanyProfileThunk = createAsyncThunk(
  'companies/fetchMyProfile',
  async (_, { rejectWithValue }) => {
    try {
      const company = await companiesRepo.getMyProfile();
      if (company && company.plan) {
        try {
          localStorage.setItem('activeBusinessPlan', company.plan);
        } catch {
          /* ignore storage errors */
        }
      }
      return company;
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not load business profile.'));
    }
  },
);

export const fetchCompanyByIdThunk = createAsyncThunk(
  'companies/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const company = await companiesRepo.getById(id);
      return toBusinessRecord(company);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not load business details.'));
    }
  },
);

export const createCompanyThunk = createAsyncThunk(
  'companies/create',
  async (body, { rejectWithValue }) => {
    try {
      const created = await companiesRepo.create(body);
      return toBusinessRecord(created);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not create business.'));
    }
  },
);

export const updateCompanyThunk = createAsyncThunk(
  'companies/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      const updated = await companiesRepo.update(id, body);
      return toBusinessRecord(updated);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not update business.'));
    }
  },
);

export const changeCompanyPlanThunk = createAsyncThunk(
  'companies/changePlan',
  async ({ id, plan }, { rejectWithValue }) => {
    try {
      const updated = await companiesRepo.changePlan(id, plan);
      try {
        localStorage.setItem('activeBusinessPlan', plan);
      } catch {
        /* ignore storage errors */
      }
      return toBusinessRecord(updated);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not change the plan.'));
    }
  },
);

export const cancelCompanySubscriptionThunk = createAsyncThunk(
  'companies/cancelSubscription',
  async (id, { rejectWithValue }) => {
    try {
      const updated = await companiesRepo.cancelSubscription(id);
      return toBusinessRecord(updated);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not cancel subscription.'));
    }
  },
);

export const deleteCompanyThunk = createAsyncThunk(
  'companies/delete',
  async (id, { rejectWithValue }) => {
    try {
      await companiesRepo.remove(id);
      return String(id);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not delete business.'));
    }
  },
);

export const fetchCompanyHistoryThunk = createAsyncThunk(
  'companies/fetchHistory',
  async ({ companyId, limit = 20 }, { rejectWithValue }) => {
    try {
      const rows = await companiesRepo.getCompanyActivity(companyId, limit);
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not load change history.'));
    }
  },
);

const initialState = {
  items: [],
  myCompany: null,
  selected: null,
  selectedHistory: [],
  registrationResult: null,
  status: 'idle',
  myCompanyStatus: 'idle',
  historyStatus: 'idle',
  saving: false,
  error: null,
  myCompanyError: null,
};

function upsertCompany(items, record) {
  if (!record || !record.id) return items;
  const idx = items.findIndex((c) => c.id === record.id);
  if (idx === -1) return [...items, record];
  return items.map((c, i) => (i === idx ? record : c));
}

const companiesSlice = createSlice({
  name: 'companies',
  initialState,
  reducers: {
    clearCompaniesError(state) {
      state.error = null;
      state.myCompanyError = null;
    },
    clearCompanyHistory(state) {
      state.selectedHistory = [];
      state.historyStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerCompanyThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(registerCompanyThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.registrationResult = action.payload;
        if (action.payload && action.payload.company) {
          const record = toBusinessRecord(action.payload.company);
          state.myCompany = action.payload.company;
          state.items = upsertCompany(state.items, record);
        }
      })
      .addCase(registerCompanyThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Registration failed.';
      })
      .addCase(fetchCompaniesThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCompaniesThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchCompaniesThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Could not load businesses.';
      })
      .addCase(fetchMyCompanyProfileThunk.pending, (state) => {
        state.myCompanyStatus = 'loading';
        state.myCompanyError = null;
      })
      .addCase(fetchMyCompanyProfileThunk.fulfilled, (state, action) => {
        state.myCompanyStatus = 'succeeded';
        state.myCompany = action.payload;
      })
      .addCase(fetchMyCompanyProfileThunk.rejected, (state, action) => {
        state.myCompanyStatus = 'failed';
        state.myCompanyError = action.payload || 'Could not load business profile.';
      })
      .addCase(fetchCompanyByIdThunk.fulfilled, (state, action) => {
        state.selected = action.payload;
        state.items = upsertCompany(state.items, action.payload);
      })
      .addCase(createCompanyThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(createCompanyThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.items = upsertCompany(state.items, action.payload);
      })
      .addCase(createCompanyThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(updateCompanyThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateCompanyThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.items = upsertCompany(state.items, action.payload);
        if (state.myCompany && state.myCompany.id === action.payload.id) {
          state.myCompany = action.payload;
        }
      })
      .addCase(updateCompanyThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(changeCompanyPlanThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(changeCompanyPlanThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.items = upsertCompany(state.items, action.payload);
        if (state.myCompany && state.myCompany.id === action.payload.id) {
          state.myCompany = { ...state.myCompany, ...action.payload };
        }
      })
      .addCase(changeCompanyPlanThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(cancelCompanySubscriptionThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(cancelCompanySubscriptionThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.items = upsertCompany(state.items, action.payload);
        if (state.myCompany && state.myCompany.id === action.payload.id) {
          state.myCompany = { ...state.myCompany, ...action.payload };
        }
      })
      .addCase(cancelCompanySubscriptionThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(deleteCompanyThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(deleteCompanyThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.filter((c) => c.id !== action.payload);
        if (state.selected && state.selected.id === action.payload) {
          state.selected = null;
        }
      })
      .addCase(deleteCompanyThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })
      .addCase(fetchCompanyHistoryThunk.pending, (state) => {
        state.historyStatus = 'loading';
      })
      .addCase(fetchCompanyHistoryThunk.fulfilled, (state, action) => {
        state.historyStatus = 'succeeded';
        state.selectedHistory = action.payload;
      })
      .addCase(fetchCompanyHistoryThunk.rejected, (state) => {
        state.historyStatus = 'failed';
        state.selectedHistory = [];
      });
  },
});

export const { clearCompaniesError, clearCompanyHistory } = companiesSlice.actions;

export const selectCompaniesState = (state) => state.companies;
export const selectAllCompanies = (state) => state.companies.items;
export const selectMyCompany = (state) => state.companies.myCompany;
export const selectCompanyHistory = (state) => state.companies.selectedHistory;
export const selectCompanyById = createSelector(
  [selectAllCompanies, (_state, id) => id],
  (items, id) => (id ? items.find((c) => c.id === id) || null : null),
);

export default companiesSlice.reducer;
