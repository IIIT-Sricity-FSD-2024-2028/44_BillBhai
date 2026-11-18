import { useEffect, useState } from 'react';
import Badge from '../common/Badge.jsx';
import { api } from '../../lib/http.js';

const AVATAR_STYLE = {
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, var(--blue), var(--amber))',
  margin: '0 auto 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '2rem',
  color: '#fff',
  fontWeight: 700,
};
const CENTER = { justifyContent: 'center' };

function when(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * One staff account: details, admin actions, and its real history (what was
 * changed on the account, from the activity log).
 */
export default function UserProfile({ user, canManage, isSelf, onBack, onEdit, onPasswordReset, onToggleSuspension, onDelete }) {
  const [history, setHistory] = useState({ loading: true, rows: [] });

  useEffect(() => {
    let alive = true;
    api('/activity', { query: { entity: 'user', entityId: user.id, limit: 30 } })
      .then((rows) => alive && setHistory({ loading: false, rows: Array.isArray(rows) ? rows : [] }))
      .catch(() => alive && setHistory({ loading: false, rows: [] }));
    return () => {
      alive = false;
    };
  }, [user.id, user.version]);

  const suspended = String(user.status).toLowerCase() === 'suspended';

  return (
    <>
      <div className="page-header" style={{ justifyContent: 'flex-start', gap: '16px' }}>
        <button className="btn btn-outline" style={{ padding: '8px' }} onClick={onBack} aria-label="Back to users">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h2>User Details</h2>
      </div>
      <section className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-bd" style={{ textAlign: 'center', paddingTop: '30px' }}>
              <div style={AVATAR_STYLE}>{user.name.charAt(0).toUpperCase()}</div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{user.name}</h3>
              <p className="text-muted" style={{ marginBottom: '8px' }}>
                {user.role} • {user.email || 'no email'}
              </p>
              <p className="text-sm text-muted" style={{ marginBottom: '4px' }}>
                Sign-in name: <strong>{user.username}</strong>
              </p>
              <p className="text-sm text-muted" style={{ marginBottom: '8px' }}>
                Mobile: {user.phone || '—'} · Last changed {when(user.updatedAt)}
                {user.updatedBy ? ` by ${user.updatedBy}` : ''}
              </p>
              <div style={{ marginBottom: '20px' }}>
                <Badge status={user.status} type={suspended ? 'cancelled' : 'active'} />
              </div>
            </div>
          </div>
          {canManage && (
            <div className="card">
              <div className="card-hd">
                <h3>Admin Actions</h3>
              </div>
              <div className="card-bd" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="btn btn-outline" style={CENTER} onClick={() => onEdit(user)}>
                  Edit details or role
                </button>
                <button className="btn btn-outline" style={CENTER} onClick={() => onPasswordReset(user)}>
                  Reset password
                </button>
                {!isSelf && (
                  <button
                    className="btn"
                    style={{ justifyContent: 'center', background: 'rgba(220, 53, 69, 0.1)', color: 'var(--red)', border: '1px solid rgba(220, 53, 69, 0.3)' }}
                    onClick={() => onToggleSuspension(user)}
                  >
                    {suspended ? 'Activate account' : 'Suspend account'}
                  </button>
                )}
                {!isSelf && (
                  <button
                    className="btn"
                    style={{ justifyContent: 'center', background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}
                    onClick={() => onDelete(user)}
                  >
                    Delete user
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-hd">
            <h3>Account History</h3>
          </div>
          <div className="card-bd">
            {history.loading && <p className="text-muted">Loading…</p>}
            {!history.loading && !history.rows.length && <p className="text-muted">No changes recorded for this account yet.</p>}
            <div className="timeline">
              {history.rows.map((h) => (
                <div className="timeline-item" key={h.id}>
                  <div className="timeline-marker" />
                  <div className="timeline-time">{when(h.at)}</div>
                  <div className="timeline-content">
                    <strong>{h.by}</strong>: {h.summary}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
