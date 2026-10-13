/**
 * Summary card used by every page's `.stats-grid`:
 *   <div class="stat-card"><div class="stat-icon si-{color}">{icon}</div>
 *   <div class="stat-info"><span class="stat-label">{label}</span><span class="stat-value">{value}</span></div></div>
 *
 *   <StatCard icon={<svg .../>} label="Revenue" value={`₹${total.toLocaleString()}`} color="green" />
 *
 * `children` (optional) render after .stat-value, e.g. a "Pending 2 • In Transit 1" line.
 * `valueStyle` / `valueId` (optional) are the inline style and id of .stat-value.
 */
export default function StatCard({ icon, label, value, color, valueStyle, valueId, children }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon si-${color}`}>{icon}</div>
      <div className="stat-info"><span className="stat-label">{label}</span><span className="stat-value" id={valueId} style={valueStyle}>{value}</span>{children}</div>
    </div>
  );
}
