import Badge from '../../../shared/components/common/Badge.jsx';
import { rupees, statusColour } from './orderFormat.js';

const BTN = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const DANGER = { ...BTN, color: 'var(--red)', borderColor: 'var(--red)' };
const SUB = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' };

/** Whether the Orders page offers "Cancel" (the server has the final say). */
export function canCancelOrder(order) {
  if (order.status === 'Cancelled' || order.status === 'Returned' || order.status === 'Partially Returned') return false;
  if (order.orderType === 'delivery') return order.status === 'Processing';
  return true;
}

export default function OrderRow({ order, canEdit, isManager, onViewBill, onEdit, onCancel, onDelete }) {
  const cancelled = order.status === 'Cancelled';
  return (
    <tr style={cancelled ? { opacity: 0.65 } : undefined}>
      <td className="cell-main">
        {order.id}
        {order.billNo && <span style={SUB}>{order.billNo}</span>}
      </td>
      <td>
        {order.customer}
        {order.customerPhone && <span style={SUB}>{order.customerPhone}</span>}
      </td>
      <td>{order.orderType === 'delivery' ? 'Delivery' : 'Counter'}</td>
      <td>{order.items}</td>
      <td className="nowrap">
        {rupees(order.total)}
        {order.promoCode && <span style={SUB}>{order.promoCode} −{rupees(order.discount)}</span>}
        {order.refunded > 0 && <span style={{ ...SUB, color: 'var(--red)' }}>Refunded {rupees(order.refunded)}</span>}
      </td>
      <td>
        <Badge status={order.payment} type={statusColour(order.payment)} />
        {order.paymentStatus && order.paymentStatus !== 'Paid' && (
          <span style={SUB}>{order.paymentStatus}</span>
        )}
      </td>
      <td>
        <Badge status={order.status} type={statusColour(order.status)} />
        {order.deliveryNote && <span style={{ ...SUB, color: 'var(--amber)' }}>{order.deliveryNote}</span>}
      </td>
      <td className="nowrap">
        {order.date}
        {order.staffName && <span style={SUB}>by {order.staffName}</span>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="btn btn-outline" style={BTN} onClick={() => onViewBill(order.id)}>
          Bill
        </button>
        {canEdit && !cancelled && (
          <button className="btn btn-outline" style={BTN} onClick={() => onEdit(order.id)}>
            Edit
          </button>
        )}
        {isManager && canCancelOrder(order) && (
          <button className="btn btn-outline" style={DANGER} onClick={() => onCancel(order.id)}>
            Cancel
          </button>
        )}
        {isManager && cancelled && (
          <button className="btn btn-outline" style={DANGER} onClick={() => onDelete(order.id)}>
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}
