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
  const safeName = String(fullName || 'User').trim() || 'User';
  return (
    <div className="card">
      <div className="card-bd" style={{ textAlign: 'center', paddingTop: '26px' }}>
        <div style={AVATAR_STYLE}>{safeName.charAt(0).toUpperCase()}</div>
        <h3 style={{ fontSize: '1.12rem', marginBottom: '4px' }}>{safeName}</h3>
        <p className="text-muted" style={{ marginBottom: '4px' }}>
          {roleLabel}
        </p>
        <p className="text-sm text-muted">{email}</p>
      </div>
    </div>
  );
}
