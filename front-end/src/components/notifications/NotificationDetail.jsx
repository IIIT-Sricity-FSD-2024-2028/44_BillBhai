// Detail view of the notifications page: renderNotificationDetail(id, returnState).
import NotificationIcon from '../common/NotificationIcon.jsx';
import { NotificationPriorityBadge, notificationIconStyle } from './NotificationRow.jsx';
import { getNotificationCategoryLabel } from '../../lib/dashboard/notifications.js';

export default function NotificationDetail({ notification, onBack, onToggleRead }) {
  const detailRows = Array.isArray(notification.detailRows) ? notification.detailRows : [];
  return (
    <>
      <div className="page-header" style={{ justifyContent: 'flex-start', gap: '10px' }}>
        <button className="btn btn-outline" id="notifBackBtn" style={{ padding: '8px' }} onClick={onBack}>Back</button>
        <h2>Notification Details</h2>
        <div className="page-header-actions" style={{ marginLeft: 'auto' }}><button className="btn btn-outline" id="notifToggleBtn" onClick={onToggleRead}>{notification.unread ? 'Mark read' : 'Mark unread'}</button></div>
      </div>
      <section className="card" style={{ marginBottom: '14px' }}>
        <div className="card-bd" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div className="notification-icon" style={notificationIconStyle(notification, { minWidth: '50px', minHeight: '50px' })}><NotificationIcon iconKey={notification.iconKey} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="notification-title-row" style={{ marginBottom: '6px' }}>
              <h3 style={{ margin: 0 }}>{notification.title}</h3>
              <NotificationPriorityBadge notification={notification} />
              <span className="notification-chip">{getNotificationCategoryLabel(notification.category)}</span>
            </div>
            <div className="text-sm text-muted" style={{ marginBottom: '10px' }}>{notification.time}</div>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{notification.desc}</p>
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-hd"><h3>Context</h3></div>
        <div className="card-bd"><div className="notification-detail-grid">
          {detailRows.length
            ? detailRows.map((row, index) => <div className="notification-detail-item" key={index}><span className="text-sm text-muted">{row.label}</span><strong>{row.value}</strong></div>)
            : <div className="text-muted">No structured details are attached to this notification.</div>}
        </div></div>
      </section>
    </>
  );
}
