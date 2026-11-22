let appStore = null;

export function injectStore(store) {
  appStore = store;
}

export function getAppStore() {
  return appStore;
}
