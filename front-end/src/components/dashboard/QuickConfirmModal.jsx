import Modal from '../common/Modal.jsx';
import { showMutationError } from '../../lib/dashboard/store.js';

/**
 * Port of openQuickConfirmModal({ title, message, confirmLabel, onConfirm }).
 * `message` may be a string or JSX (the original accepted HTML). The cancel
 * button is always labelled "Cancel" (cancelLabel was ignored by the original).
 * onConfirm() returning false (or a promise of false) keeps the modal open;
 * a thrown error shows "Action failed: ..." and keeps it open.
 */
export default function QuickConfirmModal({ config, onClose }) {
  const { title, message, confirmLabel, onConfirm } = config;

  const handleConfirm = async () => {
    try {
      const shouldClose = await onConfirm();
      if (shouldClose !== false) onClose();
    } catch (error) {
      showMutationError('Action', error);
    }
  };

  return (
    <Modal title={title || 'Confirm Action'} onClose={onClose} maxWidth="460px">
      <div className="modal-body">
        <p className="text-muted">{message}</p>
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" type="button" data-action="cancel" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="button" data-action="confirm" onClick={handleConfirm}>{confirmLabel || 'Confirm'}</button>
      </div>
    </Modal>
  );
}
