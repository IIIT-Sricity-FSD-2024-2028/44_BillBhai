import { useSyncExternalStore } from 'react';
import { getTheme, subscribeTheme, toggleTheme } from '../lib/theme.js';
import { LOGO, LOGO_ALT } from '../lib/pageAssets.js';

export default function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const isLight = theme === 'light';
  return { theme, isLight, toggleTheme, logo: isLight ? LOGO_ALT : LOGO };
}
