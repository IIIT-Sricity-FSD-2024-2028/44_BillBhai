import StatCard from '../../../shared/components/common/StatCard.jsx';

// Stat cards used by the Delivery page and the Delivery Ops dashboard.
export const DELIVERY_ICONS = {
  truck: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  check: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  clock: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  alert: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  ),
};

/** The headline numbers of the delivery desk, all from live deliveries. */
export function DeliveryStatCards({ counts, money }) {
  return (
    <section className="stats-grid">
      <StatCard icon={DELIVERY_ICONS.clock} label="Needs partner" value={counts.pending} color="amber">
        <span className="text-sm text-muted">{counts.ready} assigned, waiting to dispatch</span>
      </StatCard>
      <StatCard icon={DELIVERY_ICONS.truck} label="On the road" value={counts.road} color="blue">
        <span className="text-sm" style={counts.overdue ? { color: 'var(--red)' } : undefined}>
          {counts.overdue ? `${counts.overdue} running late` : 'None running late'}
        </span>
      </StatCard>
      <StatCard icon={DELIVERY_ICONS.check} label="Delivered today" value={counts.deliveredToday} color="green" />
      <StatCard icon={DELIVERY_ICONS.alert} label="COD cash still out" value={money(counts.codPending)} color="red">
        <span className="text-sm text-muted">{counts.failed} failed attempt(s) to handle</span>
      </StatCard>
    </section>
  );
}
