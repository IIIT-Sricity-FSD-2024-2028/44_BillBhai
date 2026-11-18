import Badge from '../common/Badge.jsx';
import { deliveryBadgeProps } from '../../lib/dashboard/helpers.js';
import { actionsFor } from './useDeliveryActions.jsx';
import { formatMobile, isOverdue, itemsSummary, minutesLate, money, when } from './deliveryView.js';

const BTN = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px', marginBottom: '3px' };

/** One delivery in the queue: parcel, money, people, status and the next step. */
export default function DeliveryRow({ d, canManage, onAction, onOpen }) {
  const badge = deliveryBadgeProps(d.status);
  const actions = canManage ? actionsFor(d) : [];
  const primary = actions.filter((a) => a.primary);
  const late = isOverdue(d);
  return (
    <tr style={late ? { background: 'rgba(220,53,69,0.06)' } : undefined}>
      <td className="cell-main">
        <button type="button" className="btn btn-outline" style={{ ...BTN, marginRight: 0 }} onClick={() => onOpen(d)}>
          {d.id}
        </button>
        <div className="text-sm text-muted">{d.orderId}</div>
      </td>
      <td>
        {d.customer || '—'}
        <div className="text-sm text-muted">{formatMobile(d.customerPhone)}</div>
        <div className="text-sm text-muted" style={{ maxWidth: '220px' }}>
          {d.address}
        </div>
      </td>
      <td style={{ minWidth: '120px', maxWidth: '220px' }}>
        <span className="text-sm">{itemsSummary(d.items) || '—'}</span>
      </td>
      <td className="nowrap">
        {money(d.orderTotal)}
        <div className="text-sm text-muted">
          {d.codAmount > 0 ? (
            d.status === 'Delivered' ? (
              `COD ${money(d.cashCollected)} collected`
            ) : (
              <strong style={{ color: 'var(--amber)' }}>COD: collect {money(d.codAmount)}</strong>
            )
          ) : (
            `Prepaid · ${d.paymentMethod}`
          )}
        </div>
      </td>
      <td>
        {d.partner || <span className="text-muted">Not assigned</span>}
        {d.partner && (
          <div className="text-sm text-muted">
            {[formatMobile(d.partnerPhone), d.partnerVehicle].filter(Boolean).join(' · ')}
          </div>
        )}
      </td>
      <td>
        <Badge status={badge.text} type={badge.type} />
        {late && (
          <div className="text-sm" style={{ color: 'var(--red)' }}>
            {minutesLate(d)} min late
          </div>
        )}
        {d.attempts > 0 && <div className="text-sm text-muted">Attempts: {d.attempts}</div>}
        {d.status === 'Failed Attempt' && d.failureReason && <div className="text-sm text-muted">{d.failureReason}</div>}
        <div className="text-sm text-muted nowrap">{when(d.lastChangeAt)}</div>
      </td>
      <td>
        {primary.map((a) => (
          <button key={a.kind} type="button" className="btn btn-primary" style={BTN} onClick={() => onAction(a.kind, d)}>
            {a.label}
          </button>
        ))}
        <button type="button" className="btn btn-outline" style={BTN} onClick={() => onOpen(d)}>
          {actions.length > primary.length ? 'More…' : 'Details'}
        </button>
      </td>
    </tr>
  );
}
