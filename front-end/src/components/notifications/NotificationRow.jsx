// One `.notification-row` of the notifications inbox (renderNotifications()).
import Badge from '../common/Badge.jsx';
import NotificationIcon from '../common/NotificationIcon.jsx';
import { getNotificationCategoryLabel, getNotificationPriorityBadgeProps } from '../../lib/dashboard/notifications.js';

export function NotificationPriorityBadge({ notification }) {
  const { text, type } = getNotificationPriorityBadgeProps(notification);
  return <Badge label={text} type={type} />;
}

export function notificationIconStyle(notification, extra) {
  const color = notification.color || 'blue';
  return { background: `var(--${color}-bg)`, color: `var(--${color})`, ...extra };
}

export default function NotificationRow({ notification, onToggleRead, onOpen }) {
  const item = notification;
  return (
    <div className={`notification-row ${item.unread ? 'unread' : ''}`} data-notif-id={item.id}>
      <div className="notification-icon" style={notificationIconStyle(item)}><NotificationIcon iconKey={item.iconKey} /></div>
      <div className="notification-content">
        <div className="notification-title-row">
          <strong>{item.title}</strong>
          <span className={`notification-chip ${item.unread ? 'is-unread' : 'is-read'}`}>{item.unread ? 'Unread' : 'Read'}</span>
          <NotificationPriorityBadge notification={item} />
          <span className="notification-chip">{getNotificationCategoryLabel(item.category)}</span>
        </div>
        <div className="text-sm text-muted" style={{ marginTop: '6px' }}>{item.desc}</div>
        <div className="notification-meta">
          <span>{item.time}</span>
          <span>{`${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} priority`}</span>
        </div>
      </div>
      <div className="notification-actions">
        <button className="btn btn-outline" data-notif-action="toggle-read" onClick={() => onToggleRead(item)}>{item.unread ? 'Mark read' : 'Mark unread'}</button>
        <button className="btn btn-outline" data-notif-action="open" onClick={() => onOpen(item.id)}>View</button>
      </div>
    </div>
  );
}
