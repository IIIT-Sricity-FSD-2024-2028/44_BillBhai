import { Link } from 'react-router-dom';

export default function WelcomeActions({ onBeforeLeave }) {
  return (
    <div className="actions">
      <Link className="btn primary" id="goLoginBtn" to="/login" onClick={onBeforeLeave}>
        Go To Login
      </Link>
      <Link className="btn" id="goDashboardBtn" to="/dashboard" onClick={onBeforeLeave}>
        Open Dashboard
      </Link>
    </div>
  );
}
