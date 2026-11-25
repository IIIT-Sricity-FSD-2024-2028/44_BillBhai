import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice.js';
import deliveryReducer from './slices/deliverySlice.js';
import productsReducer from './slices/productsSlice.js';
import inventoryReducer from './slices/inventorySlice.js';
import suppliersReducer from './slices/suppliersSlice.js';
import uploadsReducer from './slices/uploadsSlice.js';
import ordersReducer from './slices/ordersSlice.js';
import authReducer from './slices/authSlice.js';
import usersReducer from './slices/usersSlice.js';
import activityReducer from './slices/activitySlice.js';
import companiesReducer from './slices/companiesSlice.js';
import customersReducer from './slices/customersSlice.js';
import paymentsReducer from './slices/paymentsSlice.js';
import posCartReducer from './slices/posCartSlice.js';

const store = configureStore({
  reducer: {
    ui: uiReducer,
    delivery: deliveryReducer,
    products: productsReducer,
    inventory: inventoryReducer,
    suppliers: suppliersReducer,
    uploads: uploadsReducer,
    orders: ordersReducer,
    auth: authReducer,
    users: usersReducer,
    activity: activityReducer,
    companies: companiesReducer,
    customers: customersReducer,
    payments: paymentsReducer,
    posCart: posCartReducer,
  },
});

export default store;
