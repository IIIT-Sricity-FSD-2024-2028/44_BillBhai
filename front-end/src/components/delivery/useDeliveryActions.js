// Delivery actions shared by the Delivery page and the Delivery Ops dashboard.
// Port of window.editDelivery / assignDeliveryPartner / markDeliveryDelivered /
// markDeliveryFailed / retryDelivery in dashboard.js (~7241-7455).
import { useCallback } from 'react';
import { useDashboard, useDeliveries } from '../../lib/dashboard/hooks.js';
import { isNotFoundError, resolveBackendDeliveryId } from '../../lib/dashboard/api.js';
import {
  formatDate,
  normalizeDeliveryStatus,
  normalizeEditablePhone,
  normalizePhoneDigits,
} from '../../lib/dashboard/helpers.js';

const EDIT_FIELDS = [
  { name: 'status', label: 'Status', type: 'select', required: true, options: ['Pending', 'Dispatched', 'In Transit', 'Delivered', 'Failed'] },
  { name: 'partner', label: 'Delivery Partner', type: 'text', required: false, placeholder: 'Unassigned' },
  { name: 'partnerPhone', label: 'Partner Phone', type: 'tel', required: false, placeholder: '10-digit phone', maxLength: 10, inputMode: 'numeric' },
  { name: 'partnerAgency', label: 'Agency / Team', type: 'text', required: false, placeholder: 'External delivery partner' },
  { name: 'partnerVehicle', label: 'Vehicle', type: 'text', required: false, placeholder: 'Bike' },
  { name: 'etaMin', label: 'ETA Minutes', type: 'number', required: false, min: 0, step: 1 },
];

const today = () => new Date().toISOString().slice(0, 10);

function stamp(row) {
  const updatedAt = formatDate();
  return { ...row, updatedAt, time: updatedAt.split(' ').slice(-1)[0] };
}

export default function useDeliveryActions() {
  const {
    deliveries, hasActionAccess, denyAction, openQuickForm, renderPage, showToast, showMutationError,
  } = useDashboard();
  const { update } = useDeliveries();

  /**
   * PUT /deliveries/:id as role deliveryops; on 404 resolve the backend id by
   * order and retry (the original then rewrote item.id to the resolved id).
   * `apply(row)` builds the updated local row.
   */
  const putDelivery = useCallback(async (item, body, apply) => {
    const opts = { role: 'deliveryops', apply: (row) => apply(row) };
    try {
      await update(item.id, body, opts);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      const copy = { ...item };
      const resolvedId = await resolveBackendDeliveryId(copy);
      await update(item.id, body, {
        ...opts,
        path: `/deliveries/${encodeURIComponent(String(resolvedId))}`,
        apply: (row) => ({ ...apply(row), id: resolvedId }),
      });
    }
  }, [update]);

  const editDelivery = useCallback((id) => {
    if (!hasActionAccess('delivery')) {
      denyAction('Delivery edit');
      return;
    }
    const item = deliveries.find((d) => d.id === id);
    if (!item) return;
    openQuickForm({
      title: `Edit Delivery - ${id}`,
      submitLabel: 'Save',
      fields: EDIT_FIELDS,
      initialValues: {
        status: normalizeDeliveryStatus(item.status),
        partner: item.partner || '',
        partnerPhone: normalizeEditablePhone(item.partnerPhone || ''),
        partnerAgency: item.partnerAgency || '',
        partnerVehicle: item.partnerVehicle || '',
        etaMin: Number.isFinite(Number(item.etaMin)) ? Math.max(0, Number(item.etaMin)) : '',
      },
      onSubmit: async (values, closeModal) => {
        const status = String(values.status || 'Pending').trim() || 'Pending';
        const partner = String(values.partner || '').trim();
        const partnerName = partner || 'Unassigned';
        const partnerPhone = normalizePhoneDigits(values.partnerPhone || '');
        const partnerAgency = String(values.partnerAgency || '').trim();
        const partnerVehicle = String(values.partnerVehicle || '').trim();
        const etaMin = values.etaMin === '' ? null : Math.max(0, Number(values.etaMin) || 0);
        const payload = { partnerName, partnerPhone, partnerAgency, partnerVehicle, status };
        if ((status === 'In Transit' || status === 'Dispatched') && !item.dispatchDate) {
          payload.dispatchDate = today();
        }
        if (status === 'Delivered') {
          payload.deliveryDate = today();
        }
        try {
          await putDelivery(item, payload, (row) => {
            const next = { ...row, partner: partnerName, partnerPhone, partnerAgency, partnerVehicle, status };
            if (payload.dispatchDate) next.dispatchDate = payload.dispatchDate;
            if (payload.deliveryDate) next.deliveryDate = payload.deliveryDate;
            if (etaMin !== null) next.etaMin = etaMin;
            else if (status === 'Delivered' || status === 'Failed') next.etaMin = 0;
            else if (status === 'Pending') next.etaMin = 35;
            return stamp(next);
          });
          renderPage();
          closeModal();
          showToast(`Delivery ${id} updated.`);
        } catch (error) {
          showMutationError('Delivery update', error);
        }
      },
    });
  }, [deliveries, hasActionAccess, denyAction, openQuickForm, putDelivery, renderPage, showToast, showMutationError]);

  const assignDeliveryPartner = editDelivery;

  const markDeliveryDelivered = useCallback(async (id) => {
    if (!hasActionAccess('delivery')) {
      denyAction('Delivery close');
      return;
    }
    const item = deliveries.find((d) => d.id === id);
    if (!item) return;
    try {
      await putDelivery(item, { status: 'Delivered', deliveryDate: today() },
        (row) => stamp({ ...row, status: 'Delivered', etaMin: 0 }));
      renderPage();
      showToast(`${id} marked delivered.`);
    } catch (error) {
      showMutationError('Delivery completion', error);
    }
  }, [deliveries, hasActionAccess, denyAction, putDelivery, renderPage, showToast, showMutationError]);

  const markDeliveryFailed = useCallback(async (id) => {
    if (!hasActionAccess('delivery')) {
      denyAction('Delivery failure');
      return;
    }
    const item = deliveries.find((d) => d.id === id);
    if (!item) return;
    if (normalizeDeliveryStatus(item.status) === 'Delivered') return;
    try {
      await putDelivery(item, { status: 'Failed' },
        (row) => stamp({ ...row, status: 'Failed', etaMin: 0 }));
      renderPage();
      showToast(`${id} marked failed.`);
    } catch (error) {
      showMutationError('Delivery failure update', error);
    }
  }, [deliveries, hasActionAccess, denyAction, putDelivery, renderPage, showToast, showMutationError]);

  const retryDelivery = useCallback(async (id) => {
    if (!hasActionAccess('delivery')) {
      denyAction('Delivery retry');
      return;
    }
    const item = deliveries.find((d) => d.id === id);
    if (!item) return;
    try {
      await putDelivery(item, { status: 'Pending', partnerName: 'Unassigned' }, (row) => ({
        ...row,
        status: 'Pending',
        partner: '',
        partnerPhone: '',
        partnerAgency: '',
        partnerVehicle: '',
        updatedAt: formatDate(),
        time: '-',
      }));
      renderPage();
      showToast(`${id} moved back to pending.`);
    } catch (error) {
      showMutationError('Delivery retry', error);
    }
  }, [deliveries, hasActionAccess, denyAction, putDelivery, renderPage, showToast, showMutationError]);

  return { editDelivery, assignDeliveryPartner, markDeliveryDelivered, markDeliveryFailed, retryDelivery };
}
