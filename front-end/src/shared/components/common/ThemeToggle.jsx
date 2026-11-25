import { useDispatch, useSelector } from 'react-redux';
import { toggleTheme } from '../../../store/uiSlice.js';
import { selectCurrentTheme } from '../../../store/uiSlice.js';

const SunIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export default function ThemeToggle({ floating = false }) {
  const dispatch = useDispatch();
  const theme = useSelector(selectCurrentTheme);
  const isLight = theme === 'light';
  const label = isLight ? 'Switch to dark theme' : 'Switch to light theme';
  const handleToggle = () => dispatch(toggleTheme());

  return (
    <button
      type="button"
      className={floating ? 'theme-toggle theme-toggle-floating' : 'theme-toggle'}
      onClick={handleToggle}
      aria-label={label}
      title={label}
    >
      <span className={isLight ? 'theme-toggle-icon' : 'theme-toggle-icon is-active'}>
        {MoonIcon}
      </span>
      <span className={isLight ? 'theme-toggle-icon is-active' : 'theme-toggle-icon'}>
        {SunIcon}
      </span>
    </button>
  );
}
