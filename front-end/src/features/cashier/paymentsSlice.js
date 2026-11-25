import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { paymentsRepo } from './paymentsRepo.js';
import { errorText } from '../../shared/lib/http.js';

export const createRazorpayOrderThunk = createAsyncThunk(
  'payments/createRazorpayOrder',
  async (body, { rejectWithValue }) => {
    try {
      return await paymentsRepo.createRazorpayOrder(body);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not create payment order.'));
    }
  },
);

export const verifyRazorpayPaymentThunk = createAsyncThunk(
  'payments/verifyRazorpayPayment',
  async (body, { rejectWithValue }) => {
    try {
      return await paymentsRepo.verifyRazorpayPayment(body);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Payment verification failed.'));
    }
  },
);

export const createSubscriptionOrderThunk = createAsyncThunk(
  'payments/createSubscriptionOrder',
  async (body, { rejectWithValue }) => {
    try {
      return await paymentsRepo.createSubscriptionOrder(body);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not create subscription order.'));
    }
  },
);

export const verifySubscriptionPaymentThunk = createAsyncThunk(
  'payments/verifySubscriptionPayment',
  async (body, { rejectWithValue }) => {
    try {
      return await paymentsRepo.verifySubscriptionPayment(body);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Subscription verification failed.'));
    }
  },
);

const initialState = {
  razorpayOrder: null,
  verificationResult: null,
  subscriptionOrder: null,
  subscriptionVerification: null,
  status: 'idle',
  error: null,
};

const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    resetPaymentState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createRazorpayOrderThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createRazorpayOrderThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.razorpayOrder = action.payload;
      })
      .addCase(createRazorpayOrderThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(verifyRazorpayPaymentThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(verifyRazorpayPaymentThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.verificationResult = action.payload;
      })
      .addCase(verifyRazorpayPaymentThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(createSubscriptionOrderThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createSubscriptionOrderThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.subscriptionOrder = action.payload;
      })
      .addCase(createSubscriptionOrderThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(verifySubscriptionPaymentThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(verifySubscriptionPaymentThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.subscriptionVerification = action.payload;
      })
      .addCase(verifySubscriptionPaymentThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { resetPaymentState } = paymentsSlice.actions;

export const selectPaymentsState = (state) => state.payments;

export default paymentsSlice.reducer;
