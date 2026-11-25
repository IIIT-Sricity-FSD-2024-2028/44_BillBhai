import { useLocation, useNavigate } from 'react-router-dom';

export function homeFor(roleKey) {
  if (roleKey === 'superuser') return '/superuser';
  if (roleKey === 'cashier' || roleKey === 'customer') return '/cashier';
  return '/dashboard';
}

export default function PageHeader({ title, actions, backTo }) {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(backTo));
  return (
    <div className="page-header">
      {backTo && (
        <button type="button" className="btn btn-outline" onClick={goBack}>
          ← Back
        </button>
      )}
      <h2>{title}</h2>
      {actions !== undefined && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
