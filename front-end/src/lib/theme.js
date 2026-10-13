export const THEME_STORAGE_KEY = 'billbhai-theme';
const THEMES = ['dark', 'light'];

const listeners = new Set();

function readSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(saved) ? saved : 'dark';
  } catch {
    return 'dark';
  }
}

let current = document.documentElement.dataset.theme || readSavedTheme();

function apply(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

apply(current);

export function getTheme() {
  return current;
}

export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTheme(theme) {
  if (!THEMES.includes(theme) || theme === current) return;
  current = theme;
  // Colours cross-fade for a moment instead of snapping.
  const root = document.documentElement;
  root.classList.add('theme-switching');
  apply(theme);
  window.setTimeout(() => root.classList.remove('theme-switching'), 300);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode: the theme still applies for this visit.
  }
  listeners.forEach((listener) => listener(theme));
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark');
}
