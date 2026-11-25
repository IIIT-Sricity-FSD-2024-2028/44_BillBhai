import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { usersRepo } from '../../repositories/usersRepo.js';

const initialState = {
  items: [],
  me: null,
  selected: null,
  status: 'idle',
  saving: false,
  passwordStatus: 'idle',
  error: null,
};

export const fetchUsersThunk = createAsyncThunk(
  'users/fetchAll',
  async (query, { rejectWithValue }) => {
    try {
      return await usersRepo.getAll(query);
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load users');
    }
  },
);

export const fetchUserByIdThunk = createAsyncThunk(
  'users/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      // TODO: call usersRepo.getById(id)
      return await usersRepo.getById(id);
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load user');
    }
  },
);

export const fetchMeThunk = createAsyncThunk(
  'users/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      // TODO: call usersRepo.getMe()
      return await usersRepo.getMe();
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load profile');
    }
  },
);

export const createUserThunk = createAsyncThunk(
  'users/create',
  async (body, { rejectWithValue }) => {
    try {
      // TODO: call usersRepo.create(body)
      return await usersRepo.create(body);
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to create user');
    }
  },
);

export const updateUserThunk = createAsyncThunk(
  'users/update',
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await usersRepo.update(id, body);
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to update user');
    }
  },
);

export const resetUserPasswordThunk = createAsyncThunk(
  'users/resetPassword',
  async (id, { rejectWithValue }) => {
    try {
      // TODO: call usersRepo.resetPassword(id)
      return await usersRepo.resetPassword(id);
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to reset password');
    }
  },
);

export const changeOwnPasswordThunk = createAsyncThunk(
  'users/changeOwnPassword',
  async (body, { rejectWithValue }) => {
    try {
      // TODO: call usersRepo.changeOwnPassword(body)
      return await usersRepo.changeOwnPassword(body);
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to change password');
    }
  },
);

export const deleteUserThunk = createAsyncThunk(
  'users/delete',
  async (id, { rejectWithValue }) => {
    try {
      await usersRepo.remove(id);
      return id;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to delete user');
    }
  },
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearUsersError(state) {
      state.error = null;
    },
    resetPasswordStatus(state) {
      state.passwordStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      // --- Read: fetchUsersThunk ---
      .addCase(fetchUsersThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUsersThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = Array.isArray(action.payload) ? action.payload : action.payload?.items || [];
      })
      .addCase(fetchUsersThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load users';
      })

      // --- Read: fetchUserByIdThunk ---
      .addCase(fetchUserByIdThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUserByIdThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.selected = action.payload;
      })
      .addCase(fetchUserByIdThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load user';
      })

      // --- Read: fetchMeThunk ---
      .addCase(fetchMeThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      // TODO: add .addCase(fetchMeThunk.fulfilled, (state, action) => { ... })
      //   Hint: set state.status = 'succeeded' and state.me = action.payload
      .addCase(fetchMeThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.me = action.payload;
      })

      .addCase(fetchMeThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load profile';
      })

      // --- Create: createUserThunk ---
      .addCase(createUserThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      // TODO: add .addCase(createUserThunk.fulfilled, (state, action) => { ... })
      //   Hint: set state.saving = false, and push the server-returned user
      //   (const created = action.payload?.user || action.payload) into state.items

      .addCase(createUserThunk.fulfilled, (state, action) => {
        state.saving = false;
        const created = action.payload?.user || action.payload;
        if (created) {
          state.items.push(created);
        }
      })

      .addCase(createUserThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to create user';
      })

      // --- Update: updateUserThunk ---
      .addCase(updateUserThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateUserThunk.fulfilled, (state, action) => {
        state.saving = false;
        const updated = action.payload;
        const idx = state.items.findIndex((u) => String(u.id) === String(updated?.id));
        if (idx !== -1) state.items[idx] = updated;
        if (state.selected && String(state.selected.id) === String(updated?.id)) {
          state.selected = updated;
        }
        if (state.me && String(state.me.id) === String(updated?.id)) {
          state.me = updated;
        }
      })
      .addCase(updateUserThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to update user';
      })

      // --- Update: resetUserPasswordThunk ---
      .addCase(resetUserPasswordThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(resetUserPasswordThunk.fulfilled, (state, action) => {
        state.saving = false;
        const updated = action.payload?.user || action.payload;
        if (updated?.id) {
          const idx = state.items.findIndex((u) => String(u.id) === String(updated.id));
          if (idx !== -1) state.items[idx] = { ...state.items[idx], ...updated };
        }
      })
      .addCase(resetUserPasswordThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to reset password';
      })

      // --- Update: changeOwnPasswordThunk ---
      .addCase(changeOwnPasswordThunk.pending, (state) => {
        state.passwordStatus = 'loading';
        state.error = null;
      })
      .addCase(changeOwnPasswordThunk.fulfilled, (state) => {
        state.passwordStatus = 'succeeded';
      })
      .addCase(changeOwnPasswordThunk.rejected, (state, action) => {
        state.passwordStatus = 'failed';
        state.error = action.payload || 'Failed to change password';
      })

      // --- Delete: deleteUserThunk ---
      .addCase(deleteUserThunk.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      // TODO: add .addCase(deleteUserThunk.fulfilled, (state, action) => { ... })
      //   Hint: set state.saving = false, and filter state.items to keep u where String(u.id) !== String(action.payload)

      .addCase(deleteUserThunk.fulfilled, (state, action) => {
        state.saving = false;
        state.items = state.items.filter((u) => String(u.id) !== String(action.payload));
      })    

      .addCase(deleteUserThunk.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || 'Failed to delete user';
      });
  },
});

export const { clearUsersError, resetPasswordStatus } = usersSlice.actions;
export default usersSlice.reducer;