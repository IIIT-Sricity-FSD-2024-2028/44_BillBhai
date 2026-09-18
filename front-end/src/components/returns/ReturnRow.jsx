// One `#returnsTableBody` row (renderReturnsRefined() -> renderTable() / actionsFor()).
import Badge from '../common/Badge.jsx';
import { classifyReturnStatus } from './returnStats.js';

const BTN_BASE = { padding: '4px 8px', fontSize: '0.75rem' };
const BTN_REFUND = { ...BTN_BASE, marginRight: '4px' };
const BTN_REJECT = { ...BTN_BASE, color: 'var(--red)', borderColor: 'var(--red)' };

function ActionButton({ style, onClick, children }) {
  return <button className="btn btn-outline" data-action="returns" style={style} onClick={onClick}>{children}</button>;
}

/** `canManage` false = the original hid every [data-action=returns] button. */
export default function ReturnRow({ item, canManage, onEdit, onRefund, onReject }) {
  const kind = classifyReturnStatus(item.status);
  let actions = null;
  if (canManage) {
    actions = kind === 'pending'
      ? (
        <>
          <ActionButton style={BTN_REFUND} onClick={() => onRefund(item.id)}>Refund</ActionButton>
          <ActionButton style={BTN_REJECT} onClick={() => onReject(item.id)}>Reject</ActionButton>
        </>
      )
      : <ActionButton style={BTN_BASE} onClick={() => onEdit(item.id)}>Edit</ActionButton>;
  }
  return (
    <tr>
      <td className="cell-main">{item.id}</td>
      <td>{item.oid}</td>
      <td>{item.customer}</td>
      <td>{item.product}</td>
      <td>{item.qty === null ? '—' : item.qty}</td>
      <td>{item.reason}</td>
      <td>₹{Number(item.amount || 0).toLocaleString()}</td>
      <td><Badge status={item.status} /></td>
      <td>{item.requestedBy}</td>
      <td>{item.updatedAt}</td>
      <td>{actions}</td>
    </tr>
  );
}
