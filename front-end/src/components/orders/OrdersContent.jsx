import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../common/PageHeader.jsx';
import FilterToolbar from '../common/FilterToolbar.jsx';
import OrdersTable from './OrdersTable.jsx';
import OrderBillModal from './OrderBillModal.jsx';
import OrderFormModal from './OrderFormModal.jsx';
import OrderEditModal from './OrderEditModal.jsx';
import CancelOrderModal from './CancelOrderModal.jsx';
import AdvancedFilters from './AdvancedFilters.jsx';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { apiRequest } from '../../lib/dashboard/api.js';
import { downloadCsv } from '../../lib/dashboard/csv.js';
import {
  DEFAULT_FILTERS,
  ORDER_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SORT_OPTIONS,
  activeAdvancedCount,
  filterOrders,
  firstOrderByCustomer,
  sortOrders,
  summarise,
} from './orderFilters.js';
import { CHECKOUT_MODE_LABELS, dayKey, rupees } from './orderFormat.js';

const CSV_COLUMNS = [
  { label: 'Order ID', value: (o) => o.id },
  { label: 'Bill No', value: (o) => o.billNo },
  { label: 'Date', value: (o) => `${dayKey(o.orderDate)} ${new Date(o.orderDate).toTimeString().slice(0, 5)}` },
  { label: 'Customer', value: (o) => o.customer },
  { label: 'Phone', value: (o) => o.customerPhone },
  { label: 'Type', value: (o) => (o.orderType === 'delivery' ? 'Delivery' : 'Counter') },
  { label: 'Checkout', value: (o) => CHECKOUT_MODE_LABELS[o.checkoutMode] || o.checkoutMode },
  { label: 'Items', value: (o) => o.items },
  { label: 'Subtotal', value: (o) => o.subtotal },
  { label: 'Coupon', value: (o) => o.promoCode },
  { label: 'Discount', value: (o) => o.discount },
  { label: 'Delivery charge', value: (o) => o.deliveryCharge },
  { label: 'GST included', value: (o) => o.tax },
  { label: 'Total', value: (o) => o.total },
  { label: 'Refunded', value: (o) => o.refunded },
  { label: 'Net', value: (o) => o.net },
  { label: 'Payment', value: (o) => o.payment },
  { label: 'Payment status', value: (o) => o.paymentStatus },
  { label: 'Status', value: (o) => o.status },
  { label: 'Cashier', value: (o) => o.staffName },
];

const SUMMARY_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 18px',
  alignItems: 'center',
  fontSize: '0.82rem',
  marginBottom: '10px',
};

