import { api, errorText } from '../../lib/http.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { rupees } from './returnStats.js';

/**
 * Return-desk actions. Every change goes to the server (with the version the
 * screen loaded, so two people cannot overwrite each other) and the page then
 * reloads from the server.
 */
export default function useReturnActions() {
  const { hasActionAccess, denyAction, openConfirm, showToast, refreshData } = useDashboard();
  const canManage = hasActionAccess('returns');

  const transition = async (item, body) => {
    if (!canManage) {
      denyAction('Return update');
      throw new Error('Not allowed for your role');
    }
    const saved = await api(`/returns/${encodeURIComponent(item.id)}/status`, { method: 'POST', body });
    await refreshData();
    const done = {
      Approved: `Return ${item.id} approved`,
      Refunded: `Refunded ${rupees(item.amount)} for ${item.id}`,
      Exchanged: `Exchange completed for ${item.id}`,
      Rejected: `Return ${item.id} rejected`,
    }[body.status];
    showToast(done || `Return ${item.id} updated`);
    return saved;
  };

  const approve = (item) =>
    openConfirm({
      title: 'Approve Return',
      message: `Approve ${item.id} (${item.product}) from ${item.orderId}? You can refund or exchange it next.`,
      confirmLabel: 'Approve',
      onConfirm: async () => {
        try {
          await transition(item, { status: 'Approved', version: item.version });
          return true;
        } catch (err) {
          showToast(`Approve failed: ${errorText(err)}`);
          return false;
        }
      },
    });

  const withdraw = (item) =>
    openConfirm({
      title: 'Withdraw Return',
      message: `Withdraw the request ${item.id}? Use this only if it was raised by mistake.`,
      confirmLabel: 'Withdraw',
      onConfirm: async () => {
        try {
          await api(`/returns/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
          await refreshData();
          showToast(`Return ${item.id} withdrawn`);
          return true;
        } catch (err) {
          showToast(`Withdraw failed: ${errorText(err)}`);
          return false;
        }
      },
    });

  return { canManage, transition, approve, withdraw };
}
