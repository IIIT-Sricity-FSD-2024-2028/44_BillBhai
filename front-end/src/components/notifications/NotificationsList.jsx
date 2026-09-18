// List view of the notifications page: renderNotifications(filterState).
// Stateless - `viewState` ({ status, category, sort }) is owned by the page and
// the visible rows are derived here during render.
import PageHeader from '../common/PageHeader.jsx';
import { FilterSelect } from '../common/FilterToolbar.jsx';
import NotificationRow from './NotificationRow.jsx';
import { ROLE_LABELS } from '../../lib/dashboard/constants.js';
import { getNotificationCategoryLabel } from '../../lib/dashboard/notifications.js';

const SORT_OPTIONS = [
  { value: 'priority', label: 'Priority' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

function SummaryStat({ label, value }) {
  return <div className="stat-card"><div className="stat-info"><span className="stat-label">{label}</span><span className="stat-value">{value}</span></div></div>;
}

export function filterAndSortNotifications(notifications, viewState) {
  return notifications
    .filter((item) => {
      if (viewState.status === 'unread' && !item.unread) return false;
      if (viewState.status === 'read' && item.unread) return false;
      if (viewState.category !== 'all' && item.category !== viewState.category) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (viewState.sort === 'oldest') return (a.sortTimeMs || 0) - (b.sortTimeMs || 0);
      if (viewState.sort === 'newest') return (b.sortTimeMs || 0) - (a.sortTimeMs || 0);
      if (b.priorityRank !== a.priorityRank) return b.priorityRank - a.priorityRank;
      return (b.sortTimeMs || 0) - (a.sortTimeMs || 0);
    });
}

export default function NotificationsList({ notifications, roleKey, viewState, onViewStateChange, onMarkAllRead, onToggleRead, onOpen }) {
  const unreadCount = notifications.filter((item) => item.unread).length;
  const readCount = Math.max(0, notifications.length - unreadCount);
  const actionableCount = notifications.filter((item) => item.unread || item.priorityRank >= 3).length;
  const categoryOptions = Array.from(new Set(notifications.map((item) => item.category)))
    .sort((a, b) => getNotificationCategoryLabel(a).localeCompare(getNotificationCategoryLabel(b)));
  const rows = filterAndSortNotifications(notifications, viewState);

  const setView = (patch) => onViewStateChange({ ...viewState, ...patch });

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={<button className="btn btn-outline" id="markAllReadBtn" disabled={!unreadCount} onClick={onMarkAllRead}>Mark all as read</button>}
      />
      <section className="stats-grid" style={{ marginBottom: '12px' }}>
        <SummaryStat label="Total" value={notifications.length} />
        <SummaryStat label="Unread" value={unreadCount} />
        <SummaryStat label="Read" value={readCount} />
        <SummaryStat label="Actionable" value={actionableCount} />
      </section>
      <section className="card" style={{ marginBottom: '14px' }}>
        <div className="card-bd table-toolbar" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div className="chart-tabs">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                className={`chart-tab notif-filter ${viewState.status === filter.value ? 'active' : ''}`}
                data-filter={filter.value}
                onClick={() => setView({ status: filter.value })}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
            <div className="toolbar-group">
              <label className="toolbar-label" htmlFor="notificationsCategoryFilter">Category</label>
              <FilterSelect
                id="notificationsCategoryFilter"
                value={categoryOptions.includes(viewState.category) ? viewState.category : 'all'}
                onChange={(category) => setView({ category })}
                options={[{ value: 'all', label: 'All categories' }, ...categoryOptions.map((option) => ({ value: option, label: getNotificationCategoryLabel(option) }))]}
              />
            </div>
            <div className="toolbar-group">
              <label className="toolbar-label" htmlFor="notificationsSortSelect">Sort by</label>
              <FilterSelect
                id="notificationsSortSelect"
                value={SORT_OPTIONS.some((o) => o.value === viewState.sort) ? viewState.sort : 'priority'}
                onChange={(sort) => setView({ sort })}
                options={SORT_OPTIONS}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="card notification-shell" id="notificationCenter">
        <div className="card-hd"><h3>{`${ROLE_LABELS[roleKey] || 'Team'} inbox`}</h3></div>
        <div className="card-bd notification-list" style={{ padding: 0 }}>
          {rows.length
            ? rows.map((item) => <NotificationRow key={item.id} notification={item} onToggleRead={onToggleRead} onOpen={onOpen} />)
            : <div className="notification-empty text-muted">No notifications match this view.</div>}
        </div>
      </section>
    </>
  );
}
