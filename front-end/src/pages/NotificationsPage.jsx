import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import NotificationsList from '../components/notifications/NotificationsList.jsx';
import NotificationDetail from '../components/notifications/NotificationDetail.jsx';
import { useDashboard, useNotifications } from '../lib/dashboard/hooks.js';
import { resolveNotificationViewState } from '../lib/dashboard/notifications.js';

function NotificationsContent() {
  const { roleKey, getActiveNotifications, setNotificationReadState, markNotificationsRead } =
    useDashboard();
  const notifications = useNotifications();
  const [viewState, setViewState] = useState(() => resolveNotificationViewState());
  const [detailId, setDetailId] = useState(null);

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
        onToggleRead={() => setNotificationReadState(detail.id, detail.unread)}
      />
    );
  }

  return (
    <NotificationsList
      notifications={notifications}
      roleKey={roleKey}
      viewState={viewState}
      onViewStateChange={(next) => setViewState(resolveNotificationViewState(next))}
      onMarkAllRead={() =>
        markNotificationsRead(
          notifications.filter((item) => item.unread).map((item) => item.id),
          true,
        )
      }
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
