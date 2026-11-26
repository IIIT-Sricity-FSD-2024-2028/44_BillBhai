import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { posRepo } from './posRepo.js';
import { fetchMyCompanyProfileThunk } from '../companies/companiesSlice.js';
import { errorText } from '../../shared/lib/http.js';
import {
  getCategories,
  searchCatalog,
  announceSale,
} from './lib/dataStore.js';
import {
  getCartSubtotal,
  getCartTotals,
  getCheckoutModeConfig,
  recomputeDiscount,
} from './lib/posHelpers.js';

export const EMPTY_CUSTOMER = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  walkIn: false,
};
export const EMPTY_ERRORS = {
  name: '',
  phone: '',
  email: '',
  address: '',
  deliveryPartnerPhone: '',
};
export const INACTIVE_DISCOUNT = { active: false, discount: 0 };

function syncItemsWithCatalog(items, catalog) {
  const byId = new Map((catalog || []).map((p) => [p.id, p]));
  const changes = [];
  const nextItems = items
    .map((line) => {
      const product = byId.get(line.id);
      if (!product) {
        changes.push(`${line.name}: no longer available, removed`);
        return null;
      }
      if (product.stock <= 0) {
        changes.push(`${line.name}: out of stock, removed (was ${line.qty})`);
        return null;
      }
      const nextQty = Math.min(line.qty, product.stock);
      if (nextQty < line.qty) {
        changes.push(`${line.name}: only ${product.stock} left now (was ${line.qty})`);
      }
      return {
        ...line,
        price: product.price,
        stock: product.stock,
        qty: nextQty,
      };
    })
    .filter((line) => line && line.qty > 0);
  return { items: nextItems, changes };
}

