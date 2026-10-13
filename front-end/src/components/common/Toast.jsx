import { ToastCheckIcon } from './icons.jsx';

export default function Toast({ message, show }) {
  return (
    <div className={show ? 'toast show' : 'toast'} id="successToast">
      {ToastCheckIcon}
      <span id="toastMessage">{message}</span>
    </div>
  );
}
