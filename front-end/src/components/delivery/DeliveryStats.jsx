import StatCard from '../common/StatCard.jsx';

// Stat cards used by the Delivery page and the Delivery Ops dashboard.
export const DELIVERY_ICONS = {
  truck: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>,
  check: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>,
  clock: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  alert: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>,
};

/** "Active Deliveries" card: a StatCard with the "Pending X • In Transit Y" line under the value. */
export function ActiveDeliveriesCard({ counts }) {
  return (
    <StatCard icon={DELIVERY_ICONS.truck} label="Active Deliveries" value={counts.pending + counts.inTransit} color="blue">
      <div className="text-sm text-muted" style={{ marginTop: '6px' }}>{`Pending ${counts.pending} • In Transit ${counts.inTransit}`}</div>
    </StatCard>
  );
}