const POS_DRAFT_KEY = 'bb_pos_draft';

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(POS_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveDraft(state) {
  try {
    if (state.step >= 4) {
      sessionStorage.removeItem(POS_DRAFT_KEY);
      return;
    }
    sessionStorage.setItem(
      POS_DRAFT_KEY,
      JSON.stringify({
        step: state.step,
        items: state.items,
        customer: state.customer,
        checkoutMode: state.checkoutMode,
        paymentMethod: state.paymentMethod,
        paymentRef: state.paymentRef,
        promoCode: state.promoCode,
        promoAppliedCode: state.promoAppliedCode,
        discount: state.discount,
        deliveryCharge: state.deliveryCharge,
        partner: state.partner,
      }),
    );
  } catch {
    /* ignore storage errors */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(POS_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export const bootPosThunk = createAsyncThunk(
  'posCart/boot',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const [catalog] = await Promise.all([
        posRepo.fetchCatalog(),
        dispatch(fetchMyCompanyProfileThunk()),
      ]);
      return catalog;
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not load the product list.'));
    }
  },
);

export const reloadCatalogThunk = createAsyncThunk(
  'posCart/reloadCatalog',
  async (_, { rejectWithValue }) => {
    try {
      return await posRepo.fetchCatalog();
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not refresh catalog.'));
    }
  },
);

export const validatePromoThunk = createAsyncThunk(
  'posCart/validatePromo',
  async ({ code, subtotal, phone }, { rejectWithValue }) => {
    try {
      return await posRepo.validatePromotion({ code, subtotal, phone });
    } catch (err) {
      return rejectWithValue(errorText(err, 'This coupon cannot be used'));
    }
  },
);

export const quotePosOrderThunk = createAsyncThunk(
  'posCart/quoteOrder',
  async (payload, { rejectWithValue }) => {
    try {
      return await posRepo.quoteOrder(payload);
    } catch (err) {
      return rejectWithValue({
        message: errorText(err, 'Could not check the bill with the server.'),
        status: err && err.status ? err.status : 0,
      });
    }
  },
);

export const placePosOrderThunk = createAsyncThunk(
  'posCart/placeOrder',
  async ({ payload, tendered }, { dispatch, rejectWithValue }) => {
    try {
      const order = await posRepo.placeOrder(payload);
      announceSale(order.companyId);
      // Re-fetch authoritative stock from the server after DB commit
      dispatch(reloadCatalogThunk());
      return { order, tendered };
    } catch (err) {
      return rejectWithValue({
        message: errorText(err, 'Could not save this bill. Please try again.'),
        status: err && err.status ? err.status : 0,
      });
    }
  },
);

export const fetchMySalesTodayThunk = createAsyncThunk(
  'posCart/fetchMySalesToday',
  async (userId, { rejectWithValue }) => {
    try {
      return await posRepo.fetchMySalesToday(userId);
    } catch (err) {
      return rejectWithValue(errorText(err, 'Could not load today’s sales.'));
    }
  },
);

const draft = loadDraft();

const initialState = {
  booted: false,
  bootError: '',
  catalog: [],
  step: draft?.step && draft.step < 4 ? draft.step : 1,
  items: Array.isArray(draft?.items) ? draft.items : [],
  discount: draft?.discount || INACTIVE_DISCOUNT,
  customer: draft?.customer || EMPTY_CUSTOMER,
  errors: EMPTY_ERRORS,
  checkoutMode: draft?.checkoutMode || 'takeaway_now',
  paymentMethod: draft?.paymentMethod || 'Cash',
  paymentRef: draft?.paymentRef || '',
  amountTendered: '',
  deliveryCharge: draft?.deliveryCharge ?? '0',
  partner: draft?.partner || { name: '', phone: '' },
  modeError: '',
  notice: '',
  category: 'All',
  catClassesNormalized: false,
  searchQuery: '',
  promoCode: draft?.promoCode || '',
  promoAppliedCode: draft?.promoAppliedCode || '',
  promoError: '',
  quote: null,
  quoting: false,
  quoteError: '',
  checkoutBusy: false,
  completedOrder: null,
  completedTendered: undefined,
  mySales: [],
  mySalesLoading: false,
  mySalesError: '',
};

function recomputeStateDiscount(state) {
  state.discount = recomputeDiscount(state.discount, getCartSubtotal(state.items));
}

const posCartSlice = createSlice({
  name: 'posCart',
  initialState,
  reducers: {
    addToCart(state, action) {
      const product = action.payload;
      const existing = state.items.find((c) => c.cartId === product.id);
      if (existing) {
        existing.qty = Math.min(existing.stock, existing.qty + 1);
      } else if (product.stock > 0) {
        state.items.push({
          cartId: product.id,
          id: product.id,
          name: `${product.name}${product.size ? ` (${product.size})` : ''}`,
          price: product.price,
          qty: 1,
          stock: product.stock,
        });
      }
      state.notice = '';
      recomputeStateDiscount(state);
      saveDraft(state);
    },
    updateCartQty(state, action) {
      const { cartId, delta } = action.payload;
      const line = state.items.find((c) => c.cartId === cartId);
      if (!line) return;
      if (delta > 0 && line.qty >= line.stock) {
        state.notice = `Only ${line.stock} in stock.`;
      } else {
        state.notice = '';
      }
      state.items = state.items
        .map((c) =>
          c.cartId === cartId ? { ...c, qty: Math.min(c.stock, c.qty + delta) } : c,
        )
        .filter((c) => c.qty > 0);
      recomputeStateDiscount(state);
      saveDraft(state);
    },
    setCartExactQty(state, action) {
      const { cartId, qty } = action.payload;
      const line = state.items.find((c) => c.cartId === cartId);
      if (line && qty > line.stock) {
        state.notice = `Only ${line.stock} ${line.name} in stock; quantity set to ${line.stock}.`;
      } else {
        state.notice = '';
      }
      state.items = state.items.map((c) =>
        c.cartId === cartId
          ? { ...c, qty: Math.max(1, Math.min(c.stock, qty)) }
          : c,
      );
      recomputeStateDiscount(state);
      saveDraft(state);
    },
    removeFromCart(state, action) {
      const cartId = action.payload;
      state.items = state.items.filter((c) => c.cartId !== cartId);
      recomputeStateDiscount(state);
      saveDraft(state);
    },
    setStep(state, action) {
      state.step = action.payload;
      saveDraft(state);
    },
    setCustomerFields(state, action) {
      state.customer = { ...state.customer, ...action.payload };
      saveDraft(state);
    },
    setPaymentRef(state, action) {
      state.paymentRef = action.payload;
      saveDraft(state);
    },
    setWalkInCustomer(state) {
      state.customer = { ...EMPTY_CUSTOMER, name: 'Walk-in Customer', walkIn: true };
      state.errors = EMPTY_ERRORS;
      state.step = 2;
    },
    setErrors(state, action) {
      state.errors = action.payload;
    },
    clearFieldError(state, action) {
      const key = action.payload;
      if (state.errors[key]) state.errors[key] = '';
    },
    setCheckoutModeAction(state, action) {
      const { mode, isCustomerTerminal } = action.payload;
      const config = getCheckoutModeConfig(mode, isCustomerTerminal);
      state.checkoutMode = config.mode;
      if (!config.paymentMethods.includes(state.paymentMethod)) {
        state.paymentMethod = config.paymentMethods[0];
      }
      state.modeError = '';
      if (config.deliveryOption !== 'delivery' && state.errors.address) {
        state.errors.address = '';
      }
    },
    setPaymentMethod(state, action) {
      state.paymentMethod = action.payload;
    },
    setAmountTendered(state, action) {
      state.amountTendered = action.payload;
      state.modeError = '';
    },
    setDeliveryCharge(state, action) {
      state.deliveryCharge = action.payload;
      state.modeError = '';
    },
    setPartnerField(state, action) {
      const { field, value } = action.payload;
      state.partner[field] = value;
      if (state.errors.deliveryPartnerPhone) {
        state.errors.deliveryPartnerPhone = '';
      }
    },
    setModeError(state, action) {
      state.modeError = action.payload;
    },
    setNotice(state, action) {
      state.notice = action.payload;
    },
    setCategory(state, action) {
      state.category = action.payload;
      state.catClassesNormalized = true;
    },
    setSearchQuery(state, action) {
      state.searchQuery = action.payload;
    },
    setPromoCodeInput(state, action) {
      state.promoCode = action.payload;
      state.promoError = '';
    },
    setPromoError(state, action) {
      state.promoError = action.payload;
    },
    removePromo(state) {
      state.discount = INACTIVE_DISCOUNT;
      state.promoCode = '';
      state.promoError = '';
      state.promoAppliedCode = '';
    },
    clearQuoteError(state) {
      state.quoteError = '';
    },
    resetPosSession(state, action) {
      const isCustomerTerminal = Boolean(action.payload);
      state.step = 1;
      state.items = [];
      state.discount = INACTIVE_DISCOUNT;
      state.customer = EMPTY_CUSTOMER;
      state.errors = EMPTY_ERRORS;
      state.checkoutMode = 'takeaway_now';
      state.paymentMethod = isCustomerTerminal ? 'UPI' : 'Cash';
      state.paymentRef = '';
      state.amountTendered = '';
      state.deliveryCharge = '0';
      state.partner = { name: '', phone: '' };
      state.modeError = '';
      state.notice = '';
      state.category = 'All';
      state.searchQuery = '';
      state.promoCode = '';
      state.promoAppliedCode = '';
      state.promoError = '';
      state.quote = null;
      state.quoteError = '';
      state.completedOrder = null;
      state.completedTendered = undefined;
      clearDraft();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootPosThunk.pending, (state) => {
        state.bootError = '';
      })
      .addCase(bootPosThunk.fulfilled, (state, action) => {
        state.catalog = action.payload;
        state.booted = true;
        state.bootError = '';
      })
      .addCase(bootPosThunk.rejected, (state, action) => {
        state.bootError = action.payload || 'Could not load the product list.';
        state.booted = true;
      })
      .addCase(reloadCatalogThunk.fulfilled, (state, action) => {
        state.catalog = action.payload;
        const { items, changes } = syncItemsWithCatalog(state.items, action.payload);
        state.items = items;
        if (changes.length) {
          state.notice = changes.join(' · ');
          saveDraft(state);
        }
        recomputeStateDiscount(state);
      })
      .addCase(validatePromoThunk.fulfilled, (state, action) => {
        const res = action.payload;
        if (res && res.active) {
          state.discount = res;
          state.promoAppliedCode = res.code;
          state.promoError = '';
        } else {
          state.discount = INACTIVE_DISCOUNT;
          state.promoAppliedCode = '';
          state.promoError = (res && res.error) || 'This coupon cannot be used';
        }
      })
      .addCase(validatePromoThunk.rejected, (state, action) => {
        state.discount = INACTIVE_DISCOUNT;
        state.promoAppliedCode = '';
        state.promoError = action.payload || 'This coupon cannot be used';
      })
      .addCase(quotePosOrderThunk.pending, (state) => {
        state.quoting = true;
      })
      .addCase(quotePosOrderThunk.fulfilled, (state, action) => {
        state.quoting = false;
        state.quote = action.payload;
        state.quoteError = '';
      })
      .addCase(quotePosOrderThunk.rejected, (state, action) => {
        state.quoting = false;
        state.quote = null;
        state.quoteError =
          (action.payload && action.payload.message) ||
          'Could not check the bill with the server.';
      })
      .addCase(placePosOrderThunk.pending, (state) => {
        state.checkoutBusy = true;
        state.modeError = '';
      })
      .addCase(placePosOrderThunk.fulfilled, (state, action) => {
        state.checkoutBusy = false;
        state.completedOrder = action.payload.order;
        state.completedTendered = action.payload.tendered;
        state.step = 4;
      })
      .addCase(placePosOrderThunk.rejected, (state, action) => {
        state.checkoutBusy = false;
        state.modeError =
          (action.payload && action.payload.message) ||
          'Could not save this bill. Please try again.';
      })
      .addCase(fetchMySalesTodayThunk.pending, (state) => {
        state.mySalesLoading = true;
        state.mySalesError = '';
      })
      .addCase(fetchMySalesTodayThunk.fulfilled, (state, action) => {
        state.mySalesLoading = false;
        state.mySales = action.payload;
      })
      .addCase(fetchMySalesTodayThunk.rejected, (state, action) => {
        state.mySalesLoading = false;
        state.mySalesError = action.payload || 'Could not load today’s sales.';
      });
  },
});

export const {
  addToCart,
  updateCartQty,
  setCartExactQty,
  removeFromCart,
  setStep,
  setCustomerFields,
  setWalkInCustomer,
  setErrors,
  clearFieldError,
  setCheckoutModeAction,
  setPaymentMethod,
  setPaymentRef,
  setAmountTendered,
  setDeliveryCharge,
  setPartnerField,
  setModeError,
  setNotice,
  setCategory,
  setSearchQuery,
  setPromoCodeInput,
  setPromoError,
  removePromo,
  clearQuoteError,
  resetPosSession,
} = posCartSlice.actions;

export const selectPosState = (state) => state.posCart;
export const selectPosCatalog = (state) => state.posCart.catalog;
export const selectCartItems = (state) => state.posCart.items;
export const selectCartDiscount = (state) => state.posCart.discount;

export const selectCartSubtotal = createSelector([selectCartItems], (items) =>
  getCartSubtotal(items),
);

export const selectCartTotals = createSelector(
  [selectCartItems, selectCartDiscount],
  (items, discount) => getCartTotals(items, discount, 0),
);

export const selectCartQtyMap = createSelector([selectCartItems], (items) =>
  Object.fromEntries(items.map((c) => [c.id, c.qty])),
);

export const selectCatalogCategories = createSelector([selectPosCatalog], (catalog) =>
  getCategories(catalog),
);

export const selectFilteredCatalog = createSelector(
  [
    selectPosCatalog,
    (state) => state.posCart.searchQuery,
    (state) => state.posCart.category,
  ],
  (catalog, query, category) => searchCatalog(catalog, query, category),
);

export const selectMySalesList = (state) => state.posCart.mySales;

export const selectMySalesSummary = createSelector([selectMySalesList], (rows) => {
  const standing = rows.filter((o) => o.status !== 'Cancelled');
  const byMethod = {};
  standing.forEach((o) => {
    byMethod[o.paymentMethod] = (byMethod[o.paymentMethod] || 0) + o.total;
  });
  const uncollectedCod = standing
    .filter((o) => o.paymentMethod === 'COD' && o.paymentStatus === 'Pending')
    .reduce((s, o) => s + o.total, 0);
  const refunds = standing.reduce((s, o) => s + (o.refundedAmount || 0), 0);
  const cashRefunds = standing.reduce((s, o) => s + (o.cashRefundedToday || 0), 0);
  const net = standing.reduce((s, o) => s + o.total, 0) - refunds - uncollectedCod;
  const cashInDrawer =
    standing
      .filter((o) => o.paymentMethod === 'Cash')
      .reduce((s, o) => s + o.total, 0) - cashRefunds;
  return { standing, byMethod, refunds, net, cashInDrawer, uncollectedCod };
});

export default posCartSlice.reducer;
