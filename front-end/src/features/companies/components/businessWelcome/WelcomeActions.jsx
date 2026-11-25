import { Link } from 'react-router-dom';

export default function WelcomeActions() {
  return (
    <div className="actions">
      <Link className="btn primary" id="goDashboardBtn" to="/dashboard">
        Open Dashboard
      </Link>
      <Link className="btn" id="goUsersBtn" to="/users">
        Add your team
      </Link>
    </div>
  );
}
