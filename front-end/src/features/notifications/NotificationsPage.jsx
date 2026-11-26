import useViewState from '../../shared/hooks/useViewState.js';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectReduxNotifications,
  markNotificationRead as reduxMarkNotificationRead,
  markAllNotificationsRead as reduxMarkAllNotificationsRead,
} from '../../store/uiSlice.js';
import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import NotificationsList from './components/NotificationsList.jsx';
import NotificationDetail from './components/NotificationDetail.jsx';
import { useDashboard, useNotifications } from '../../shared/lib/dashboard/hooks.js';
import { resolveNotificationViewState } from '../../shared/lib/dashboard/notifications.js';

function NotificationsContent() {
  const dispatch = useDispatch();
  const reduxNotifs = useSelector(selectReduxNotifications);
  const hookNotifs = useNotifications();
  const notifications = reduxNotifs && reduxNotifs.length ? reduxNotifs : hookNotifs;
  const { roleKey, getActiveNotifications, setNotificationReadState, markNotificationsRead } =
    useDashboard();
  const [viewState, setViewState] = useViewState(() => resolveNotificationViewState());
  const [detailId, setDetailId] = useViewState(null);

  const openDetail = (id) => {
    const target = notifications.find((item) => item.id === id) || getActiveNotifications().find((item) => item.id === id);
    if (!target) return;
    if (target.unread) {
      dispatch(reduxMarkNotificationRead(target.id));
      setNotificationReadState(target.id, true);
    }
    setDetailId(id);
  };

  const detail = detailId ? notifications.find((item) => item.id === detailId) : null;

  if (detail) {
    return (
      <NotificationDetail
        notification={detail}
        onBack={() => setDetailId(null)}
        onToggleRead={() => {
          dispatch(reduxMarkNotificationRead(detail.id));
          setNotificationReadState(detail.id, detail.unread);
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
      onMarkAllRead={() => {
        const unreadIds = notifications.filter((item) => item.unread).map((item) => item.id);
        dispatch(reduxMarkAllNotificationsRead(unreadIds));
        markNotificationsRead(unreadIds, true);
      }}
      onToggleRead={(item) => {
        dispatch(reduxMarkNotificationRead(item.id));
        setNotificationReadState(item.id, item.unread);
      }}
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