export default function OrdersContent() {
  const {
    orders,
    inventory,
    coupons,
    hasActionAccess,
    hasOrderDeleteAccess,
    openConfirm,
    showToast,
    showMutationError,
    refreshData,
  } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() => {
    const coupon = searchParams.get('coupon');
    return coupon ? { ...DEFAULT_FILTERS, coupon: coupon.toUpperCase() } : DEFAULT_FILTERS;
  });
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(searchParams.get('coupon')));
  const [billOrderId, setBillOrderId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  // A link such as /orders?coupon=FLAT50 (from the Coupons page) sets the
  // coupon filter. The code stays in the address while that filter is on, so
  // the page can be reloaded or shared; changing the filter updates it.
  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    if (key === 'coupon') {
      const next = new URLSearchParams(searchParams);
      if (value && value !== 'any' && value !== 'none' && value !== 'all') next.set('coupon', value);
      else next.delete('coupon');
      setSearchParams(next, { replace: true });
    }
  };

  const categoryById = useMemo(() => new Map(inventory.map((p) => [p.productId, p.cat])), [inventory]);
  const firstOrders = useMemo(() => firstOrderByCustomer(orders), [orders]);
  const filtered = sortOrders(
    filterOrders(orders, filters, { categoryOf: (id) => categoryById.get(id), firstOrders }),
    filters.sort,
  );
  const totals = summarise(filtered);
  const advancedCount = activeAdvancedCount(filters);

  const canCreate = hasActionAccess('orders');
  const isManager = hasOrderDeleteAccess();

  const findOrder = (id) => orders.find((o) => o.id === id);

  const deleteOrder = (id) => {
    openConfirm({
      title: 'Delete cancelled order',
      message: `Hide cancelled order ${id} from the list? It stays in the books and the stock history.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await apiRequest(`/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (err) {
          showMutationError('Delete', err);
          return false;
        }
        await refreshData();
        showToast(`Order ${id} deleted`);
        return true;
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <>
            <button
              className="btn btn-outline"
              onClick={() => downloadCsv(`orders-${dayKey(new Date())}.csv`, CSV_COLUMNS, filtered)}
            >
              Export CSV ({filtered.length})
            </button>
            {canCreate && (
              <button className="btn btn-primary" id="newOrderBtnDyn" onClick={() => setCreating(true)}>
                + New Order
              </button>
            )}
          </>
        }
      />
      <section className="card" style={{ marginBottom: '14px' }}>
        <FilterToolbar
          filters={[
            {
              id: 'ordersStatusFilter',
              label: 'Status',
              value: filters.status,
              onChange: (v) => setFilter('status', v),
              options: [{ value: 'all', label: 'All statuses' }, ...ORDER_STATUS_OPTIONS],
            },
            {
              id: 'ordersPaymentFilter',
              label: 'Payment',
              value: filters.payment,
              onChange: (v) => setFilter('payment', v),
              options: [{ value: 'all', label: 'All payments' }, ...PAYMENT_METHOD_OPTIONS],
            },
            {
              id: 'ordersSortSelect',
              label: 'Sort by',
              value: filters.sort,
              onChange: (v) => setFilter('sort', v),
              options: SORT_OPTIONS,
            },
          ]}
        >
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="ordersSearch">
              Search
            </label>
            <input
              id="ordersSearch"
              type="search"
              className="toolbar-select"
              placeholder="Order, bill, customer, phone"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <div className="toolbar-group" style={{ alignSelf: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-outline"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide' : 'More'} filters{advancedCount ? ` (${advancedCount} on)` : ''}
            </button>
          </div>
        </FilterToolbar>
        {showAdvanced && (
          <AdvancedFilters
            filters={filters}
            setFilter={setFilter}
            onClear={() => {
              setFilters((f) => ({ ...DEFAULT_FILTERS, status: f.status, payment: f.payment, search: f.search, sort: f.sort }));
              setSearchParams(new URLSearchParams(), { replace: true });
            }}
            orders={orders}
            inventory={inventory}
            coupons={coupons}
          />
        )}
      </section>
      <div style={SUMMARY_STYLE} aria-live="polite">
        <strong>
          {filtered.length} of {orders.length} orders
        </strong>
        <span>Billed {rupees(totals.billed)}</span>
        <span>Refunded {rupees(totals.refunded)}</span>
        <span>Net {rupees(totals.net)}</span>
        <span>Discount given {rupees(totals.discount)}</span>
        {totals.cancelled > 0 && <span className="text-muted">{totals.cancelled} cancelled (not counted)</span>}
      </div>
      <OrdersTable
        rows={filtered}
        canEdit={canCreate}
        isManager={isManager}
        onViewBill={setBillOrderId}
        onEdit={(id) => setEditing(findOrder(id) || null)}
        onCancel={(id) => setCancelling(findOrder(id) || null)}
        onDelete={deleteOrder}
      />
      <OrderBillModal
        orderId={billOrderId}
        onClose={() => setBillOrderId(null)}
        canEdit={canCreate}
        isManager={isManager}
        onEdit={(id) => {
          setBillOrderId(null);
          setEditing(findOrder(id) || null);
        }}
        onCancel={(id) => {
          setBillOrderId(null);
          setCancelling(findOrder(id) || null);
        }}
      />
      {creating && (
        <OrderFormModal
          onClose={() => setCreating(false)}
          onCreated={(order) => {
            setCreating(false);
            setBillOrderId(order.id);
          }}
        />
      )}
      {editing && <OrderEditModal order={editing} onClose={() => setEditing(null)} />}
      {cancelling && <CancelOrderModal order={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}
