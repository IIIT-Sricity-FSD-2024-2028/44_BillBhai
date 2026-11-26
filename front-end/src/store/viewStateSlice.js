import { createAction } from '@reduxjs/toolkit';

export const setViewValue = createAction('viewState/set');
export const clearViewValue = createAction('viewState/clear');

export default function viewStateReducer(state = {}, action) {
  if (action.type === setViewValue.type) {
    const { key, value } = action.payload;
    if (Object.prototype.hasOwnProperty.call(state, key) && Object.is(state[key], value)) return state;
    return { ...state, [key]: value };
  }
  if (action.type === clearViewValue.type) {
    if (!Object.prototype.hasOwnProperty.call(state, action.payload)) return state;
    const next = { ...state };
    delete next[action.payload];
    return next;
  }
  return state;
}

export const VIEW_STATE_MIDDLEWARE_OPTIONS = {
  serializableCheck: {
    ignoredPaths: [/^viewState/],
    ignoredActions: [setViewValue.type],
  },
  immutableCheck: {
    ignoredPaths: [/^viewState/],
  },
};
