// React port of notifications.html: renderNotifications(filterState) and
// renderNotificationDetail(id, returnState) from dashboard.js.
import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import NotificationsList from '../components/notifications/NotificationsList.jsx';
import NotificationDetail from '../components/notifications/NotificationDetail.jsx';
import { useDashboard, useNotifications } from '../lib/dashboard/hooks.js';
import { resolveNotificationViewState } from '../lib/dashboard/notifications.js';

function NotificationsContent() {
  const { roleKey, getActiveNotifications, setNotificationReadState, markNotificationsRead } = useDashboard();
  const notifications = useNotifications();
  const [viewState, setViewState] = useState(() => resolveNotificationViewState());
  const [detailId, setDetailId] = useState(null);

  // renderNotificationDetail(): opening an unread notification marks it read.
  const openDetail = (id) => {
    const target = getActiveNotifications().find((item) => item.id === id);
    if (!target) return;
    if (target.unread) setNotificationReadState(target.id, true);
    setDetailId(id);
  };

  const detail = detailId ? notifications.find((item) => item.id === detailId) : null;

  if (detail) {
    return (
      <NotificationDetail
        notification={detail}
        onBack={() => setDetailId(null)}
        onToggleRead={() => {
          // Original: toggle, then re-run renderNotificationDetail(), which marks
          // the (now unread) notification read again - so "Mark unread" is a no-op.
          setNotificationReadState(detail.id, detail.unread);
          openDetail(detail.id);
        }}
      />
    );
  }

  return (
    <NotificationsList
      notifications={notifications}
      roleKey={roleKey}
      viewState={viewState}
      onViewStateChange={(next) => setViewState(resolveNotificationViewState(next))}
      onMarkAllRead={() => markNotificationsRead(notifications.filter((item) => item.unread).map((item) => item.id), true)}
      onToggleRead={(item) => setNotificationReadState(item.id, item.unread)}
      onOpen={openDetail}
    />
  );
}

export default function NotificationsPage() {
  return (
    <DashboardLayout page="notifications">
      <NotificationsContent />
    </DashboardLayout>
  );
}
