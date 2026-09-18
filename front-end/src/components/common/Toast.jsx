import { ToastCheckIcon } from './icons.jsx';

/**
 * The static toast of orders/inventory/users.html:
 *   <div class="toast[ show]" id="successToast"><svg/><span id="toastMessage">{message}</span></div>
 * DashboardLayout renders it when given a `toast` prop and drives it via showToast().
 */
export default function Toast({ message, show }) {
  return (
    <div className={show ? 'toast show' : 'toast'} id="successToast">
      {ToastCheckIcon}
      <span id="toastMessage">{message}</span>
    </div>
  );
}
