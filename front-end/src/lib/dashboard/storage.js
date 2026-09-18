// localStorage helpers (dashboard.js: loadList / loadObject / saveList / saveObject).

export function loadList(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    return fallback;
  }
}

export function loadObject(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    return fallback;
  }
}

export function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

export function saveObject(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
