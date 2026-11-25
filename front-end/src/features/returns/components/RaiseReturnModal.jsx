import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import FormField from '../../../shared/components/common/FormField.jsx';
import { fetchReturnableOrderThunk, createReturnThunk } from '../returnsSlice.js';
import { RETURN_REASONS, rupees, shortDate } from './returnStats.js';

const ROW = { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' };
const STEPPER_BTN = { padding: '2px 10px', minWidth: '32px' };
const ERROR_BOX = { color: 'var(--red)', margin: '8px 0', fontSize: '0.85rem' };
const INFO_BOX = {
  background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
  borderRadius: '8px',
  padding: '10px 12px',
  margin: '8px 0 12px',
  fontSize: '0.85rem',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '6px 16px',
};

/**
 * Raise a return in two steps:
 *   1. find the order (type or pick a recent one) and load what can still
 *      be returned from it;
 *   2. pick quantities line by line (capped at what is left), a reason and
 *      refund or exchange. The refund is the price the customer paid, worked
 *      out by the server; nobody types an amount or a product.
 */
export default function RaiseReturnModal({ open, onClose, onCreated, recentOrders = [] }) {
  const dispatch = useDispatch();
  const [orderInput, setOrderInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const [returnType, setReturnType] = useState('refund');
  const [requestedBy, setRequestedBy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setOrderInput('');
    setOrder(null);
    setQty({});
    setReason(RETURN_REASONS[0]);
    setOtherReason('');
    setReturnType('refund');
    setRequestedBy('');
    setNote('');
    setError('');
    setSaving(false);
    setLoading(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const lookUp = async (rawId) => {
    const id = String(rawId || orderInput || '').trim().toUpperCase();
    setError('');
    if (!/^ORD-\d+$/.test(id)) {
      setError('Enter an order number like ORD-4827 (it is printed on the bill).');
      return;
    }
    setLoading(true);
    try {
      const action = await dispatch(fetchReturnableOrderThunk(id));
      if (fetchReturnableOrderThunk.fulfilled.match(action)) {
        const data = action.payload;
        setOrder(data);
        setOrderInput(id);
        setQty({});
        setRequestedBy(data?.customerName || '');
      } else {
        setOrder(null);
        setError(action.payload || 'Could not load that order');
      }
    } catch (err) {
      setOrder(null);
      setError(err?.message || 'Could not load that order');
    } finally {
      setLoading(false);
    }
  };

  const lines = order ? order.lines : [];
  const chosen = lines.filter((l) => (qty[l.productId] || 0) > 0);
  const refundPreview = useMemo(
    () =>
      returnType === 'exchange'
        ? 0
        : Math.round(chosen.reduce((sum, l) => sum + l.unitPrice * (qty[l.productId] || 0), 0) * 100) / 100,
    [chosen, qty, returnType],
  );

  const setLineQty = (line, next) => {
    const value = Math.max(0, Math.min(line.returnable, next));
    setQty((prev) => ({ ...prev, [line.productId]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!order || !order.eligible) return;
    if (!chosen.length) {
      setError('Pick at least one item and how many are coming back.');
      return;
    }
    const finalReason = reason === 'Other' ? otherReason.trim() : reason;
    if (finalReason.length < 3) {
      setError('Describe the reason for the return (at least 3 characters).');
      return;
    }
    setSaving(true);
    try {
      const action = await dispatch(
        createReturnThunk({
          orderId: order.orderId,
          items: chosen.map((l) => ({ productId: l.productId, qty: qty[l.productId] })),
          reason: finalReason,
          returnType,
          requestedBy: requestedBy.trim() || undefined,
          note: note.trim() || undefined,
        }),
      );
      if (createReturnThunk.fulfilled.match(action)) {
        const created = action.payload;
        reset();
        onCreated(created);
      } else {
        setError(action.payload || 'Could not raise the return');
        setSaving(false);
      }
    } catch (err) {
      setError(err?.message || 'Could not raise the return');
      setSaving(false);
    }
  };

  return (
    <Modal open={open} id="raiseReturnModal" title="Raise Return" onClose={close} maxWidth="720px">
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <FormField label="Order number" htmlFor="returnOrderId" hint="Type the order number from the bill, or pick a recent order.">
            <div style={ROW}>
              <input
                id="returnOrderId"
                className="form-control"
                style={{ flex: '1 1 200px' }}
                placeholder="ORD-4827"
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    lookUp();
                  }
                }}
              />
              <button type="button" className="btn btn-outline" onClick={() => lookUp()} disabled={loading}>
                {loading ? 'Looking up…' : 'Find order'}
              </button>
            </div>
          </FormField>

          {!order && recentOrders.length > 0 && (
            <div className="form-group">
              <label className="form-label" htmlFor="returnRecentOrder">Recent delivered orders</label>
              <select
                id="returnRecentOrder"
                className="form-control"
                value=""
                onChange={(e) => e.target.value && lookUp(e.target.value)}
              >
                <option value="">Pick an order…</option>
                {recentOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.customer} · {rupees(o.total)} · {o.date}
                  </option>
                ))}
              </select>
            </div>
          )}

          {order && (
            <>
              <div style={INFO_BOX}>
                <div><span className="text-muted">Order</span><br /><strong>{order.orderId}</strong></div>
                <div><span className="text-muted">Customer</span><br />{order.customerName || '—'}{order.customerPhone ? ` · ${order.customerPhone}` : ''}</div>
                <div><span className="text-muted">Billed on</span><br />{shortDate(order.orderDate)}</div>
                <div><span className="text-muted">Bill total</span><br />{rupees(order.total)} ({order.paymentMethod})</div>
                <div><span className="text-muted">Already refunded</span><br />{rupees(order.refundedAmount)}</div>
                <div><span className="text-muted">Status</span><br />{order.status}</div>
              </div>

              {!order.eligible && (
                <div style={ERROR_BOX} role="alert">
                  This order cannot be returned: {order.reason}.
                </div>
              )}

              {order.eligible && (
                <>
                  <div className="tbl-wrap">
                    <table className="dt">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Bought</th>
                          <th>Already returned</th>
                          <th>Price paid / unit</th>
                          <th>Returning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => {
                          const n = qty[line.productId] || 0;
                          return (
                            <tr key={line.productId}>
                              <td className="cell-main">{line.productName}</td>
                              <td>{line.sold}</td>
                              <td>{line.returned}</td>
                              <td>
                                {rupees(line.unitPrice)}
                                {line.unitPrice !== line.itemPrice && (
                                  <div className="text-sm text-muted">MRP {rupees(line.itemPrice)}, after discount</div>
                                )}
                              </td>
                              <td>
                                {line.returnable === 0 ? (
                                  <span className="text-muted">Nothing left</span>
                                ) : (
                                  <div style={{ ...ROW, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                    <button type="button" className="btn btn-outline" style={STEPPER_BTN} onClick={() => setLineQty(line, n - 1)} disabled={n <= 0} aria-label={`One less ${line.productName}`}>
                                      −
                                    </button>
                                    <strong style={{ minWidth: '1.5em', textAlign: 'center' }}>{n}</strong>
                                    <button type="button" className="btn btn-outline" style={STEPPER_BTN} onClick={() => setLineQty(line, n + 1)} disabled={n >= line.returnable} aria-label={`One more ${line.productName}`}>
                                      +
                                    </button>
                                    <span className="text-sm text-muted">of {line.returnable}</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid-2" style={{ marginTop: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="returnReason">Reason</label>
                      <select id="returnReason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)}>
                        {RETURN_REASONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                      {reason === 'Other' && (
                        <input
                          className="form-control"
                          style={{ marginTop: '6px' }}
                          id="returnReasonOther"
                          placeholder="Describe the problem"
                          maxLength={120}
                          value={otherReason}
                          onChange={(e) => setOtherReason(e.target.value)}
                        />
                      )}
                    </div>
                    <div className="form-group">
                      <span className="form-label">Customer wants</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
                        <label style={{ ...ROW, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                          <input type="radio" name="returnType" value="refund" checked={returnType === 'refund'} onChange={() => setReturnType('refund')} />
                          Money back
                        </label>
                        <label style={{ ...ROW, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                          <input type="radio" name="returnType" value="exchange" checked={returnType === 'exchange'} onChange={() => setReturnType('exchange')} />
                          Same item in exchange
                        </label>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="returnRequestedBy">Brought in by</label>
                      <input id="returnRequestedBy" className="form-control" maxLength={80} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="returnNote">Note (optional)</label>
                      <input id="returnNote" className="form-control" maxLength={300} placeholder="Seal, batch, condition" value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ ...ROW, justifyContent: 'space-between', marginTop: '4px' }}>
                    <span className="text-muted">
                      {chosen.reduce((s, l) => s + (qty[l.productId] || 0), 0)} item(s) selected
                    </span>
                    <strong>
                      {returnType === 'exchange' ? 'Exchange: no money back' : `Refund due: ${rupees(refundPreview)}`}
                    </strong>
                  </div>
                </>
              )}
            </>
          )}

          {error && (
            <div style={ERROR_BOX} role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {order && (
            <button type="button" className="btn btn-outline" onClick={reset}>
              Different order
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!order || !order.eligible || saving || !chosen.length}>
            {saving ? 'Saving…' : 'Raise return'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
