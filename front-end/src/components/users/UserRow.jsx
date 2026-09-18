import Badge from '../common/Badge.jsx';
import { encodeUserToken } from '../../lib/dashboard/credentials.js';

const BTN_STYLE = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const DELETE_STYLE = { padding: '4px 8px', fontSize: '0.75rem', color: 'var(--red)', borderColor: 'var(--red)' };

/**
 * One row of #usersTableBodyDyn. Handlers receive the encoded user token
 * (encodeUserToken(name)), like the original onclick handlers.
 * Edit/Delete are not rendered without `users` access (enforceActionPermissions).
 */
export default function UserRow({ user, canManage, onView, onEdit, onDelete }) {
  const token = encodeUserToken(user.name);
  return (
    <tr>
      <td className="cell-main">{user.name}</td>
      <td>{user.email || ''}</td>
      <td>{user.normalizedRole}</td>
      <td><Badge status={user.normalizedStatus} /></td>
      <td>
        <button className="btn btn-outline" style={BTN_STYLE} onClick={() => onView(token)}>View</button>
        {canManage && <button className="btn btn-outline" style={BTN_STYLE} onClick={() => onEdit(token)}>Edit</button>}
        {canManage && <button className="btn btn-outline" style={DELETE_STYLE} onClick={() => onDelete(token)}>Delete</button>}
      </td>
    </tr>
  );
}
