import { useNavigate } from 'react-router-dom';
import { api, errorText } from '../../lib/http.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { setActiveBusiness } from '../../lib/dashboard/session.js';

export const PLAN_OPTIONS = [
  { value: 'starter', label: 'Starter (Free)' },
  { value: 'pro', label: 'Growth / Pro (₹1,999/mo)' },
  { value: 'enterprise', label: 'Enterprise (₹4,999/mo)' },
];

export const BUSINESS_STATUSES = ['Active', 'Paused', 'Suspended'];

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const PROFILE_FIELDS = [
  { name: 'name', label: 'Business name', type: 'text', required: true, maxLength: 80 },
  { name: 'type', label: 'Business type', type: 'text', required: true, maxLength: 60 },
  { name: 'owner', label: 'Owner name', type: 'text', required: true, maxLength: 80 },
  { name: 'email', label: 'Business email', type: 'email', required: true },
  { name: 'phone', label: 'Business phone', type: 'tel', required: true, maxLength: 10, inputMode: 'numeric', validation: 'phone' },
  { name: 'gstNo', label: 'GSTIN (optional)', type: 'text', maxLength: 15, placeholder: '07AABCF1234K1Z5' },
  { name: 'address', label: 'Address', type: 'text', maxLength: 250 },
];

function checkGstin(values) {
  const gst = String(values.gstNo || '').trim().toUpperCase();
  if (gst && !GSTIN_RE.test(gst)) throw new Error('GSTIN must be 15 characters, like 07AABCF1234K1Z5.');
  return gst;
}

/**
 * Super user actions on businesses. Everything is saved through the server
 * and the portal then reloads the company records it shows.
 */
