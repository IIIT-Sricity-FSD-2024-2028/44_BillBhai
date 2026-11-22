import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Modal from '../common/Modal.jsx';
import FormField, { controlClass } from '../common/FormField.jsx';
import { receiveStockThunk, adjustStockThunk } from '../../store/slices/inventorySlice.js';
import { ADJUST_REASONS, WHOLE } from './inventoryUtils.js';

/**
 * Receive goods from a supplier, or adjust stock with a reason.
 * request = { kind: 'receive' | 'adjust', item, quantity? }
 */
export default function StockActionModal({ request, suppliers, onClose, onSaved }) {
  const dispatch = useDispatch();
  const open = Boolean(request);
  const kind = request ? request.kind : 'receive';
  const item = request ? request.item : null;
  const [qty, setQty] = useState('');
  const [direction, setDirection] = useState('remove');
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState(ADJUST_REASONS[0]);
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    setQty(request.quantity ? String(request.quantity) : '');
    setDirection('remove');
    setSupplierId(request.item ? request.item.supplierId || '' : '');
    setNote('');
    setReason(ADJUST_REASONS[0]);
    setDetails('');
    setError('');
    setSaving(false);
  }, [request]);

  if (!item) return <Modal open={false} title="" onClose={onClose} />;

  const submit = async (e) => {
    e.preventDefault();
    const text = qty.trim();
    if (!WHOLE.test(text) || Number(text) < 1) {
      setError('Enter a whole number of units, 1 or more.');
      return;
    }
    const n = Number(text);
    if (n > 100000) {
      setError('That is more than 100,000 units. Check the number.');
      return;
    }
    if (kind === 'adjust') {
      if (direction === 'remove' && n > item.stock) {
        setError(`Only ${item.stock} on hand; you cannot remove ${n}.`);
        return;
      }
      if (reason === 'Other' && details.trim().length < 3) {
        setError('Describe the reason (at least 3 characters).');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      if (kind === 'receive') {
        await dispatch(
          receiveStockThunk({
            productId: item.productId,
            quantity: n,
            supplierId: supplierId || undefined,
            note: note.trim() || undefined,
          }),
        ).unwrap();
        onSaved(`Received ${n} × ${item.name}.`);
      } else {
        const fullReason = details.trim() ? `${reason}: ${details.trim()}` : reason;
        const adjustment = direction === 'remove' ? -n : n;
        await dispatch(
          adjustStockThunk({
            productId: item.productId,
            adjustment,
            reason: fullReason,
          }),
        ).unwrap();
        onSaved(`${item.name}: ${adjustment > 0 ? '+' : ''}${adjustment} (${fullReason}).`);
      }
    } catch (err) {
      setError(typeof err === 'string' ? err : err?.message || 'Could not save.');
      setSaving(false);
    }
  };

  const projected = (() => {
    const n = WHOLE.test(qty.trim()) ? Number(qty) : 0;
    if (kind === 'receive') return item.stock + n;
    return item.stock + (direction === 'remove' ? -n : n);
  })();

  return (
    <Modal open={open} id="stockActionModal" title={`${kind === 'receive' ? 'Receive stock' : 'Adjust stock'} — ${item.name}`} onClose={onClose} maxWidth="520px">
      <form noValidate onSubmit={submit}>
        <div className="modal-body">
          <div className="info-row">
            <span className="info-label">On hand now</span>
            <span className="info-value">
              {item.stock} (reorder at {item.reorderLevel})
            </span>
          </div>
          {kind === 'adjust' && (
            <FormField label="Change" htmlFor="saDirection">
              <select id="saDirection" className="form-control" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="remove">Remove units (−)</option>
                <option value="add">Add units (+)</option>
              </select>
            </FormField>
          )}
          <FormField label="Units *" htmlFor="saQty" error={error || ''} invalid={error ? true : undefined}>
            <input id="saQty" inputMode="numeric" className={controlClass(Boolean(error))} value={qty} onChange={(e) => { setQty(e.target.value); setError(''); }} autoFocus />
          </FormField>
          {kind === 'receive' ? (
            <>
              <FormField label="From supplier" htmlFor="saSupplier">
                <select id="saSupplier" className="form-control" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Not recorded</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Note (invoice no., batch…)" htmlFor="saNote">
                <input id="saNote" className="form-control" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Reason *" htmlFor="saReason">
                <select id="saReason" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {ADJUST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label={reason === 'Other' ? 'Details *' : 'Details'} htmlFor="saDetails">
                <input id="saDetails" className="form-control" maxLength={150} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. 3 packs torn in storage" />
              </FormField>
            </>
          )}
          <div className="info-row">
            <span className="info-label">Stock after this</span>
            <span className="info-value" style={projected < 0 ? { color: 'var(--red)' } : undefined}>
              {projected}
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : kind === 'receive' ? 'Receive' : 'Save adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
