// Port of the business actions in dashboard.js (window.renderBusinessesHome,
// openBusinessDetails, openBusinessAdminDashboard, addBusiness, editBusiness,
// deleteBusiness, add/edit/deleteBusinessUser|Store|Payment) and the helpers
// getNextBusinessId / recalcBusinessDerivedFields / syncBusinessSnapshotToBackend.
//
// Business mutations in the original only called saveList('bb_businesses')
// (no persistOperationalData), so every store update here uses { persist: false }.
import { useNavigate } from 'react-router-dom';
import { useBusinesses, useDashboard } from '../../lib/dashboard/hooks.js';
import { setActiveBusiness } from '../../lib/dashboard/session.js';
import {
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEditablePhone,
  normalizePhoneDigits,
} from '../../lib/dashboard/helpers.js';

const SUPERUSER = { role: 'superuser', persist: false };

const BUSINESS_FIELDS = [
  { name: 'name', label: 'Business Name', type: 'text', required: true },
  { name: 'owner', label: 'Owner Name', type: 'text', required: true },
  { name: 'adminName', label: 'Admin Name', type: 'text', required: true },
  { name: 'type', label: 'Business Type', type: 'text', required: true },
  { name: 'email', label: 'Business Email', type: 'email', required: true },
  { name: 'phone', label: 'Business Phone', type: 'tel', required: true, maxLength: 10, inputMode: 'numeric' },
  { name: 'tenureMonths', label: 'Using BillBhai (Months)', type: 'number', required: true, min: 0 },
  { name: 'storesCount', label: 'Stores Count', type: 'number', required: true, min: 0 },
  { name: 'profit', label: 'Profit', type: 'number', required: true, min: 0, step: 0.01 },
  { name: 'paymentDue', label: 'Payment Due', type: 'number', required: true, min: 0, step: 0.01 },
  { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Trial', 'Paused'] },
  { name: 'productsPlan', label: 'Products Plan', type: 'text', required: true },
];

const USER_FIELDS = [
  { name: 'name', label: 'User Name', type: 'text', required: true },
  { name: 'role', label: 'Role', type: 'select', required: true, options: ['Admin', 'Cashier', 'Inventory Manager', 'Return Handler', 'Delivery Ops'] },
  { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Inactive'] },
];

const STORE_FIELDS = [
  { name: 'code', label: 'Store Code', type: 'text', required: true },
  { name: 'city', label: 'City', type: 'text', required: true },
  { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Maintenance', 'Inactive'] },
];

const PAYMENT_FIELDS = [
  { name: 'month', label: 'Month', type: 'text', required: true },
  { name: 'amount', label: 'Amount', type: 'number', required: true, min: 0, step: 0.01 },
  { name: 'status', label: 'Status', type: 'select', required: true, options: ['Paid', 'Partial', 'Due'] },
];

export function getNextBusinessId(businesses) {
  const nums = businesses.map((b) => parseInt(String(b.id || '').replace('BIZ-', ''), 10)).filter((n) => !Number.isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 101;
  return `BIZ-${next}`;
}

/** recalcBusinessDerivedFields(b), returning a new record. */
export function recalcBusinessDerivedFields(b) {
  const paymentEntries = Array.isArray(b.payments) ? b.payments : [];
  return {
    ...b,
    storesCount: Array.isArray(b.stores) ? b.stores.length : 0,
    paymentDue: paymentEntries
      .filter((p) => String(p.status || '').toLowerCase() !== 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
  };
}

/**
 * @param {{ showDetails(id: string): void }} view  switches the page to the
 *   business details view (renderBusinessDetails).
 */
export default function useBusinessActions({ showDetails }) {
  const navigate = useNavigate();
  const {
    hasActionAccess, denyAction, showToast, showMutationError, openQuickForm, openConfirm, renderPage,
  } = useDashboard();
  const { rows: businesses, create, update, remove } = useBusinesses();

  const guard = (label) => {
    if (!hasActionAccess('businesses')) {
      denyAction(label);
      return false;
    }
    return true;
  };

  const findBusiness = (id) => businesses.find((b) => b.id === id);

  // syncBusinessSnapshotToBackend + saveBusinessAndRefresh for one business.
  const saveSnapshot = async (next) => {
    const business = recalcBusinessDerivedFields(next);
    await update(business.id, {
      users: Array.isArray(business.users) ? business.users : [],
      stores: Array.isArray(business.stores) ? business.stores : [],
      payments: Array.isArray(business.payments) ? business.payments : [],
      storesCount: Number(business.storesCount || 0),
      paymentDue: Number(business.paymentDue || 0),
    }, { ...SUPERUSER, apply: () => business });
    showDetails(business.id);
  };

  const renderBusinessesHome = () => {
    if (!guard('Businesses view')) return;
    renderPage();
  };

  const openBusinessDetails = (id) => {
    if (!guard('Businesses detail view')) return;
    showDetails(id);
  };

  const openBusinessAdminDashboard = (id) => {
    if (!guard('Businesses dashboard view')) return;
    const business = findBusiness(id);
    if (!business) {
      showToast('Business not found.');
      return;
    }
    setActiveBusiness(business.id, business.name);
    navigate('/dashboard');
  };

  const addBusiness = () => {
    if (!guard('Business create')) return;
    openQuickForm({
      title: 'Add New Business',
      submitLabel: 'Create Business',
      fields: BUSINESS_FIELDS,
      initialValues: { status: 'Active', productsPlan: 'Billing Starter', tenureMonths: 1, storesCount: 1, profit: 0, paymentDue: 0 },
      onSubmit: async (values, closeModal) => {
        if (!isValidEmailAddress(values.email)) {
          showToast('Please enter a valid email.');
          return;
        }
        if (!isValidPhoneNumber(values.phone)) {
          showToast('Please enter a valid 10-digit phone number.');
          return;
        }
        const id = getNextBusinessId(businesses);
        const record = {
          id,
          name: String(values.name).trim(),
          owner: String(values.owner).trim(),
          adminName: String(values.adminName).trim(),
          type: String(values.type).trim(),
          email: String(values.email).trim(),
          phone: normalizePhoneDigits(values.phone),
          status: String(values.status).trim(),
          productsPlan: String(values.productsPlan).trim(),
          tenureMonths: Number(values.tenureMonths),
          storesCount: Number(values.storesCount),
          profit: Number(values.profit),
          paymentDue: Number(values.paymentDue),
          users: [{ name: String(values.adminName).trim(), role: 'Admin', status: 'Active' }],
          stores: [{ code: `${id}-S1`, city: 'Primary City', status: 'Active' }],
          payments: [{ month: 'Mar 2026', amount: 0, status: 'Due' }],
        };
        try {
          await create({
            name: record.name,
            owner: record.owner,
            adminName: record.adminName,
            type: record.type,
            email: record.email,
            phone: record.phone,
            productsPlan: record.productsPlan,
            tenureMonths: Number(record.tenureMonths),
            storesCount: Number(record.storesCount),
          }, {
            ...SUPERUSER,
            prepend: true,
            toRow: (created) => ({
              ...record,
              id: (created && created.id) || record.id,
              status: (created && created.status) || record.status,
            }),
          });
        } catch (error) {
          showMutationError('Business create', error);
          return;
        }
        renderPage();
        closeModal();
        showToast(`Business "${record.name}" created successfully.`);
      },
    });
  };

  const editBusiness = (id) => {
    if (!guard('Business update')) return;
    const existing = findBusiness(id);
    if (!existing) return;
    openQuickForm({
      title: `Edit Business - ${existing.name}`,
      submitLabel: 'Save Changes',
      fields: BUSINESS_FIELDS,
      initialValues: { ...existing, phone: normalizeEditablePhone(existing.phone) },
      onSubmit: async (values, closeModal) => {
        if (!isValidEmailAddress(values.email)) {
          showToast('Please enter a valid email.');
          return;
        }
        if (!isValidPhoneNumber(values.phone)) {
          showToast('Please enter a valid 10-digit phone number.');
          return;
        }
        const updated = {
          ...existing,
          name: String(values.name).trim(),
          owner: String(values.owner).trim(),
          adminName: String(values.adminName).trim(),
          type: String(values.type).trim(),
          email: String(values.email).trim(),
          phone: normalizePhoneDigits(values.phone),
          tenureMonths: Number(values.tenureMonths),
          storesCount: Number(values.storesCount),
          profit: Number(values.profit),
          paymentDue: Number(values.paymentDue),
          status: String(values.status).trim(),
          productsPlan: String(values.productsPlan).trim(),
        };
        try {
          await update(existing.id, {
            name: updated.name,
            owner: updated.owner,
            adminName: updated.adminName,
            type: updated.type,
            email: updated.email,
            phone: updated.phone,
            productsPlan: updated.productsPlan,
            tenureMonths: Number(updated.tenureMonths),
            storesCount: Number(updated.storesCount),
            profit: Number(updated.profit),
            paymentDue: Number(updated.paymentDue),
            status: updated.status,
          }, { ...SUPERUSER, apply: () => updated });
        } catch (error) {
          showMutationError('Business update', error);
          return;
        }
        // The original always switched to the details view after an edit.
        showDetails(updated.id);
        closeModal();
        showToast(`Business "${updated.name}" updated successfully.`);
      },
    });
  };

  const deleteBusiness = (id) => {
    if (!guard('Business delete')) return;
    const existing = findBusiness(id);
    if (!existing) return;
    openConfirm({
      title: 'Delete Business',
      message: `Delete Business ${existing.name}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        // Errors propagate: the confirm dialog shows "Action failed" and stays open.
        await remove(id, SUPERUSER);
        renderPage();
        showToast(`Business "${existing.name}" deleted.`);
        return true;
      },
    });
  };

  // add/edit/delete for one of the nested lists (users, stores, payments).
  const makeNestedActions = ({ key, fields, labels, addForm, editTitle, deleteConfirm }) => ({
    add: (businessId) => {
      if (!guard(`${labels.entity} create`)) return;
      const business = findBusiness(businessId);
      if (!business) return;
      const list = Array.isArray(business[key]) ? business[key] : [];
      openQuickForm({
        title: addForm.title,
        submitLabel: addForm.submitLabel,
        fields,
        initialValues: addForm.initialValues(business, list),
        onSubmit: async (values, closeModal) => {
          try {
            await saveSnapshot({ ...business, [key]: [...list, labels.toItem(values)] });
          } catch (error) {
            showMutationError(`${labels.entity} create`, error);
            return;
          }
          closeModal();
          showToast(labels.added);
        },
      });
    },
    edit: (businessId, index) => {
      if (!guard(`${labels.entity} update`)) return;
      const business = findBusiness(businessId);
      if (!business) return;
      const list = Array.isArray(business[key]) ? business[key] : [];
      const item = list[index];
      if (!item) return;
      openQuickForm({
        title: editTitle(item),
        submitLabel: 'Save Changes',
        fields,
        initialValues: item,
        onSubmit: async (values, closeModal) => {
          try {
            await saveSnapshot({ ...business, [key]: list.map((x, i) => (i === index ? labels.toItem(values) : x)) });
          } catch (error) {
            showMutationError(`${labels.entity} update`, error);
            return;
          }
          closeModal();
          showToast(labels.updated);
        },
      });
    },
    remove: (businessId, index) => {
      if (!guard(`${labels.entity} delete`)) return;
      const business = findBusiness(businessId);
      if (!business) return;
      const list = Array.isArray(business[key]) ? business[key] : [];
      const item = list[index];
      if (!item) return;
      openConfirm({
        title: deleteConfirm.title,
        message: deleteConfirm.message(item),
        confirmLabel: 'Delete',
        onConfirm: async () => {
          try {
            await saveSnapshot({ ...business, [key]: list.filter((_, i) => i !== index) });
          } catch (error) {
            showMutationError(`${labels.entity} delete`, error);
            return false;
          }
          showToast(labels.deleted);
          return true;
        },
      });
    },
  });

  const userActions = makeNestedActions({
    key: 'users',
    fields: USER_FIELDS,
    labels: {
      entity: 'Business user',
      added: 'Business user added.',
      updated: 'Business user updated.',
      deleted: 'Business user deleted.',
      toItem: (v) => ({ name: String(v.name).trim(), role: String(v.role).trim(), status: String(v.status).trim() }),
    },
    addForm: { title: 'Add Business User', submitLabel: 'Add User', initialValues: () => ({ role: 'Cashier', status: 'Active' }) },
    editTitle: (u) => `Edit User - ${u.name}`,
    deleteConfirm: { title: 'Delete Business User', message: (u) => `Delete user ${u.name}?` },
  });

  const storeActions = makeNestedActions({
    key: 'stores',
    fields: STORE_FIELDS,
    labels: {
      entity: 'Business store',
      added: 'Store added.',
      updated: 'Store updated.',
      deleted: 'Store deleted.',
      toItem: (v) => ({ code: String(v.code).trim(), city: String(v.city).trim(), status: String(v.status).trim() }),
    },
    addForm: {
      title: 'Add Store',
      submitLabel: 'Add Store',
      initialValues: (b, list) => ({ code: `${b.id}-S${list.length + 1}`, status: 'Active' }),
    },
    editTitle: (s) => `Edit Store - ${s.code}`,
    deleteConfirm: { title: 'Delete Store', message: (s) => `Delete store ${s.code}?` },
  });

  const paymentActions = makeNestedActions({
    key: 'payments',
    fields: PAYMENT_FIELDS,
    labels: {
      entity: 'Business payment',
      added: 'Payment entry added.',
      updated: 'Payment entry updated.',
      deleted: 'Payment entry deleted.',
      toItem: (v) => ({ month: String(v.month).trim(), amount: Number(v.amount), status: String(v.status).trim() }),
    },
    addForm: { title: 'Add Payment Entry', submitLabel: 'Add Payment', initialValues: () => ({ month: 'Apr 2026', amount: 0, status: 'Due' }) },
    editTitle: (p) => `Edit Payment - ${p.month}`,
    deleteConfirm: { title: 'Delete Payment Entry', message: (p) => `Delete payment record ${p.month}?` },
  });

  return {
    renderBusinessesHome,
    openBusinessDetails,
    openBusinessAdminDashboard,
    addBusiness,
    editBusiness,
    deleteBusiness,
    addBusinessUser: userActions.add,
    editBusinessUser: userActions.edit,
    deleteBusinessUser: userActions.remove,
    addBusinessStore: storeActions.add,
    editBusinessStore: storeActions.edit,
    deleteBusinessStore: storeActions.remove,
    addBusinessPayment: paymentActions.add,
    editBusinessPayment: paymentActions.edit,
    deleteBusinessPayment: paymentActions.remove,
  };
}
