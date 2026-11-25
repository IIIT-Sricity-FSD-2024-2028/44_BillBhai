import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authRepo } from "./authRepo.js";
import { storeLoginSession, clearStoredSession } from "../../shared/lib/http.js";
import { registerCompanyThunk } from "../companies/companiesSlice.js";

const readStorage = (key) => {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const initialState = {
  user: null,
  token: readStorage("bb_auth_token") || null,
  roleKey: readStorage("userRole") || "",
  activeBusinessId: readStorage("activeBusinessId") || "",
  activeBusinessName: readStorage("activeBusinessName") || "",
  isAuthenticated: Boolean(readStorage("bb_auth_token")),
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

export const loginThunk = createAsyncThunk(
  "auth/login",
  async ({ username, password }, { rejectWithValue }) => {
    try {
      return await authRepo.login({ username, password });
    } catch (error) {
      return rejectWithValue({
        message: error?.message || "Sign-in failed. Please try again.",
        status: error?.status,
      });
    }
  },
);

export const fetchAuthProfileThunk = createAsyncThunk(
  "auth/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      // TODO: call authRepo.getProfile() and return the result
      return await authRepo.getProfile();
    } catch (error) {
      // TODO: return rejectWithValue(...) with error?.message || 'Failed to load profile'
      return rejectWithValue(error?.message || "Failed to load profile");
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logoutAction(state) {
      clearStoredSession();
      state.user = null;
      state.token = null;
      state.roleKey = "";
      state.activeBusinessId = "";
      state.activeBusinessName = "";
      state.isAuthenticated = false;
      state.status = "idle";
      state.error = null;
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        const session = action.payload;
        storeLoginSession(session);
        const role = String(session.role || "").toLowerCase();
        state.user = session;
        state.token = session.accessToken || null;
        state.roleKey = role;
        state.activeBusinessId =
          role === "superuser" ? "" : session.companyId || "";
        state.activeBusinessName =
          role === "superuser" ? "" : session.businessName || "";
        state.isAuthenticated = true;
        state.status = "succeeded";
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error =
          action.payload?.message || "Sign-in failed. Please try again.";
      })
      .addCase(fetchAuthProfileThunk.fulfilled, (state, action) => {
        state.user = action.payload;
        state.roleKey = String(
          action.payload?.role || state.roleKey || "",
        ).toLowerCase();
        state.status = "succeeded";
      })
      .addCase(fetchAuthProfileThunk.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Failed to load profile";
      })
      .addCase(registerCompanyThunk.fulfilled, (state, action) => {
        const session = action.payload?.session;
        if (!session) return;
        const role = String(session.role || "").toLowerCase();
        state.user = session;
        state.token = session.accessToken || null;
        state.roleKey = role;
        state.activeBusinessId =
          role === "superuser" ? "" : session.companyId || "";
        state.activeBusinessName =
          role === "superuser" ? "" : session.businessName || "";
        state.isAuthenticated = true;
        state.status = "succeeded";
        state.error = null;
      });
  },
});

export const { logoutAction, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
