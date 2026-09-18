import Badge from '../common/Badge.jsx';

const EDIT_STYLE = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const EDIT_STYLE_ALONE = { padding: '4px 8px', fontSize: '0.75rem' };
const DELETE_STYLE = { padding: '4px 8px', fontSize: '0.75rem', color: 'var(--red)', borderColor: 'var(--red)' };

/**
 * One row of #ordersTableBodyDyn.
 *
 * Default: the row renderOrders()/renderTable() produced
 *   (`Rs 1,234`, badge()/statusBadge() of the normalised payment/status).
 * `saved`: the row handleNewOrder() wrote straight into the table after a
 *   create/edit (`₹1,234`, raw `b-<payment>` class, fixed status classes, and
 *   an Edit button without margin when Delete is not allowed).
 *
 * Buttons the role may not use are not rendered (enforceActionPermissions).
 */
export default function OrderRow({ order, saved = false, canEdit, canDelete, onEdit, onDelete }) {
  if (saved) {
    const statusClass = order.status === 'Delivered' ? 'b-delivered'
      : order.status === 'Processing' ? 'b-processing'
        : order.status === 'Pending' ? 'b-pending' : 'b-cancelled';
    return (
      <tr>
        <td className="cell-main">{order.id}</td>
        <td>{order.customer}</td>
        <td>{order.items}</td>
        <td>{`₹${order.total.toLocaleString()}`}</td>
        <td><span className={`badge b-${order.payment.toLowerCase()}`}>{order.payment}</span></td>
        <td><span className={`badge ${statusClass}`}>{order.status}</span></td>
        <td>{order.date}</td>
        <td>
          <button className="btn btn-outline" style={canDelete ? EDIT_STYLE : EDIT_STYLE_ALONE} onClick={() => onEdit(order.id)}>Edit</button>
          {canDelete && <button className="btn btn-outline" style={DELETE_STYLE} onClick={() => onDelete(order.id)}>Delete</button>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="cell-main">{order.id}</td>
      <td>{order.customer}</td>
      <td>{order.items}</td>
      <td>{`Rs ${Math.max(0, Number(order.total || 0)).toLocaleString()}`}</td>
      <td><Badge status={order.normalizedPayment} type={order.normalizedPayment.toLowerCase()} /></td>
      <td><Badge status={order.normalizedStatus} /></td>
      <td>{order.date}</td>
      <td>
        {canEdit && <button className="btn btn-outline" style={EDIT_STYLE} onClick={() => onEdit(order.id)}>Edit</button>}
        {canEdit && canDelete && <button className="btn btn-outline" style={DELETE_STYLE} onClick={() => onDelete(order.id)}>Delete</button>}
      </td>
    </tr>
  );
}
