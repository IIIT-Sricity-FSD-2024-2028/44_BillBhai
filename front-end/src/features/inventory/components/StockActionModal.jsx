import useViewState from '../../../shared/hooks/useViewState.js';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import FormField, { controlClass } from '../../../shared/components/common/FormField.jsx';
import {
  receiveStockThunk,
  adjustStockThunk,
  selectInventorySaving,
} from '../inventorySlice.js';
import { extractErrorMessage } from '../../../store/thunkUtils.js';
import { ADJUST_REASONS, WHOLE } from './inventoryUtils.js';

function StockActionBody({ request, suppliers, onClose, onSaved }) {
  const dispatch = useDispatch();
  const storeSaving = useSelector(selectInventorySaving);
  const kind = request.kind;
  const item = request.item;
  const [qty, setQty] = useViewState(() => (request.quantity ? String(request.quantity) : ''));
  const [direction, setDirection] = useViewState('remove');
  const [supplierId, setSupplierId] = useViewState(() => item.supplierId || '');
  const [note, setNote] = useViewState('');
  const [reason, setReason] = useViewState(ADJUST_REASONS[0]);
  const [details, setDetails] = useViewState('');
  const [error, setError] = useViewState('');
  const [localSaving, setLocalSaving] = useViewState(false);
  const saving = localSaving || storeSaving;

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
    setLocalSaving(true);
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
      setError(extractErrorMessage(err, 'Could not save.'));
      setLocalSaving(false);
    }
  };

  const projected = (() => {
    const n = WHOLE.test(qty.trim()) ? Number(qty) : 0;
    if (kind === 'receive') return item.stock + n;
    return item.stock + (direction === 'remove' ? -n : n);
  })();

  return (
    <form noValidate onSubmit={submit}>
      <div className="modal-body">
        <p className="text-sm text-muted" style={{ marginBottom: '12px' }}>
          Current stock: <strong>{item.stock}</strong> · After saving: <strong>{Math.max(0, projected)}</strong> (reorder at {item.reorderLevel})
        </p>
        {error && <div className="form-error" style={{ display: 'block', marginBottom: '10px' }}>{error}</div>}
        {kind === 'adjust' && (
          <FormField label="Direction" htmlFor="saDir">
            <select id="saDir" className="form-control" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="remove">Remove damaged / missing stock (-)</option>
              <option value="add">Found extra stock (+)</option>
            </select>
          </FormField>
        )}
        <FormField label={kind === 'receive' ? 'Units received *' : 'Units *'} htmlFor="saQty">
          <input id="saQty" inputMode="numeric" className={controlClass(Boolean(error))} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Whole number" />
        </FormField>
        {kind === 'receive' ? (
          <>
            <FormField label="Supplier" htmlFor="saSupplier">
              <select id="saSupplier" className="form-control" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Default / unspecified</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Delivery note" htmlFor="saNote">
              <input id="saNote" className="form-control" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Invoice or challan number (optional)" maxLength={200} />
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
            <FormField label={reason === 'Other' ? 'Details *' : 'Details (optional)'} htmlFor="saDetails">
              <input id="saDetails" className="form-control" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={140} />
            </FormField>
          </>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : kind === 'receive' ? 'Record receipt' : 'Save adjustment'}
        </button>
      </div>
    </form>
  );
}

/**
 * Receive goods from a supplier, or adjust stock with a reason.
 * Strictly DB-first: local stock display only changes after `.fulfilled`.
 * request = { kind: 'receive' | 'adjust', item, quantity? }
 */
export default function StockActionModal({ request, suppliers, onClose, onSaved }) {
  const open = Boolean(request);
  const kind = request ? request.kind : 'receive';
  const item = request ? request.item : null;

  if (!item) return <Modal open={false} title="" onClose={onClose} />;

  const key = `${kind}:${item.productId}:${request.quantity || ''}:${item.stock}`;

  return (
    <Modal open={open} id="stockActionModal" title={`${kind === 'receive' ? 'Receive stock' : 'Adjust stock'} — ${item.name}`} onClose={onClose} maxWidth="520px">
      <StockActionBody key={key} request={request} suppliers={suppliers} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
