import { useLocation, useNavigate } from 'react-router-dom';

export function homeFor(roleKey) {
  if (roleKey === 'superuser') return '/superuser';
  if (roleKey === 'cashier' || roleKey === 'customer') return '/cashier';
  return '/dashboard';
}

function BackButton({ to }) {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(to));
  return (
    <button type="button" className="btn btn-outline" onClick={goBack}>
      ← Back
    </button>
  );
}

export default function PageHeader({ title, actions, backTo }) {
  return (
    <div className="page-header">
      {backTo && <BackButton to={backTo} />}
      <h2>{title}</h2>
      {actions !== undefined && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
