import { useEffect } from 'react';

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
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

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
          <button
            className="modal-close"
            id={closeButtonId}
            type={closeButtonType || undefined}
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
