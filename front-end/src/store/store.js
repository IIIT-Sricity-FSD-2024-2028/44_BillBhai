import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice.js';
import deliveryReducer from './slices/deliverySlice.js';
import inventoryReducer from './slices/inventorySlice.js';

const store = configureStore({
  reducer: {
    ui: uiReducer,
    delivery: deliveryReducer,
    inventory: inventoryReducer,
  },
});

export default store;
