// Static #newOrderModal of orders.html + openNewOrderModal() /
// closeNewOrderModal() / handleNewOrder() of dashboard.js (create + edit).
import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import FormField, { controlClass } from '../common/FormField.jsx';
import LegacySelect, { effectiveSelectValue } from '../common/LegacySelect.jsx';
import { useDashboard, useOrders, useSession } from '../../lib/dashboard/hooks.js';
import { loadObject } from '../../lib/dashboard/storage.js';
import { formatBackendDate, formatDate, getNextOrderId } from '../../lib/dashboard/helpers.js';

const PAYMENT_OPTIONS = [{ value: '', label: 'Select method' }, 'UPI', 'Cash', 'Card'];
const STATUS_OPTIONS = ['Pending', 'Processing', 'Delivered', 'Cancelled'];

const CHECKS = {
  customer: (v) => v.trim() !== '',
  items: (v) => v !== '' && parseInt(v, 10) >= 1,
  total: (v) => v !== '' && parseFloat(v) >= 0,
  payment: (v) => v !== '',
};

/**
 * Props
 *  open      `.active` on the overlay
 *  request   { id, values } - every new request re-runs the reset of openNewOrderModal()
 *            (editOrder() passes the order's values)
 *  title     heading text (editOrder() changed it to "Edit Order" and nothing changed it back)
 *  onClose   closeNewOrderModal()
 *  onSaved   (formOrderId, order) after a successful save - the page writes the row into the table
 */
