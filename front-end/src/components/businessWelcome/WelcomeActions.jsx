import { Link } from 'react-router-dom';

// "Go To Login" / "Open Dashboard". Both first store the new admin session.
export default function WelcomeActions({ onBeforeLeave }) {
  return (
    <div className="actions">
      <Link className="btn primary" id="goLoginBtn" to="/login" onClick={onBeforeLeave}>Go To Login</Link>
      <Link className="btn" id="goDashboardBtn" to="/dashboard" onClick={onBeforeLeave}>Open Dashboard</Link>
    </div>
  );
}
