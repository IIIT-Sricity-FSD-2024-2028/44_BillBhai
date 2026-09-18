// Port of window.raiseReturnRequest / editReturn / approveReturn / refundReturn /
// rejectReturn (dashboard.js ~7083-7240). Returned as plain callbacks so the
// page passes them down to rows as props.
import { useDashboard, useReturns, useSession } from '../../lib/dashboard/hooks.js';
import { buildBackendReturnPayload, updateReturnOnBackend } from '../../lib/dashboard/api.js';
import { formatDate, getNextReturnId } from '../../lib/dashboard/helpers.js';

export default function useReturnActions() {
  const {
    inventory, returns, hasActionAccess, denyAction, openQuickForm, showToast, showMutationError,
    updateCollection, renderPage,
  } = useDashboard();
  const { userName } = useSession();
  const { create } = useReturns();

  // The original mutated the found `item` in place (the backend-id helpers
  // rewrite id/backendId). Here the helpers get a copy that is written back.
  const commit = (originalId, copy, patch, persist = true) => {
    updateCollection('returns', (rows) => rows.map((r) => (r.id === originalId ? { ...copy, ...patch } : r)), { persist });
  };

  const runBackendUpdate = async (item, payload) => {
    const copy = { ...item };
    try {
      await updateReturnOnBackend(copy, payload);
      return copy;
    } catch (error) {
      // Keep id changes made before the failure (the original object was mutated too).
      if (copy.id !== item.id || copy.backendId !== item.backendId) commit(item.id, copy, {}, false);
      throw error;
    }
  };

  const raiseReturnRequest = () => {
    if (!hasActionAccess('returns')) {
      denyAction('Return request create');
      return;
    }
    const productOptions = Array.from(new Set(
      inventory.map((i) => String((i && i.name) || '').trim()).filter(Boolean),
    ));
    const productField = productOptions.length
      ? { name: 'product', label: 'Product', type: 'select', required: true, options: productOptions }
      : { name: 'product', label: 'Product', type: 'text', required: true, placeholder: 'Product name' };
    openQuickForm({
      title: 'Raise Return Request',
      submitLabel: 'Create',
      fields: [
        { name: 'oid', label: 'Order ID', type: 'text', required: true, placeholder: 'ORD-4821' },
        productField,
        { name: 'qty', label: 'Quantity', type: 'number', required: true, min: 1, step: 1 },
        { name: 'reason', label: 'Reason', type: 'select', required: true, options: ['Damaged', 'Wrong Item', 'Expired', 'Stale'] },
        { name: 'amount', label: 'Refund Amount', type: 'number', required: true, min: 0, step: 0.01 },
      ],
      initialValues: { product: productOptions[0] || '', qty: 1, reason: 'Damaged', amount: 0 },
      onSubmit: async (values, closeModal) => {
        try {
          const productName = String(values.product || '').trim();
          const invItem = inventory.find((i) => String((i && i.name) || '').trim() === productName);
          const returnRecord = {
            id: getNextReturnId(returns),
            oid: String(values.oid).trim().toUpperCase(),
            product: productName,
            sku: invItem ? invItem.sku : undefined,
            cat: invItem ? invItem.cat : undefined,
            qty: Math.max(1, Number(values.qty) || 1),
            reason: String(values.reason).trim(),
            amount: Number(values.amount),
            status: 'Pending',
            requestedBy: userName || 'Operator',
            updatedAt: formatDate(),
          };
          // staffId: buildBackendReturnPayload falls back to currentUser.id || 'USR-005',
          // the same value the original passed explicitly.
          const body = buildBackendReturnPayload(returnRecord, { orderId: returnRecord.oid });
          await create(body, {
            role: 'returnhandler',
            prepend: true,
            toRow: (created) => {
              const id = (created && created.id) || returnRecord.id;
              return {
                ...returnRecord,
                id,
                backendId: id,
                orderId: String((created && created.orderId) || returnRecord.oid || '').trim(),
                backendProduct: String((created && created.product) || returnRecord.product || '').trim(),
                staffId: String((created && created.staffId) || body.staffId || 'USR-005').trim(),
                returnType: String((created && created.returnType) || 'refund').trim() || 'refund',
              };
            },
          });
          renderPage();
          closeModal();
          showToast('Return request raised successfully.');
        } catch (error) {
          showMutationError('Return create', error);
        }
      },
    });
  };

  const editReturn = (id) => {
    if (!hasActionAccess('returns')) {
      denyAction('Return edit');
      return;
    }
    const item = returns.find((r) => r.id === id);
    if (!item) return;

    openQuickForm({
      title: `Edit Return - ${id}`,
      submitLabel: 'Save',
      fields: [
        { name: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Under Review', 'Refunded', 'Rejected'] },
        { name: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'Damaged / Wrong Item / ...' },
        { name: 'amount', label: 'Refund Amount', type: 'number', required: true, min: 0, step: 0.01 },
      ],
      initialValues: {
        status: String(item.status || 'Pending').trim() || 'Pending',
        reason: String(item.reason || '').trim(),
        amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0,
      },
      onSubmit: async (values, closeModal) => {
        const payload = {
          status: String(values.status || 'Pending').trim() || 'Pending',
          reason: String(values.reason || '').trim(),
          refundAmount: Math.max(0, Number(values.amount) || 0),
        };
        try {
          const copy = await runBackendUpdate(item, payload);
          commit(item.id, copy, {
            status: payload.status,
            reason: payload.reason,
            amount: payload.refundAmount,
            updatedAt: formatDate(),
          });
          renderPage();
          closeModal();
          showToast(`Return ${id} updated.`);
        } catch (error) {
          showMutationError('Return update', error);
        }
      },
    });
  };

  const approveReturn = (id) => editReturn(id);

  const refundReturn = async (id) => {
    if (!hasActionAccess('returns')) {
      denyAction('Return refund');
      return;
    }
    const item = returns.find((r) => r.id === id);
    if (!item) return;
    try {
      const copy = await runBackendUpdate(item, {
        status: 'Refunded',
        refundAmount: Math.max(0, Number(item.amount) || 0),
      });
      commit(item.id, copy, { status: 'Refunded', updatedAt: formatDate() });
      renderPage();
      showToast(`Return ${id} refunded.`);
    } catch (error) {
      showMutationError('Return refund', error);
    }
  };

  const rejectReturn = async (id) => {
    if (!hasActionAccess('returns')) {
      denyAction('Return reject');
      return;
    }
    const item = returns.find((r) => r.id === id);
    if (!item) return;
    try {
      const copy = await runBackendUpdate(item, { status: 'Rejected' });
      commit(item.id, copy, { status: 'Rejected', updatedAt: formatDate() });
      renderPage();
      showToast(`Return ${id} rejected.`);
    } catch (error) {
      showMutationError('Return rejection', error);
    }
  };

  return { raiseReturnRequest, editReturn, approveReturn, refundReturn, rejectReturn };
}
