// renderUserProfile(token) of dashboard.js ("User Details" view of the users page).
import Badge from '../common/Badge.jsx';
import { encodeUserToken, getUserLoginHandle } from '../../lib/dashboard/credentials.js';

const AVATAR_STYLE = {
  width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--blue), var(--amber))',
  margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff', fontWeight: 700,
};
const CENTER = { justifyContent: 'center' };

const ACTIVITY = {
  Delivery: [
    ['Today, 11:30', <>Delivered Order <strong>#ORD-4819</strong></>],
    ['Today, 09:15', 'Out for delivery with 4 orders'],
    ['Yesterday, 17:00', 'Finished shift'],
  ],
  Sales: [
    ['Today, 14:02', <>Created Order <strong>#ORD-4821</strong> for ₹1250</>],
    ['Yesterday, 16:45', <>Processed Return <strong>#RET-201</strong></>],
    ['Yesterday, 10:30', 'Logged in'],
  ],
  default: [
    ['Today, 10:12', <>Updated inventory stock for <strong>SKU-05</strong></>],
    ['14 Feb, 09:00', 'System login'],
  ],
};

/**
 * Props: user, onBack (the back arrow followed the sidebar "Users" link),
 * onChangeRole / onPasswordReset / onToggleSuspension / onDelete (token handlers).
 */
export default function UserProfile({ user, onBack, onChangeRole, onPasswordReset, onToggleSuspension, onDelete }) {
  const initial = user.name.charAt(0).toUpperCase();
  const email = String(user.email || `${user.name.toLowerCase().replace(/\s+/g, '.')}@billbhai.com`).trim();
  const loginHandle = getUserLoginHandle(user);
  const userToken = encodeUserToken(user.name);
  const normalizedStatus = String(user.status || '').toLowerCase();
  const activity = ACTIVITY[user.role === 'Delivery' || user.role === 'Sales' ? user.role : 'default'];

  return (
    <>
      <div className="page-header" style={{ justifyContent: 'flex-start', gap: '16px' }}>
        <button className="btn btn-outline" style={{ padding: '8px' }} onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </button>
        <h2>User Details</h2>
      </div>
      <section className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-bd" style={{ textAlign: 'center', paddingTop: '30px' }}>
              <div style={AVATAR_STYLE}>{initial}</div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{user.name}</h3>
              <p className="text-muted" style={{ marginBottom: '8px' }}>{`${user.role} • ${email}`}</p>
              <p className="text-sm text-muted" style={{ marginBottom: '8px' }}>{`Login: ${loginHandle}`}</p>
              <div style={{ marginBottom: '20px' }}><Badge status={user.status} /></div>
            </div>
          </div>
          <div className="card">
            <div className="card-hd"><h3 style={{ color: 'var(--red)' }}>Admin Actions</h3></div>
            <div className="card-bd" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-outline" style={CENTER} onClick={() => onChangeRole(userToken)}>Change User Role</button>
              <button className="btn btn-outline" style={CENTER} onClick={() => onPasswordReset(userToken)}>Send Password Reset</button>
              <button
                className="btn"
                style={{ justifyContent: 'center', background: 'rgba(220, 53, 69, 0.1)', color: 'var(--red)', border: '1px solid rgba(220, 53, 69, 0.3)' }}
                onClick={() => onToggleSuspension(userToken)}
              >
                {normalizedStatus === 'suspended' ? 'Activate Account' : 'Suspend Account'}
              </button>
              <button
                className="btn"
                style={{ justifyContent: 'center', background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)' }}
                onClick={() => onDelete(userToken)}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><h3>Recent Activity</h3></div>
          <div className="card-bd">
            <div className="timeline">
              {activity.map(([time, text]) => (
                <div className="timeline-item" key={time}>
                  <div className="timeline-marker" />
                  <div className="timeline-time">{time}</div>
                  <div className="timeline-content">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
