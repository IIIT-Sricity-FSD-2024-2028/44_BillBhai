// Avatar / name / role / email card at the top of the left column
// (renderProfileSettingsUnified in dashboard.js).
const AVATAR_STYLE = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg,var(--accent),var(--amber))',
  margin: '0 auto 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.9rem',
  color: '#fff',
  fontWeight: 700,
};

export default function ProfileIdentityCard({ fullName, roleLabel, email }) {
  return (
    <div className="card">
      <div className="card-bd" style={{ textAlign: 'center', paddingTop: '26px' }}>
        <div style={AVATAR_STYLE}>{fullName.charAt(0).toUpperCase()}</div>
        <h3 style={{ fontSize: '1.12rem', marginBottom: '4px' }}>{fullName}</h3>
        <p className="text-muted" style={{ marginBottom: '4px' }}>{roleLabel}</p>
        <p className="text-sm text-muted">{email}</p>
      </div>
    </div>
  );
}
