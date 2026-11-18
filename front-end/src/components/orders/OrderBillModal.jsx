import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Badge from '../common/Badge.jsx';
import printReceipt from '../../lib/printReceipt.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { apiRequest } from '../../lib/dashboard/api.js';
import { CHECKOUT_MODE_LABELS, formatDateTime, rupees, statusColour } from './orderFormat.js';
import { canCancelOrder } from './OrderRow.jsx';

const SECTION = { marginTop: '14px' };
const H4 = { fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 6px' };
const ROW = { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.85rem', padding: '2px 0' };
const LIST = { listStyle: 'none', margin: 0, padding: 0, fontSize: '0.82rem' };

function money2(n) {
  return `₹${(Number(n) || 0).toFixed(2)}`;
}

/** The printed bill: GST-inclusive lines, discount, delivery, tax and payment. */
function PrintedBill({ order, shop }) {
  return (
    <div className="receipt" id="printReceipt">
      <h2>{shop.name || 'BillBhai Store'}</h2>
      {shop.address && <p>{shop.address}</p>}
      {shop.gstNo && <p>GSTIN: {shop.gstNo}</p>}
      <p>
        Bill: {order.bill ? order.bill.billNo : '—'} · {order.id}
      </p>
      <p>{formatDateTime(order.orderDate)}</p>
      <p>
        Customer: {order.customerName || 'Walk-in Customer'}
        {order.customerPhone ? ` (${order.customerPhone})` : ''}
      </p>
      <p>Billed by: {order.staffName || order.staffId}</p>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty × Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id || item.productId}>
              <td>
                {item.productName || item.productId}
                {item.gstRate ? <small style={{ display: 'block' }}>GST {item.gstRate}%</small> : null}
              </td>
              <td className="nowrap">
                {item.quantity} × {money2(item.itemPrice)}
              </td>
              <td className="nowrap">{money2(item.itemPrice * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="receipt-row">
        <span>Subtotal</span>
        <span>{money2(order.subtotal)}</span>
      </p>
      {order.discountAmount > 0 && (
        <p className="receipt-row">
          <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
          <span>− {money2(order.discountAmount)}</span>
        </p>
      )}
      {order.deliveryCharge > 0 && (
        <p className="receipt-row">
          <span>Delivery charge</span>
          <span>{money2(order.deliveryCharge)}</span>
        </p>
      )}
      <p className="receipt-row receipt-total">
        <span>Total</span>
        <span>{money2(order.total)}</span>
      </p>
      <p className="receipt-row">
        <span>GST included</span>
        <span>{money2(order.taxAmount)}</span>
      </p>
      <p>
        Paid by: {order.paymentMethod}
        {order.paymentStatus && order.paymentStatus !== 'Paid' ? ` (${order.paymentStatus})` : ''}
      </p>
      {order.refundedAmount > 0 && (
        <p className="receipt-row">
          <span>Refunded</span>
          <span>− {money2(order.refundedAmount)}</span>
        </p>
      )}
      <p className="receipt-foot">Prices include GST. Thank you, visit again!</p>
    </div>
  );
}

export default function OrderBillModal({ orderId, onClose, canEdit, isManager, onEdit, onCancel }) {
  const { businesses, state, returns } = useDashboard();
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [delivery, setDelivery] = useState(null);
  const [shop, setShop] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return undefined;
    let cancelled = false;
    setOrder(null);
    setHistory([]);
    setDelivery(null);
    setError('');
    apiRequest(`/orders/${encodeURIComponent(orderId)}`)
      .then((o) => {
        if (cancelled) return;
        setOrder(o);
        if (o.orderType === 'delivery') {
          apiRequest(`/deliveries/order/${encodeURIComponent(o.id)}`)
            .then((d) => !cancelled && setDelivery(d))
            .catch(() => {});
        }
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load this order.'));
    apiRequest('/activity', { query: { entity: 'order', entityId: orderId, limit: 50 } })
      .then((rows) => !cancelled && setHistory(Array.isArray(rows) ? rows : []))
      .catch(() => {});
    apiRequest('/companies/me/profile')
      .then((c) => !cancelled && setShop(c || {}))
      .catch(() => {
        const biz = (businesses || []).find((b) => b && b.id === state.activeBusinessId);
        if (!cancelled) setShop(biz ? { name: biz.name, gstNo: biz.gstNo, address: biz.address } : { name: localStorage.getItem('activeBusinessName') || '' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!orderId) return null;
  const orderReturns = (returns || []).filter((r) => r.orderId === orderId);
  const row = order
    ? { ...order, orderType: order.orderType, status: order.status }
    : null;

  return (
    <Modal title={`Order ${orderId}`} onClose={onClose} maxWidth="640px">
      <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {error && <p className="text-muted">{error}</p>}
        {!order && !error && <p className="text-muted">Loading order…</p>}
        {order && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <Badge status={order.status} type={statusColour(order.status)} />
              <Badge status={order.paymentStatus || 'Paid'} type={statusColour(order.paymentStatus)} />
              <span className="text-muted text-sm">
                {CHECKOUT_MODE_LABELS[order.checkoutMode] || order.checkoutMode} · version {order.version || 1}
                {order.updatedBy ? ` · last change by ${order.updatedBy}` : ''}
              </span>
            </div>
            {order.cancelReason && (
              <p className="text-sm" style={{ color: 'var(--red)', marginTop: '8px' }}>
                Cancelled: {order.cancelReason}
              </p>
            )}
            {order.notes && <p className="text-sm text-muted" style={{ marginTop: '6px' }}>Note: {order.notes}</p>}

            <div className="receipt-preview" style={SECTION}>
              <PrintedBill order={order} shop={shop} />
            </div>

            {(order.payments || []).length > 0 && (
              <div style={SECTION}>
                <h4 style={H4}>Payments</h4>
                {order.payments.map((p) => (
                  <div key={p.id} style={ROW}>
                    <span>
                      {p.id} · {p.paymentMethod} · {formatDateTime(p.paymentDate)}
                      {p.collectedBy ? ` · by ${p.collectedBy}` : ''}
                    </span>
                    <span>{rupees(p.amountPaid)}</span>
                  </div>
                ))}
              </div>
            )}

            {delivery && (
              <div style={SECTION}>
                <h4 style={H4}>Delivery {delivery.id}</h4>
                <div style={ROW}>
                  <span>
                    {delivery.status}
                    {delivery.partnerName ? ` · ${delivery.partnerName}${delivery.partnerPhone ? ` (${delivery.partnerPhone})` : ''}` : ' · no partner yet'}
                  </span>
                  {delivery.codAmount > 0 && <span>COD {rupees(delivery.codAmount)}</span>}
                </div>
                <div className="text-sm text-muted">{delivery.address}</div>
              </div>
            )}

            {orderReturns.length > 0 && (
              <div style={SECTION}>
                <h4 style={H4}>Returns</h4>
                {orderReturns.map((r) => (
                  <div key={r.id} style={ROW}>
                    <span>
                      {r.id} · {r.product} · {r.reason}
                    </span>
                    <span>
                      {r.status} {r.amount > 0 ? rupees(r.amount) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={SECTION}>
              <h4 style={H4}>History</h4>
              {history.length ? (
                <ul style={LIST}>
                  {history.map((h) => (
                    <li key={h.id} style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <span className="text-muted">{formatDateTime(h.at)} · {h.by}:</span> {h.summary}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm">No changes recorded since this order was loaded into the system.</p>
              )}
            </div>
          </>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        {row && canEdit && row.status !== 'Cancelled' && (
          <button type="button" className="btn btn-outline" onClick={() => onEdit(row.id)}>
            Edit details
          </button>
        )}
        {row && isManager && canCancelOrder(row) && (
          <button
            type="button"
            className="btn btn-outline"
            style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={() => onCancel(row.id)}
          >
            Cancel order
          </button>
        )}
        {order && (
          <button type="button" className="btn btn-primary" onClick={printReceipt}>
            Print Bill
          </button>
        )}
      </div>
    </Modal>
  );
}
