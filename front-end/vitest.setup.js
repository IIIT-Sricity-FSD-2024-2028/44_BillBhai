function createStorageStub() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage?.getItem !== 'function') {
  const ls = createStorageStub();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: ls, configurable: true, writable: true });
  }
}

if (typeof globalThis.sessionStorage === 'undefined' || typeof globalThis.sessionStorage?.getItem !== 'function') {
  const ss = createStorageStub();
  Object.defineProperty(globalThis, 'sessionStorage', { value: ss, configurable: true, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'sessionStorage', { value: ss, configurable: true, writable: true });
  }
}
