import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import FormField from '../../../shared/components/common/FormField.jsx';
import {
  closeReturnEditModal,
  selectReturnsUi,
  setReturnEditFormField,
  updateReturnThunk,
} from '../returnsSlice.js';
import { RETURN_REASONS } from './returnStats.js';

const ERROR_BOX = { color: 'var(--red)', marginTop: '8px', fontSize: '0.85rem' };

/** Edits the reason or note of a Pending return via PUT /returns/:id. */
export default function ReturnEditModal({ onSaved }) {
  const dispatch = useDispatch();
  const { editModal: item, editForm } = useSelector(selectReturnsUi);
  const { reason, note, error, saving } = editForm;

  if (!item) return null;

  const setField = (key, value) => dispatch(setReturnEditFormField({ key, value }));
  const close = () => dispatch(closeReturnEditModal());

  const submit = async (e) => {
    e.preventDefault();
    setField('error', '');
    if (reason.trim().length < 3) {
      setField('error', 'Give a reason for the return (at least 3 characters).');
      return;
    }
    setField('saving', true);
    const action = await dispatch(
      updateReturnThunk({
        id: item.id,
        body: {
          reason: reason.trim(),
          note: note.trim(),
          version: item.version,
        },
      }),
    );
    if (updateReturnThunk.fulfilled.match(action)) {
      close();
      if (onSaved) onSaved(action.payload);
    } else {
      setField('error', action.payload || 'Could not update return');
      setField('saving', false);
    }
  };

  return (
    <Modal open id="returnEditModal" title={`Edit Return ${item.id}`} onClose={close} maxWidth="480px">
      <form onSubmit={submit} noValidate>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Reason" htmlFor="editReturnReason">
            <input
              id="editReturnReason"
              className="form-control"
              list="editReturnReasonOptions"
              maxLength={120}
              value={reason}
              onChange={(e) => setField('reason', e.target.value)}
            />
            <datalist id="editReturnReasonOptions">
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Note (optional)" htmlFor="editReturnNote">
            <input
              id="editReturnNote"
              className="form-control"
              maxLength={300}
              value={note}
              onChange={(e) => setField('note', e.target.value)}
            />
          </FormField>

          {error && (
            <div style={ERROR_BOX} role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
