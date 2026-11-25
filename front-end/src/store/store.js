import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice.js';
import deliveriesReducer from '../features/deliveries/deliveriesSlice.js';
import returnsReducer from '../features/returns/returnsSlice.js';
import deliveryReducer from '../features/deliveries/deliverySlice.js';
import productsReducer from '../features/inventory/productsSlice.js';
import inventoryReducer from '../features/inventory/inventorySlice.js';
import suppliersReducer from '../features/inventory/suppliersSlice.js';
import uploadsReducer from '../features/inventory/uploadsSlice.js';
import ordersReducer from '../features/orders/ordersSlice.js';
import authReducer from '../features/auth/authSlice.js';
import usersReducer from '../features/users/usersSlice.js';
import activityReducer from '../features/profile/activitySlice.js';
import companiesReducer from '../features/companies/companiesSlice.js';
import customersReducer from '../features/cashier/customersSlice.js';
import paymentsReducer from '../features/cashier/paymentsSlice.js';
import posCartReducer from '../features/cashier/posCartSlice.js';
import couponsReducer from '../features/coupons/couponsSlice.js';
import reportsReducer from '../features/reports/reportsSlice.js';

const store = configureStore({
  reducer: {
    ui: uiReducer,
    deliveries: deliveriesReducer,
    returns: returnsReducer,
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
    coupons: couponsReducer,
    reports: reportsReducer,
  },
});

export default store;
