import { useDispatch } from 'react-redux';
import { transitionReturnThunk, deleteReturnThunk } from '../../store/slices/returnsSlice.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { rupees } from './returnStats.js';

/**
 * Return-desk actions using Redux Toolkit DB-first Thunks.
 */
export default function useReturnActions() {
  const dispatch = useDispatch();
  const { hasActionAccess, denyAction, openConfirm, showToast } = useDashboard();
  const canManage = hasActionAccess('returns');

  const transition = async (item, body) => {
    if (!canManage) {
      denyAction('Return update');
      throw new Error('Not allowed for your role');
    }
    const action = await dispatch(transitionReturnThunk({ id: item.id, body }));
    if (transitionReturnThunk.rejected.match(action)) {
      throw new Error(action.payload || 'Return transition failed');
    }
    const saved = action.payload;
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
          showToast(`Approve failed: ${err.message || 'Error'}`);
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
          const action = await dispatch(deleteReturnThunk(item.id));
          if (deleteReturnThunk.rejected.match(action)) {
            throw new Error(action.payload || 'Withdraw failed');
          }
          showToast(`Return ${item.id} withdrawn`);
          return true;
        } catch (err) {
          showToast(`Withdraw failed: ${err.message || 'Error'}`);
          return false;
        }
      },
    });

  return { canManage, transition, approve, withdraw };
}
