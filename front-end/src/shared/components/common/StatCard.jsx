export default function StatCard({ icon, label, value, color, valueStyle, valueId, children }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon si-${color}`}>{icon}</div>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value" id={valueId} style={valueStyle}>
          {value}
        </span>
        {children}
      </div>
    </div>
  );
}
