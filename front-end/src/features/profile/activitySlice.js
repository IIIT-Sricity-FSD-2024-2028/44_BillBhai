import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { activityRepo } from './activityRepo.js';

const initialState = {
  items: [],
  status: 'idle',
  error: null,
};

export const fetchActivityThunk = createAsyncThunk(
  'activity/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      // TODO: return await activityRepo.getAll(query)
      return await activityRepo.getAll(query);
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load activity');
    }
  },
);

const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    clearActivityError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // TODO: .pending -> status = 'loading', error = null
        .addCase(fetchActivityThunk.pending, (state) => {
          state.status = 'loading';
          state.error = null;
        })
      // TODO: .fulfilled -> status = 'succeeded', items = Array.isArray(action.payload) ? action.payload : action.payload?.items || []
        .addCase(fetchActivityThunk.fulfilled, (state, action) => {
          state.status = 'succeeded';
          state.items = Array.isArray(action.payload) ? action.payload : action.payload?.items || [];
        })
      // TODO: .rejected -> status = 'failed', error = action.payload || 'Failed to load activity'
        .addCase(fetchActivityThunk.rejected, (state, action) => {
          state.status = 'failed';
          state.error = action.payload || 'Failed to load activity';
        })
      ;
  },
});

export const { clearActivityError } = activitySlice.actions;
export default activitySlice.reducer;