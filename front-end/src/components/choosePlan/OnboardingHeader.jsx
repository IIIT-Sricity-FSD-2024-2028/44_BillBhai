import { Link } from 'react-router-dom';
import useTheme from '../../hooks/useTheme.js';
import ThemeToggle from '../common/ThemeToggle.jsx';

export default function OnboardingHeader() {
  const { logo } = useTheme();
  return (
    <header className="top-header">
      <div className="header-left">
        <Link to="/" className="header-logo-link">
          <img src={logo} alt="BillBhai" className="header-logo-img" />
        </Link>
        <div className="breadcrumb">
          <span className="bc-app">BillBhai Onboarding</span>
          <span className="bc-sep">/</span>
          <span className="bc-page">Subscription Plan</span>
        </div>
      </div>
      <div className="header-right">
        <ThemeToggle />
        <span
          className="badge b-active"
          style={{ padding: '5px 12px', fontSize: '0.76rem', borderRadius: '999px' }}
        >
          Step 2 of 2
        </span>
      </div>
    </header>
  );
}