export default function useBusinessActions({ companies, reload, showDetails }) {
  const navigate = useNavigate();
  const { hasActionAccess, denyAction, showToast, openQuickForm, openConfirm, refreshData } = useDashboard();

  const guard = (label) => {
    if (hasActionAccess('businesses')) return true;
    denyAction(label);
    return false;
  };
  const find = (id) => companies.find((c) => c.id === id);
  const after = async (message) => {
    await reload();
    refreshData();
    if (message) showToast(message);
  };
  const put = (company, body) =>
    api(`/companies/${encodeURIComponent(company.id)}`, { method: 'PUT', body: { ...body, version: company.version } });

  /** Opens that business's own screens (dashboard, users…) as the super user. */
  const openBusiness = (id, path = '/dashboard') => {
    const company = find(id);
    if (!company) return;
    setActiveBusiness(company.id, company.name);
    navigate(path);
  };

  const addBusiness = () => {
    if (!guard('Business create')) return;
    openQuickForm({
      title: 'Add Business',
      submitLabel: 'Create Business',
      fields: [
        ...PROFILE_FIELDS,
        { name: 'plan', label: 'Plan', type: 'select', required: true, options: PLAN_OPTIONS },
        { name: 'storesCount', label: 'Number of stores', type: 'number', required: true, min: 1 },
      ],
      initialValues: { plan: 'starter', storesCount: 1 },
      onSubmit: async (values, close) => {
        try {
          const gstNo = checkGstin(values);
          const created = await api('/companies', {
            method: 'POST',
            body: {
              name: values.name,
              type: values.type,
              owner: values.owner,
              email: values.email,
              phone: values.phone,
              gstNo,
              address: values.address,
              plan: values.plan,
              storesCount: Number(values.storesCount) || 1,
            },
          });
          close();
          await after(`${created.name} created. Add its admin from Manage users.`);
        } catch (err) {
          showToast(`Create failed: ${errorText(err)}`);
          throw err;
        }
      },
    });
  };

  const editBusiness = (id) => {
    if (!guard('Business update')) return;
    const c = find(id);
    if (!c) return;
    openQuickForm({
      title: `Edit ${c.name}`,
      submitLabel: 'Save',
      fields: [
        ...PROFILE_FIELDS,
        { name: 'status', label: 'Status', type: 'select', required: true, options: BUSINESS_STATUSES },
        { name: 'storesCount', label: 'Number of stores', type: 'number', required: true, min: 0 },
        { name: 'tenureMonths', label: 'Months on BillBhai', type: 'number', required: true, min: 0 },
        { name: 'paymentDue', label: 'Payment due (₹)', type: 'number', required: true, min: 0, step: 0.01 },
      ],
      initialValues: {
        name: c.name,
        type: c.type,
        owner: c.owner,
        email: c.email,
        phone: String(c.phone || '').replace(/\D/g, '').slice(-10),
        gstNo: c.gstNo || '',
        address: c.address || '',
        status: c.status,
        storesCount: c.storesCount,
        tenureMonths: c.tenureMonths,
        paymentDue: c.paymentDue,
      },
      onSubmit: async (values, close) => {
        try {
          const gstNo = checkGstin(values);
          await put(c, {
            name: values.name,
            type: values.type,
            owner: values.owner,
            email: values.email,
            phone: values.phone,
            gstNo,
            address: values.address,
            status: values.status,
            storesCount: Number(values.storesCount) || 0,
            tenureMonths: Number(values.tenureMonths) || 0,
            paymentDue: Number(values.paymentDue) || 0,
          });
          close();
          await after(`${values.name} updated`);
        } catch (err) {
          showToast(`Save failed: ${errorText(err)}`);
          throw err;
        }
      },
    });
  };

  const setStatus = (id, status) => {
    if (!guard('Business status')) return;
    const c = find(id);
    if (!c) return;
    const pausing = status !== 'Active';
    openConfirm({
      title: pausing ? `${status === 'Paused' ? 'Pause' : 'Suspend'} ${c.name}` : `Resume ${c.name}`,
      message: pausing
        ? `${c.name}'s staff will not be able to sign in until it is resumed. Their data is kept.`
        : `${c.name}'s staff will be able to sign in again.`,
      confirmLabel: pausing ? (status === 'Paused' ? 'Pause' : 'Suspend') : 'Resume',
      onConfirm: async () => {
        try {
          await put(c, { status });
          await after(`${c.name} is now ${status}`);
          return true;
        } catch (err) {
          showToast(`Failed: ${errorText(err)}`);
          return false;
        }
      },
    });
  };

  const changePlan = (id) => {
    if (!guard('Plan change')) return;
    const c = find(id);
    if (!c) return;
    openQuickForm({
      title: `Plan for ${c.name}`,
      submitLabel: 'Change plan',
      fields: [{ name: 'plan', label: 'Plan', type: 'select', required: true, options: PLAN_OPTIONS }],
      initialValues: { plan: c.plan || 'pro' },
      onSubmit: async (values, close) => {
        try {
          await api(`/companies/${encodeURIComponent(c.id)}/plan`, { method: 'POST', body: { plan: values.plan } });
          close();
          await after(`${c.name} moved to ${values.plan}`);
        } catch (err) {
          showToast(`Plan change failed: ${errorText(err)}`);
          throw err;
        }
      },
    });
  };

  const cancelSubscription = (id) => {
    if (!guard('Cancel subscription')) return;
    const c = find(id);
    if (!c) return;
    openConfirm({
      title: `Cancel subscription of ${c.name}`,
      message: 'The subscription is marked cancelled. The business keeps working until you pause it.',
      confirmLabel: 'Cancel subscription',
      onConfirm: async () => {
        try {
          await api(`/companies/${encodeURIComponent(c.id)}/cancel-subscription`, { method: 'POST', body: {} });
          await after('Subscription cancelled');
          return true;
        } catch (err) {
          showToast(`Failed: ${errorText(err)}`);
          return false;
        }
      },
    });
  };

  const deleteBusiness = (id) => {
    if (!guard('Business delete')) return;
    const c = find(id);
    if (!c) return;
    openConfirm({
      title: 'Delete Business',
      message: `Delete ${c.name}? All its staff accounts are suspended and it disappears from this list. This cannot be undone; pausing is safer.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api(`/companies/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
          showDetails(null);
          await after(`${c.name} deleted`);
          return true;
        } catch (err) {
          showToast(`Delete failed: ${errorText(err)}`);
          return false;
        }
      },
    });
  };

  /** Edits one entry of a list kept on the company record (stores, payments). */
  const editListEntry = (id, listKey, index, fields, label) => {
    if (!guard(`${label} update`)) return;
    const c = find(id);
    if (!c) return;
    const list = Array.isArray(c[listKey]) ? c[listKey] : [];
    const current = index === null ? {} : list[index] || {};
    openQuickForm({
      title: index === null ? `Add ${label}` : `Edit ${label}`,
      submitLabel: 'Save',
      fields,
      initialValues: current,
      onSubmit: async (values, close) => {
        const entry = { ...current, ...values };
        const next = index === null ? [...list, entry] : list.map((item, i) => (i === index ? entry : item));
        const body = { [listKey]: next };
        if (listKey === 'stores') body.storesCount = next.length;
        if (listKey === 'payments') {
          body.paymentDue = next
            .filter((p) => String(p.status).toLowerCase() !== 'paid')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        }
        try {
          await put(c, body);
          close();
          await after(`${label} saved`);
        } catch (err) {
          showToast(`Save failed: ${errorText(err)}`);
          throw err;
        }
      },
    });
  };

  const deleteListEntry = (id, listKey, index, label) => {
    if (!guard(`${label} delete`)) return;
    const c = find(id);
    if (!c) return;
    const list = Array.isArray(c[listKey]) ? c[listKey] : [];
    openConfirm({
      title: `Delete ${label}`,
      message: `Delete this ${label.toLowerCase()}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const next = list.filter((_, i) => i !== index);
        const body = { [listKey]: next };
        if (listKey === 'stores') body.storesCount = next.length;
        if (listKey === 'payments') {
          body.paymentDue = next
            .filter((p) => String(p.status).toLowerCase() !== 'paid')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        }
        try {
          await put(c, body);
          await after(`${label} deleted`);
          return true;
        } catch (err) {
          showToast(`Delete failed: ${errorText(err)}`);
          return false;
        }
      },
    });
  };

  const STORE_FIELDS = [
    { name: 'code', label: 'Store code', type: 'text', required: true, maxLength: 20 },
    { name: 'city', label: 'City', type: 'text', required: true, maxLength: 60 },
    { name: 'status', label: 'Status', type: 'select', required: true, options: ['Active', 'Maintenance', 'Closed'] },
  ];
  const PAYMENT_FIELDS = [
    { name: 'month', label: 'Billing month (YYYY-MM)', type: 'month', required: true },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 0, step: 0.01 },
    { name: 'status', label: 'Status', type: 'select', required: true, options: ['Paid', 'Partial', 'Due'] },
  ];

  return {
    openBusiness,
    openBusinessDetails: (id) => guard('Business detail') && showDetails(id),
    backToList: () => showDetails(null),
    addBusiness,
    editBusiness,
    setStatus,
    changePlan,
    cancelSubscription,
    deleteBusiness,
    addStore: (id) => editListEntry(id, 'stores', null, STORE_FIELDS, 'Store'),
    editStore: (id, i) => editListEntry(id, 'stores', i, STORE_FIELDS, 'Store'),
    deleteStore: (id, i) => deleteListEntry(id, 'stores', i, 'Store'),
    addPayment: (id) => editListEntry(id, 'payments', null, PAYMENT_FIELDS, 'Payment'),
    editPayment: (id, i) => editListEntry(id, 'payments', i, PAYMENT_FIELDS, 'Payment'),
    deletePayment: (id, i) => deleteListEntry(id, 'payments', i, 'Payment'),
  };
}
