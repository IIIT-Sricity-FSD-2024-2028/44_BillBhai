import { Link } from 'react-router-dom';
import useTheme from '../../hooks/useTheme.js';
import { NavIcons, NavIconsNotificationsPage } from './icons.jsx';

const PRO_PILL_STYLE = {
  fontSize: '0.62rem',
  background: 'rgba(220,53,69,0.15)',
  color: '#ff6b6b',
  padding: '1px 5px',
  borderRadius: '4px',
  marginLeft: '4px',
  fontWeight: 700,
};

const MAIN_ITEMS = [
  { page: 'dashboard', label: 'Dashboard' },
  { page: 'cashier', label: 'POS Terminal' },
  { page: 'orders', label: 'Orders & Billing' },
  { page: 'inventory', label: 'Inventory' },
  { page: 'delivery', label: 'Delivery' },
];
const MANAGEMENT_ITEMS = [
  { page: 'returns', label: 'Returns & Refunds' },
  { page: 'reports', label: 'Reports' },
  { page: 'users', label: 'Users' },
  { page: 'superuser', label: 'Super User Portal' },
];
const MANAGEMENT_PAGES = ['returns', 'reports', 'users', 'superuser'];

export default function Sidebar({
  page,
  allowedPages = [],
  proPills = {},
  collapsed,
  mobileOpen,
  onNavClick,
  onLogout,
  legacyIcons,
}) {
  const { logo } = useTheme();
  const icons = legacyIcons ? NavIconsNotificationsPage : NavIcons;
  const cls = ['sidebar', collapsed ? 'collapsed' : '', mobileOpen ? 'mobile-open' : '']
    .filter(Boolean)
    .join(' ');
  const hasManagement = MANAGEMENT_PAGES.some((p) => allowedPages.includes(p));

  const renderItem = ({ page: itemPage, label }) => {
    const allowed = allowedPages.includes(itemPage);
    const pill =
      (itemPage === 'delivery' && proPills.delivery) ||
      (itemPage === 'returns' && proPills.returns);
    return (
      <Link
        key={itemPage}
        to={`/${itemPage}`}
        className={allowed && itemPage === page ? 'nav-item active' : 'nav-item'}
        data-page={itemPage}
        hidden={!allowed}
        onClick={onNavClick}
      >
        {icons[itemPage]}
        <span>
          {pill ? (
            <>
              {`${label} `}
              <span style={PRO_PILL_STYLE}>PRO</span>
            </>
          ) : (
            label
          )}
        </span>
      </Link>
    );
  };

  return (
    <aside className={cls} id="sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="BillBhai" className="sidebar-brand-img" />
      </div>
      <nav className="sidebar-nav" id="sidebarNav">
        <div className="nav-section-label">Main</div>
        {MAIN_ITEMS.map(renderItem)}
        <div className="nav-section-label" style={hasManagement ? undefined : { display: 'none' }}>
          Management
        </div>
        {MANAGEMENT_ITEMS.map(renderItem)}
      </nav>
      <div className="sidebar-footer">
        <Link to="/login" className="nav-item nav-logout" onClick={onLogout}>
          {icons.logout}
          <span>Logout</span>
        </Link>
      </div>
    </aside>
  );
}
