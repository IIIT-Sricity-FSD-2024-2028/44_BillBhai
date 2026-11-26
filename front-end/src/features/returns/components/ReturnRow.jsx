import Badge from '../../../shared/components/common/Badge.jsx';
import { RETURN_NEXT, returnAge, returnBadgeType, returnRaisedAt, rupees } from './returnStats.js';

const BTN = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px', marginBottom: '2px' };
const BTN_RED = { ...BTN, color: 'var(--red)', borderColor: 'var(--red)' };
const SEVEN_DAYS_MS = 7 * 86400000;

function ActionButton({ style = BTN, onClick, children }) {
  return (
    <button className="btn btn-outline" data-action="returns" style={style} onClick={onClick} type="button">
      {children}
    </button>
  );
}

export default function ReturnRow({ item, canManage, onView, onEdit, onApprove, onAction, onWithdraw }) {
  const next = RETURN_NEXT[item.status] || [];
  const isExchange = item.returnType === 'exchange';
  const raisedAt = returnRaisedAt(item);
  const isOverdue = ['Pending', 'Approved'].includes(item.status) && raisedAt > 0 && Date.now() - raisedAt > SEVEN_DAYS_MS;
  return (
    <tr>
      <td className="cell-main">
        <button type="button" className="btn-link" style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent, inherit)', cursor: 'pointer', fontWeight: 600 }} onClick={() => onView(item)}>
          {item.id}
        </button>
      </td>
      <td className="nowrap">{item.orderId}</td>
      <td>
        {item.customer || '—'}
        {item.customerPhone && <div className="text-sm text-muted">{item.customerPhone}</div>}
      </td>
      <td>{item.product}</td>
      <td>{item.reason}</td>
      <td className="nowrap">
        {isExchange ? <span className="text-muted">Exchange</span> : rupees(item.amount)}
        <div className="text-sm text-muted">of {rupees(item.orderTotal)} bill</div>
      </td>
      <td>
        <Badge status={item.status} type={returnBadgeType(item.status)} />
      </td>
      <td title={item.createdAt || item.returnDate}>
        {returnAge(item)}
        {isOverdue && (
          <div style={{ color: 'var(--amber, #f59e0b)', fontSize: '0.72rem', fontWeight: 600 }}>Over 7d</div>
        )}
      </td>
      <td>
        {!canManage || !next.length ? (
          <ActionButton onClick={() => onView(item)}>View</ActionButton>
        ) : (
          <>
            {next.includes('Approved') && <ActionButton onClick={() => onApprove(item)}>Approve</ActionButton>}
            {!isExchange && next.includes('Refunded') && (
              <ActionButton onClick={() => onAction(item, 'Refunded')}>Refund</ActionButton>
            )}
            {isExchange && next.includes('Exchanged') && (
              <ActionButton onClick={() => onAction(item, 'Exchanged')}>Exchange</ActionButton>
            )}
            {next.includes('Rejected') && (
              <ActionButton style={BTN_RED} onClick={() => onAction(item, 'Rejected')}>
                Reject
              </ActionButton>
            )}
            {item.status === 'Pending' && onEdit && (
              <ActionButton onClick={() => onEdit(item)}>Edit</ActionButton>
            )}
            {item.status === 'Pending' && (
              <ActionButton style={BTN_RED} onClick={() => onWithdraw(item)}>
                Withdraw
              </ActionButton>
            )}
          </>
        )}
      </td>
    </tr>
  );
}
