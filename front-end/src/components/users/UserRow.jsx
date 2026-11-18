import Badge from '../common/Badge.jsx';

const BTN_STYLE = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const DELETE_STYLE = { ...BTN_STYLE, color: 'var(--red)', borderColor: 'var(--red)' };

export default function UserRow({ user, canManage, isSelf, onView, onEdit, onDelete }) {
  return (
    <tr>
      <td className="cell-main">
        {user.name}
        {isSelf && <span className="text-sm text-muted"> (you)</span>}
      </td>
      <td>{user.username}</td>
      <td>{user.email || '—'}</td>
      <td>{user.phone || '—'}</td>
      <td>{user.role}</td>
      <td>
        <Badge status={user.status} type={user.status === 'Suspended' ? 'cancelled' : 'active'} />
      </td>
      <td>
        <button className="btn btn-outline" style={BTN_STYLE} onClick={() => onView(user)}>
          View
        </button>
        {canManage && (
          <button className="btn btn-outline" style={BTN_STYLE} onClick={() => onEdit(user)}>
            Edit
          </button>
        )}
        {canManage && !isSelf && (
          <button className="btn btn-outline" style={DELETE_STYLE} onClick={() => onDelete(user)}>
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}
