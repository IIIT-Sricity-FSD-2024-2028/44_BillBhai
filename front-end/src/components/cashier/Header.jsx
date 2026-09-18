import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOGO } from '../../lib/pageAssets.js';
import { clearStoredSession } from '../../lib/cashier/posHelpers.js';

// cashier.html <header class="top-header">. Before app.js finishes booting the
// header shows the static HTML copy (`session` is null), exactly like the page.
export default function Header({ session, planBadge }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Inline script: any document click closes the profile dropdown.
  useEffect(() => {
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const isCustomerTerminal = Boolean(session && session.isCustomerTerminal);
  const safeUserName = session ? (String(session.userName || 'Cashier').trim() || 'Cashier') : '';
  const displayName = session ? (isCustomerTerminal ? 'Self Checkout' : safeUserName) : 'Cashier';
  const displayAvatar = session ? (isCustomerTerminal ? 'S' : safeUserName.charAt(0).toUpperCase()) : 'C';
  const roleText = session ? session.businessName : 'Online';
  const appLabel = session && session.businessName ? session.businessName : 'Terminal 1';
  const pageLabel = session && isCustomerTerminal ? 'Self Checkout' : 'Active Customer';
  let dropdownSubtitle = 'Counter Terminal 1';
  if (session) {
    dropdownSubtitle = isCustomerTerminal
      ? `${session.businessName} self-checkout lane`
      : `${session.roleLabel} terminal`;
  }

  return (
    <header className="top-header">
      <div className="header-left">
        <Link to="/" className="header-logo-link">
          <img src={LOGO} alt="BillBhai" className="header-logo-img" />
        </Link>
        <div className="breadcrumb">
          <span className="bc-app">{appLabel}</span>
          <span className="bc-sep">/</span>
          <span className="bc-page" id="bcPage">{pageLabel}</span>
        </div>
      </div>
      <div className="header-right">
        {planBadge && (
          <div
            id="cashierPlanBadge"
            className={planBadge.className}
            style={{ cursor: 'pointer', marginRight: '12px', padding: '5px 12px' }}
          >
            <span>{planBadge.planName}</span>
          </div>
        )}
        {/* Profile dropdown */}
        <div className="dropdown-container" id="userContainer">
          <div
            className="header-user"
            id="userMenuBtn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <div className="user-avatar">{displayAvatar}</div>
            <div className="user-info">
              <span className="user-name">{displayName}</span>
              <span className="user-role">{roleText}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px', color: 'var(--text-muted)' }}><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          <div className={`dropdown-menu${menuOpen ? ' show' : ''}`} id="userDropdown">
            <div className="dropdown-header">
              <strong id="terminalDropdownTitle">{displayName}</strong>
              <div className="text-sm text-muted" id="terminalDropdownSubtitle">{dropdownSubtitle}</div>
            </div>

            <Link to="/login" className="dropdown-item text-danger" onClick={session ? clearStoredSession : undefined}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Logout
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
