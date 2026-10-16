import { ToastCheckIcon, ToastErrorIcon } from './icons.jsx';

export default function Toast({ message, show, type = 'success' }) {
  const isError = type === 'error';
  const toastClass = ['toast', isError ? 'toast-error' : 'toast-success', show ? 'show' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={toastClass} id="successToast">
      {isError ? ToastErrorIcon : ToastCheckIcon}
      <span id="toastMessage">{message}</span>
    </div>
  );
}
