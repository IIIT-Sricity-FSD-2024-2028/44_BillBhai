/**
 * Modal shell shared by every dialog:
 *   <div class="modal-overlay[ active]" id={id}>
 *     <div class="modal" style={{ maxWidth }}>
 *       <div class="modal-header"><h3>{title}</h3><button class="modal-close" type="button">&times;</button></div>
 *       {children}   // .modal-body / form / .modal-footer exactly as the original markup
 *     </div>
 *   </div>
 *
 * Props
 *  open            adds `active` (default true). Static page modals (orders.html
 *                  #newOrderModal, ...) stay mounted and toggle `open`.
 *  title, onClose  close button + overlay click call onClose.
 *  maxWidth        e.g. '540px' (quick form), '460px' (confirm), '780px' (plans).
 *  id              overlay id (static modals).
 *  closeButtonId   id for the × button (static modals, e.g. "orderModalClose").
 *  closeButtonType 'button' (default, dynamic modals) or null (static HTML modals had no type).
 *  closeOnOverlay  default true.
 */
export default function Modal({
  open = true,
  title,
  onClose,
  maxWidth,
  id,
  closeButtonId,
  closeButtonType = 'button',
  closeOnOverlay = true,
  children,
}) {
  return (
    <div
      className={open ? 'modal-overlay active' : 'modal-overlay'}
      id={id}
      onClick={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" id={closeButtonId} type={closeButtonType || undefined} onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
