let appStore = null;
let onUnauthorizedHandler = null;

/** Registers the Redux store instance for non-React modules without circular imports. */
export function injectStore(store) {
  appStore = store;
}

/** Returns the injected Redux store instance, or null before bootstrap. */
export function getAppStore() {
  return appStore;
}

/** Registers a session-reset callback invoked on HTTP 401 responses. */
export function registerUnauthorizedHandler(handler) {
  onUnauthorizedHandler = typeof handler === 'function' ? handler : null;
}

/** Invokes the registered unauthorized handler cleanly. */
export function notifyUnauthorized() {
  if (onUnauthorizedHandler) {
    onUnauthorizedHandler();
  }
}
