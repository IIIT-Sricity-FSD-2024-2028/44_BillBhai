import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import Badge from '../../../shared/components/common/Badge.jsx';
import printReceipt from '../../../shared/lib/printReceipt.js';
import { fetchReturnHistoryThunk, selectReturnsUi } from '../returnsSlice.js';
import { returnBadgeType, rupees, shortDate } from './returnStats.js';

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '8px 16px',
  fontSize: '0.88rem',
  marginBottom: '12px',
};

/** A return's lines, money, outcome and its full change history. */
export default function ReturnDetailModal({ item, onClose }) {
  const dispatch = useDispatch();
  const { detailHistory: history } = useSelector(selectReturnsUi);

  useEffect(() => {
    if (!item) return;
    dispatch(fetchReturnHistoryThunk(item.id));
  }, [dispatch, item]);

  if (!item) return null;
  const lines = Array.isArray(item.items) ? item.items : [];

  return (
    <Modal open id="returnDetailModal" title={`Return ${item.id}`} onClose={onClose} maxWidth="680px">
      <div className="modal-body">
        <div style={GRID}>
          <div><span className="text-muted">Status</span><br /><Badge status={item.status} type={returnBadgeType(item.status)} /></div>
          <div><span className="text-muted">Order</span><br /><strong>{item.orderId}</strong> ({rupees(item.orderTotal)})</div>
          <div><span className="text-muted">Customer</span><br />{item.customer || '—'}{item.customerPhone ? ` · ${item.customerPhone}` : ''}</div>
          <div><span className="text-muted">Brought in by</span><br />{item.requestedBy || '—'}</div>
          <div><span className="text-muted">Reason</span><br />{item.reason}</div>
          <div><span className="text-muted">Type</span><br />{item.returnType === 'exchange' ? 'Exchange' : 'Refund'}</div>
          <div><span className="text-muted">Raised</span><br />{shortDate(item.createdAt || item.returnDate)}</div>
          {item.resolvedAt && (
            <div><span className="text-muted">Closed</span><br />{shortDate(item.resolvedAt)} by {item.resolvedBy}</div>
          )}
          {item.refundMethod && <div><span className="text-muted">Refunded by</span><br />{item.refundMethod}</div>}
          {item.restock !== undefined && item.restock !== null && (item.status === 'Refunded' || item.status === 'Exchanged') && (
            <div><span className="text-muted">Returned goods</span><br />{item.restock ? 'Back on the shelf' : 'Written off (damaged)'}</div>
          )}
          {item.rejectReason && <div><span className="text-muted">Rejected because</span><br />{item.rejectReason}</div>}
          {item.note && <div><span className="text-muted">Note</span><br />{item.note}</div>}
        </div>

        <div className="tbl-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price paid / unit</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.productId}>
                  <td className="cell-main">{l.productName}</td>
                  <td>{l.qty}</td>
                  <td>{rupees(l.unitPrice)}</td>
                  <td>{rupees(l.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}><strong>{item.returnType === 'exchange' ? 'Exchange (no money back)' : 'Refund'}</strong></td>
                <td><strong>{rupees(item.amount)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 style={{ margin: '16px 0 8px' }}>History</h4>
        {history.loading && <p className="text-muted">Loading…</p>}
        {history.error && <p className="text-muted">History unavailable: {history.error}</p>}
        {!history.loading && !history.error && !history.rows.length && <p className="text-muted">No changes recorded yet.</p>}
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem' }}>
          {history.rows.map((h) => (
            <li key={h.id} style={{ marginBottom: '4px' }}>
              <span className="text-muted">{shortDate(h.at)}</span> · <strong>{h.by}</strong>: {h.summary}
            </li>
          ))}
        </ul>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={() => printReceipt()}>
          Print credit note
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="receipt" aria-hidden="true">
        <h2>CREDIT NOTE / RETURN RECEIPT</h2>
        <p className="receipt-row"><span>Return</span><span>{item.id}</span></p>
        <p className="receipt-row"><span>Order</span><span>{item.orderId}</span></p>
        <p>Date: {shortDate(item.resolvedAt || item.createdAt || item.returnDate)}</p>
        <p>Customer: {item.customer || '—'}{item.customerPhone ? ` (${item.customerPhone})` : ''}</p>
        <p>Reason: {item.reason}</p>
        <table>
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.productId}>
                <td>{l.productName}</td>
                <td>{l.qty}</td>
                <td>{rupees(l.unitPrice)}</td>
                <td>{rupees(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="receipt-row receipt-total">
          <span>{item.returnType === 'exchange' ? 'Exchange' : 'Credit / Refund'}</span>
          <span>{item.returnType === 'exchange' ? 'Replaced' : rupees(item.amount)}</span>
        </p>
        {item.refundMethod && (
          <p className="receipt-row"><span>Refunded by</span><span>{item.refundMethod}</span></p>
        )}
        <p className="receipt-foot">Status: {item.status}. Thank you!</p>
      </div>
    </Modal>
  );
}
