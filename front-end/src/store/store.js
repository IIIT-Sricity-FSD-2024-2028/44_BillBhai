import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice.js';
import deliveryReducer from './slices/deliverySlice.js';
import productsReducer from './slices/productsSlice.js';
import inventoryReducer from './slices/inventorySlice.js';
import suppliersReducer from './slices/suppliersSlice.js';
import uploadsReducer from './slices/uploadsSlice.js';
import ordersReducer from './slices/ordersSlice.js';

const store = configureStore({
  reducer: {
    ui: uiReducer,
    delivery: deliveryReducer,
    products: productsReducer,
    inventory: inventoryReducer,
    suppliers: suppliersReducer,
    uploads: uploadsReducer,
    orders: ordersReducer,
  },
});

export default store;
