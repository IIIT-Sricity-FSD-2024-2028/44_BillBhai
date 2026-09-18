import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon, LogoutMenuIcon, MenuToggleIcon, ProfileMenuIcon } from './icons.jsx';
import NotificationIcon from './NotificationIcon.jsx';

/**
 * <header class="top-header"> of the dashboard pages.
 *
 * Props
 *  title           #bcPage text (page label)
 *  businessName    breadcrumb `.bc-app` becomes "BillBhai / {businessName}" when set
 *  planBadge       null, or { label, className, title, onClick } -> #headerPlanBadge (first in .header-right)
 *  notifications   active notification list (unread flag, color, iconKey, title, time)
 *  user            { name, avatar, roleLabel, email }
 *  page            current page (the profile link gets `active` on /profile)
 *  onMenuToggle    menu button click
 *  onNavClick      click on the Profile & Settings link (closes the mobile sidebar)
 *  onLogout        click on the Logout link
 *  legacyMenu      notifications.html's simplified user menu (no icons, no nav-item class)
 *
 * The notification / user dropdowns keep their own open state: clicking a trigger
 * toggles it and closes the other one, any other click on the page closes both.
 */
export default function TopHeader({ title, businessName, planBadge, notifications = [], user = {}, page, onMenuToggle, onNavClick, onLogout, legacyMenu }) {
  const [openMenu, setOpenMenu] = useState(null); // 'notif' | 'user' | null

  useEffect(() => {
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const toggle = (menu) => (e) => {
    e.stopPropagation();
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const unreadCount = notifications.filter((item) => item.unread).length;
  const previewItems = notifications.slice(0, 3);

  return (
    <header className="top-header">
      <div className="header-left">
        <button className="menu-toggle" id="menuToggle" aria-label="Toggle menu" onClick={onMenuToggle}>
          {MenuToggleIcon}
        </button>
        <div className="breadcrumb">
          <span className="bc-app">{businessName ? `BillBhai / ${businessName}` : 'BillBhai'}</span>
          <span className="bc-sep">/</span>
          <span className="bc-page" id="bcPage">{title}</span>
        </div>
      </div>
      <div className="header-right">
        {planBadge && (
          <div
            id="headerPlanBadge"
            className={planBadge.className}
            style={{ cursor: 'pointer', marginRight: '12px', padding: '5px 12px' }}
            title={planBadge.title}
            onClick={planBadge.onClick}
          >
            <span>{planBadge.label}</span>
          </div>
        )}
        <div className="dropdown-container" id="notifContainer">
          <button className="icon-btn notif-btn" id="notifBtn" aria-label="Notifications" onClick={toggle('notif')}>
            {BellIcon}
            <span className="notif-dot" style={unreadCount ? undefined : { display: 'none' }} />
          </button>
          <div className={openMenu === 'notif' ? 'dropdown-menu show' : 'dropdown-menu'} id="notifDropdown" style={{ width: '260px' }}>
            <div className="dropdown-header">
              <strong>Notifications</strong>
              <div className="text-sm text-muted">{unreadCount ? `You have ${unreadCount} new notifications` : 'All caught up'}</div>
            </div>
            {previewItems.length ? previewItems.map((item) => (
              <div className="dropdown-item" style={{ alignItems: 'flex-start', cursor: 'default' }} key={item.id}>
                <div style={{ background: `var(--${item.color || 'blue'}-bg)`, color: `var(--${item.color || 'blue'})`, padding: '6px', borderRadius: '6px', marginRight: '4px' }}>
                  <NotificationIcon iconKey={item.iconKey} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{item.title}</div>
                  <div className="text-sm text-muted">{item.time}</div>
                </div>
              </div>
            )) : <div className="dropdown-item text-muted" style={{ cursor: 'default' }}>No notifications for this role right now.</div>}
            <div className="dropdown-divider" />
            <Link to="/notifications" className="dropdown-item nav-item" data-page="notifications" style={{ justifyContent: 'center', fontWeight: 500, color: 'var(--accent)' }}>View all notifications</Link>
          </div>
        </div>

        <div className="dropdown-container" id="userContainer">
          <div className="header-user" id="userMenuBtn" onClick={toggle('user')}>
            <div className="user-avatar">{user.avatar}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.roleLabel}</span>
            </div>
          </div>
          <div className={openMenu === 'user' ? 'dropdown-menu show' : 'dropdown-menu'} id="userDropdown">
            <div className="dropdown-header">
              <strong>{user.name}</strong>
              <div className="text-sm text-muted">{user.email}</div>
            </div>
            {legacyMenu ? (
              <Link to="/profile" className="dropdown-item">Profile &amp; Settings</Link>
            ) : (
              <Link to="/profile" className={page === 'profile' ? 'dropdown-item nav-item active' : 'dropdown-item nav-item'} data-page="profile" onClick={onNavClick}>
                {ProfileMenuIcon}
                {' Profile & Settings'}
              </Link>
            )}
            <div className="dropdown-divider" />
            {legacyMenu ? (
              <Link to="/login" className="dropdown-item text-danger" onClick={onLogout}>Logout</Link>
            ) : (
              <Link to="/login" className="dropdown-item text-danger" onClick={onLogout}>
                {LogoutMenuIcon}
                {' Logout'}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
