import Modal from '../common/Modal.jsx';
import Badge from '../common/Badge.jsx';
import printReceipt from '../../lib/printReceipt.js';
import { deliveryBadgeProps } from '../../lib/dashboard/helpers.js';
import { actionsFor } from './useDeliveryActions.jsx';
import { dueAt, formatMobile, isOverdue, minutesLate, money, when } from './deliveryView.js';

function Row({ label, children }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value" style={{ textAlign: 'right' }}>
        {children}
      </span>
    </div>
  );
}

/** Everything about one delivery: parcel, money, partner, timeline and a printable slip. */
export default function DeliveryDetailModal({ delivery: d, businessName, canManage, onAction, onClose }) {
  if (!d) return <Modal open={false} title="" onClose={onClose} />;
  const badge = deliveryBadgeProps(d.status);
  const due = dueAt(d);
  const actions = canManage ? actionsFor(d) : [];

  return (
    <Modal open id="deliveryDetailModal" title={`Delivery ${d.id}`} onClose={onClose} maxWidth="760px">
      <div className="modal-body">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <Badge status={badge.text} type={badge.type} />
          <span className="text-sm text-muted">
            Order {d.orderId} · {d.orderStatus || '—'}
          </span>
          {isOverdue(d) && <Badge status={`${minutesLate(d)} min late`} type="cancelled" />}
        </div>
        <div className="grid-2" style={{ gap: '16px' }}>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Customer</h4>
            <Row label="Name">{d.customer || '—'}</Row>
            <Row label="Mobile">{formatMobile(d.customerPhone) || '—'}</Row>
            <Row label="Address">{d.address || '—'}</Row>
            <h4 style={{ margin: '14px 0 6px' }}>Money</h4>
            <Row label="Bill total">{money(d.orderTotal)}</Row>
            <Row label="Payment">
              {d.paymentMethod} · {d.paymentStatus || '—'}
            </Row>
            {d.codAmount > 0 && <Row label="Cash to collect">{money(d.codAmount)}</Row>}
            {d.cashCollected > 0 && <Row label="Cash collected">{money(d.cashCollected)}</Row>}
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px' }}>Partner</h4>
            <Row label="Name">{d.partner || 'Not assigned'}</Row>
            <Row label="Mobile">{formatMobile(d.partnerPhone) || '—'}</Row>
            <Row label="Agency / vehicle">{[d.partnerAgency, d.partnerVehicle].filter(Boolean).join(' · ') || '—'}</Row>
            <Row label="ETA">{d.etaMin ? `${d.etaMin} min after dispatch` : '—'}</Row>
            {due && <Row label="Expected by">{when(due)}</Row>}
            <Row label="Attempts">{d.attempts || 0}</Row>
            {d.failureReason && <Row label="Last failure">{d.failureReason}</Row>}
            {d.receiverName && <Row label="Received by">{d.receiverName}</Row>}
          </div>
        </div>

        <h4 style={{ margin: '16px 0 6px' }}>Items</h4>
        {(d.items || []).length ? (
          (d.items || []).map((i) => (
            <Row key={i.productId} label={i.productName}>
              × {i.quantity}
            </Row>
          ))
        ) : (
          <p className="text-sm text-muted">No item details.</p>
        )}

        <h4 style={{ margin: '16px 0 8px' }}>Timeline</h4>
        <div className="timeline">
          {(d.history || []).map((h, idx) => (
            <div className="timeline-item" key={`${h.status}-${idx}`}>
              <div className="timeline-marker" />
              <div className="timeline-time">
                {when(h.at)} · {h.by}
              </div>
              <div className="timeline-content">
                <strong>{h.status}</strong>
                {h.note ? ` — ${h.note}` : ''}
              </div>
            </div>
          ))}
        </div>

        {/* Printed by "Print slip"; hidden on screen (see .receipt in theme.css). */}
        <div className="receipt">
          <h2>{businessName || 'BillBhai'}</h2>
          <p>DELIVERY SLIP {d.id}</p>
          <p>Order: {d.orderId}</p>
          <p>Date: {when(d.history && d.history.length ? d.history[0].at : d.lastChangeAt)}</p>
          <hr />
          <p>To: {d.customer}</p>
          <p>Ph: {formatMobile(d.customerPhone)}</p>
          <p>{d.address}</p>
          <hr />
          {(d.items || []).map((i) => (
            <p key={i.productId}>
              {i.productName} x {i.quantity}
            </p>
          ))}
          <hr />
          <p>Bill total: {money(d.orderTotal)}</p>
          <p>{d.codAmount > 0 ? `COLLECT CASH: ${money(d.codAmount)}` : `PREPAID (${d.paymentMethod}) - collect nothing`}</p>
          <p>Partner: {d.partner || '-'} {formatMobile(d.partnerPhone)}</p>
          <p>Received by: ______________</p>
        </div>
      </div>
      <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '6px' }}>
        <button type="button" className="btn btn-outline" onClick={printReceipt}>
          Print slip
        </button>
        {actions.map((a) => (
            <button
              key={a.kind}
              type="button"
              className={a.primary ? 'btn btn-primary' : 'btn btn-outline'}
              style={a.danger ? { color: 'var(--red)', borderColor: 'var(--red)' } : undefined}
              onClick={() => onAction(a.kind, d)}
            >
              {a.label}
            </button>
          ))}
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
