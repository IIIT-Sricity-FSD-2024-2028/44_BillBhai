import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice.js';
import deliveryReducer from './slices/deliverySlice.js';

const store = configureStore({
  reducer: {
    ui: uiReducer,
    delivery: deliveryReducer,
  },
});

export default store;
