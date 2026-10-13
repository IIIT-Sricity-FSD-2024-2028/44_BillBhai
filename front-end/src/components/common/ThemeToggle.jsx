import useTheme from '../../hooks/useTheme.js';

const SunIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/**
 * Sun / moon button that switches between the dark and light theme.
 *
 * Props
 *  floating   pin it to the top-right corner (pages without a header)
 */
export default function ThemeToggle({ floating = false }) {
  const { isLight, toggleTheme } = useTheme();
  const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';

  return (
    <button
      type="button"
      className={floating ? 'theme-toggle theme-toggle-floating' : 'theme-toggle'}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <span className={isLight ? 'theme-toggle-icon' : 'theme-toggle-icon is-active'}>{MoonIcon}</span>
      <span className={isLight ? 'theme-toggle-icon is-active' : 'theme-toggle-icon'}>{SunIcon}</span>
    </button>
  );
}