export default function OrderFormModal({ open, request, title, onClose, onSaved }) {
  const { hasActionAccess, denyAction, inventory, apiRequest, showMutationError, showToast } = useDashboard();
  const { activeBusinessId } = useSession();
  const { rows: orders, setRows } = useOrders();

  const [values, setValues] = useState({ orderId: '', customer: '', items: '', total: '', payment: '', status: 'Pending' });
  const [errors, setErrors] = useState({});
  const [seenRequest, setSeenRequest] = useState(null);

  if (request && request.id !== seenRequest) {
    setSeenRequest(request.id);
    setValues(request.values);
    setErrors({});
  }

  // 'input' listener on every .form-control: drop the field's error state.
  const bind = (key) => ({
    value: values[key],
    onChange: (e) => {
      const next = e.target.value;
      setValues((v) => ({ ...v, [key]: next }));
      setErrors((errs) => (errs[key] ? { ...errs, [key]: false } : errs));
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasActionAccess('orders')) {
      denyAction('Order create/update');
      return;
    }
    // What the original read back from the DOM controls.
    const dom = {
      ...values,
      payment: effectiveSelectValue(PAYMENT_OPTIONS, values.payment),
      status: effectiveSelectValue(STATUS_OPTIONS, values.status),
    };
    const nextErrors = {};
    Object.keys(CHECKS).forEach((key) => { nextErrors[key] = !CHECKS[key](dom[key]); });
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const oid = dom.orderId || getNextOrderId(orders);
    const existingIdx = orders.findIndex((o) => o.id === oid);
    const existingOrder = existingIdx !== -1 ? orders[existingIdx] : null;

    const oData = {
      id: oid,
      customer: dom.customer.trim(),
      items: parseInt(dom.items, 10),
      total: parseFloat(dom.total),
      payment: dom.payment,
      status: dom.status,
      date: existingIdx !== -1 ? orders[existingIdx].date : formatDate(),
    };

    const activeCompanyId = String(activeBusinessId || 'BIZ-101').trim() || 'BIZ-101';
    // Session user id: not exposed by useSession() yet (see report), read through the engine helper.
    const activeUser = loadObject('currentUser', {});
    const fallbackProduct = inventory.find((item) => String((item && item.productId) || '').trim());
    const fallbackProductId = String((fallbackProduct && fallbackProduct.productId) || 'P001').trim() || 'P001';
    const totalItems = Math.max(1, Number(oData.items) || 1);
    const totalValue = Math.max(0, Number(oData.total) || 0);

    try {
      if (existingOrder && existingOrder.id) {
        const backendOrder = await apiRequest(`/orders/${encodeURIComponent(String(existingOrder.id))}`, {
          method: 'PUT',
          body: {
            status: oData.status,
            paymentMethod: oData.payment,
            customerName: oData.customer,
            itemsCount: totalItems,
            total: totalValue,
          },
        });
        if (backendOrder && typeof backendOrder === 'object') {
          oData.customer = String(backendOrder.customerName || oData.customer).trim();
          oData.items = Math.max(0, Number(backendOrder.itemsCount || oData.items || totalItems));
          oData.total = Math.max(0, Number(backendOrder.total || oData.total));
          oData.payment = String(backendOrder.paymentMethod || oData.payment).trim();
          oData.status = String(backendOrder.status || oData.status).trim();
          oData.date = backendOrder.orderDate ? formatBackendDate(backendOrder.orderDate) : oData.date;
        }
      } else {
        const customerRows = await apiRequest(`/customers?companyId=${encodeURIComponent(activeCompanyId)}`, { role: 'cashier' });
        const normalizedName = String(oData.customer || '').trim().toLowerCase();
        let customer = (Array.isArray(customerRows) ? customerRows : []).find((row) =>
          String((row && row.name) || '').trim().toLowerCase() === normalizedName);
        if (!customer) {
          const generatedPhone = `9${Date.now().toString().slice(-9)}`;
          customer = await apiRequest('/customers', {
            method: 'POST',
            body: { companyId: activeCompanyId, name: oData.customer, mobileNo: generatedPhone },
          });
        }
        const unitPrice = totalItems > 0 ? Number((totalValue / totalItems).toFixed(2)) : totalValue;
        const paymentToken = String(oData.payment || '').toLowerCase();
        const checkoutMode = paymentToken.includes('cod')
          ? 'cod_delivery'
          : (paymentToken.includes('paid') || paymentToken.includes('upi') || paymentToken.includes('card')
            ? 'prepaid_delivery'
            : 'takeaway_now');
        const orderType = checkoutMode === 'takeaway_now' ? 'pickup' : 'delivery';

        const createdOrder = await apiRequest('/orders', {
          method: 'POST',
          body: {
            customerId: String((customer && customer.id) || 'CUS-001').trim() || 'CUS-001',
            staffId: String(activeUser.id || 'USR-002').trim() || 'USR-002',
            companyId: activeCompanyId,
            orderType,
            checkoutMode,
            paymentMethod: oData.payment,
            discountAmount: 0,
            items: [{ productId: fallbackProductId, quantity: totalItems, itemPrice: unitPrice }],
          },
        });
        if (createdOrder && createdOrder.id) oData.id = createdOrder.id;
      }
    } catch (error) {
      showMutationError('Order save', error);
      return;
    }

    setRows((rows) => {
      const idx = rows.findIndex((o) => o.id === oid);
      if (existingIdx !== -1 && idx !== -1) return rows.map((o, i) => (i === idx ? oData : o));
      return [oData, ...rows];
    });

    onSaved(oid, oData);
    onClose();
    showToast(`Order "${oData.id}" saved successfully!`);
  };

  return (
    <Modal open={open} id="newOrderModal" title={title} onClose={onClose} closeButtonId="orderModalClose" closeButtonType={null}>
      <form id="newOrderForm" noValidate onSubmit={handleSubmit}>
        <div className="modal-body">
          <FormField label="Customer Name *" htmlFor="orderCustomer" error="Customer name is required" hasError={errors.customer}>
            <input type="text" className={controlClass(errors.customer)} id="orderCustomer" placeholder="e.g. Rahul Sharma" required {...bind('customer')} />
          </FormField>
          <div className="form-row">
            <FormField label="Order ID" htmlFor="orderId" hint="Auto-generated">
              <input type="text" className="form-control" id="orderId" placeholder="Auto-generated" readOnly value={values.orderId} />
            </FormField>
            <FormField label="No. of Items *" htmlFor="orderItems" error="Enter number of items" hasError={errors.items}>
              <input type="number" className={controlClass(errors.items)} id="orderItems" placeholder="1" min="1" step="1" required {...bind('items')} />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Total Amount (?) *" htmlFor="orderTotal" error="Enter a valid amount" hasError={errors.total}>
              <input type="number" className={controlClass(errors.total)} id="orderTotal" placeholder="0.00" min="0" step="0.01" required {...bind('total')} />
            </FormField>
            <FormField label="Payment Method *" htmlFor="orderPayment" error="Select payment method" hasError={errors.payment}>
              <LegacySelect className={controlClass(errors.payment)} id="orderPayment" required options={PAYMENT_OPTIONS} {...bind('payment')} />
            </FormField>
          </div>
          <FormField label="Order Status" htmlFor="orderStatus">
            <LegacySelect className="form-control" id="orderStatus" options={STATUS_OPTIONS} {...bind('status')} />
          </FormField>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" id="orderModalCancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create Order</button>
        </div>
      </form>
    </Modal>
  );
}
