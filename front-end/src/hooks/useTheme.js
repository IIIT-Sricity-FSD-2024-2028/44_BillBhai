import { useSyncExternalStore } from 'react';
import { getTheme, subscribeTheme, toggleTheme } from '../lib/theme.js';
import { LOGO, LOGO_ALT } from '../lib/pageAssets.js';

/**
 * Current theme plus a toggle. Every component using it re-renders when the
 * theme changes anywhere on the page.
 *
 *   const { theme, isLight, toggleTheme, logo } = useTheme();
 *
 * `logo` is the BillBhai logo that reads on the current background
 * (white lettering on dark, black lettering on light).
 */
export default function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const isLight = theme === 'light';
  return { theme, isLight, toggleTheme, logo: isLight ? LOGO_ALT : LOGO };
}
