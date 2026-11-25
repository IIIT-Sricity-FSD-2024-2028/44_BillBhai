import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { uploadsRepo } from './uploadsRepo.js';
import { toThunkError } from '../../store/thunkUtils.js';

const sameId = (a, b) => String(a) === String(b);

const createInitialState = () => ({
  items: [],
  lastImportSummary: null,
  lastUploaded: null,
  selected: null,
  status: 'idle',
  uploading: false,
  error: null,
  requestIds: {
    fetchAll: null,
    fetchOne: null,
  },
});

const initialState = createInitialState();

export const fetchUploadsThunk = createAsyncThunk(
  'uploads/fetchAll',
  async (kind, { rejectWithValue }) => {
    try {
      return await uploadsRepo.getAll(kind);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch uploads'));
    }
  },
);

export const fetchUploadByIdThunk = createAsyncThunk(
  'uploads/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      return await uploadsRepo.getById(id);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to fetch upload'));
    }
  },
);

export const uploadImageThunk = createAsyncThunk(
  'uploads/uploadImage',
  async (file, { rejectWithValue }) => {
    try {
      return await uploadsRepo.uploadImage(file);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Image upload failed'));
    }
  },
);

export const importProductsCsvThunk = createAsyncThunk(
  'uploads/importCsv',
  async (arg, { rejectWithValue }) => {
    try {
      const file = arg && typeof arg === 'object' && 'file' in arg ? arg.file : arg;
      const companyId = arg && typeof arg === 'object' && 'companyId' in arg ? arg.companyId : undefined;
      return await uploadsRepo.importProductsCsv(file, companyId);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'CSV import failed'));
    }
  },
);

export const attachProductImageThunk = createAsyncThunk(
  'uploads/attachProductImage',
  async ({ productId, file }, { rejectWithValue }) => {
    try {
      return await uploadsRepo.attachProductImage(productId, file);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to attach product image'));
    }
  },
);

export const deleteUploadThunk = createAsyncThunk(
  'uploads/delete',
  async (id, { rejectWithValue }) => {
    try {
      await uploadsRepo.remove(id);
      return id;
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Failed to delete upload'));
    }
  },
);

const uploadsSlice = createSlice({
  name: 'uploads',
  initialState,
  reducers: {
    clearUploadsError(state) {
      state.error = null;
    },
    clearLastImportSummary(state) {
      state.lastImportSummary = null;
    },
    resetUploads() {
      return createInitialState();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUploadsThunk.pending, (state, action) => {
        state.requestIds.fetchAll = action.meta.requestId;
        if (state.status !== 'succeeded') state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUploadsThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchAll) return;
        state.requestIds.fetchAll = null;
        state.status = 'succeeded';
        state.items = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchUploadsThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchAll) return;
        state.requestIds.fetchAll = null;
        state.status = 'failed';
        state.error = action.payload?.message || 'Failed to fetch uploads';
      })

      .addCase(fetchUploadByIdThunk.pending, (state, action) => {
        state.requestIds.fetchOne = action.meta.requestId;
      })
      .addCase(fetchUploadByIdThunk.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
        state.selected = action.payload;
      })
      .addCase(fetchUploadByIdThunk.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestIds.fetchOne) return;
        state.requestIds.fetchOne = null;
      })

      .addCase(uploadImageThunk.pending, (state) => {
        state.uploading = true;
        state.error = null;
      })
      .addCase(uploadImageThunk.fulfilled, (state, action) => {
        state.uploading = false;
        state.requestIds.fetchAll = null;
        if (action.payload) {
          state.lastUploaded = action.payload;
          state.items.unshift(action.payload);
        }
      })
      .addCase(uploadImageThunk.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.payload?.message || 'Image upload failed';
      })

      .addCase(importProductsCsvThunk.pending, (state) => {
        state.uploading = true;
        state.error = null;
      })
      .addCase(importProductsCsvThunk.fulfilled, (state, action) => {
        state.uploading = false;
        state.requestIds.fetchAll = null;
        state.lastImportSummary = action.payload || null;
        if (action.payload?.file) {
          state.lastUploaded = action.payload.file;
          state.items.unshift(action.payload.file);
        }
      })
      .addCase(importProductsCsvThunk.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.payload?.message || 'CSV import failed';
      })

      .addCase(attachProductImageThunk.pending, (state) => {
        state.uploading = true;
        state.error = null;
      })
      .addCase(attachProductImageThunk.fulfilled, (state, action) => {
        state.uploading = false;
        state.requestIds.fetchAll = null;
        if (action.payload?.upload) {
          state.lastUploaded = action.payload.upload;
          state.items.unshift(action.payload.upload);
        }
      })
      .addCase(attachProductImageThunk.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.payload?.message || 'Failed to attach product image';
      })

      .addCase(deleteUploadThunk.pending, (state) => {
        state.uploading = true;
      })
      .addCase(deleteUploadThunk.fulfilled, (state, action) => {
        state.uploading = false;
        state.requestIds.fetchAll = null;
        state.items = state.items.filter((u) => !sameId(u.id, action.payload));
        if (state.selected && sameId(state.selected.id, action.payload)) {
          state.selected = null;
        }
      })
      .addCase(deleteUploadThunk.rejected, (state) => {
        state.uploading = false;
      });
  },
});

export const { clearUploadsError, clearLastImportSummary, resetUploads } = uploadsSlice.actions;

export const selectAllUploads = (state) => state.uploads.items;
export const selectLastImportSummary = (state) => state.uploads.lastImportSummary;
export const selectLastUploaded = (state) => state.uploads.lastUploaded;
export const selectSelectedUpload = (state) => state.uploads.selected;
export const selectUploadsStatus = (state) => state.uploads.status;
export const selectUploadsUploading = (state) => state.uploads.uploading;
export const selectUploadsError = (state) => state.uploads.error;

export const selectImageUploads = createSelector([selectAllUploads], (items) =>
  items.filter((u) => u.kind === 'image'),
);

export const selectImportUploads = createSelector([selectAllUploads], (items) =>
  items.filter((u) => u.kind === 'import'),
);

export default uploadsSlice.reducer;
