import { useEffect, useMemo } from 'react';
import useViewState from '../../../shared/hooks/useViewState.js';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import PageHeader from '../../../shared/components/common/PageHeader.jsx';
import FilterToolbar from '../../../shared/components/common/FilterToolbar.jsx';
import OrdersTable from './OrdersTable.jsx';
import OrderBillModal from './OrderBillModal.jsx';
import OrderFormModal from './OrderFormModal.jsx';
import OrderEditModal from './OrderEditModal.jsx';
import CancelOrderModal from './CancelOrderModal.jsx';
import AdvancedFilters from './AdvancedFilters.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { downloadCsv } from '../../../shared/lib/dashboard/csv.js';
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SORT_OPTIONS,
  activeAdvancedCount,
  filterOrders,
  firstOrderByCustomer,
  sortOrders,
  summarise,
} from './orderFilters.js';
import { CHECKOUT_MODE_LABELS, dayKey, rupees, scopedCompanyId } from './orderFormat.js';
import { useCurrency } from '../../../shared/lib/currency.js';
import {
  fetchOrdersThunk,
  deleteOrderThunk,
  setFilter,
  resetFilters,
  setSelectedOrder,
  clearSelectedOrder,
  selectAllOrders,
  selectOrderFilters,
  selectSelectedOrderId,
} from '../ordersSlice.js';

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
  useCurrency();
  const dispatch = useDispatch();
  const reduxOrders = useSelector(selectAllOrders);
  const filters = useSelector(selectOrderFilters);
  const selectedOrderId = useSelector(selectSelectedOrderId);

  const {
    state,
    orders: dashboardOrders,
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
  const companyId = scopedCompanyId(state);

  useEffect(() => {
    dispatch(fetchOrdersThunk(companyId ? { companyId } : undefined));
  }, [dispatch, companyId]);

  const urlCoupon = searchParams.get('coupon');
  useEffect(() => {
    const special = urlCoupon && ['any', 'none'].includes(urlCoupon.toLowerCase());
    const value = !urlCoupon ? 'all' : special ? urlCoupon.toLowerCase() : urlCoupon.toUpperCase();
    dispatch(setFilter({ key: 'coupon', value }));
    // run when the address changes, not when the dropdown changes the filter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCoupon]);

  // Use redux orders once fetched; fallback gracefully to dashboard orders if available
  const orders = reduxOrders.length > 0 ? reduxOrders : (dashboardOrders || []);

  const [showAdvanced, setShowAdvanced] = useViewState(() => Boolean(searchParams.get('coupon')));
  const [creating, setCreating] = useViewState(false);
  const [editing, setEditing] = useViewState(null);
  const [cancelling, setCancelling] = useViewState(null);

  // A link such as /orders?coupon=FLAT50 (from the Coupons page) sets the
  // coupon filter. The code stays in the address while that filter is on, so
  // the page can be reloaded or shared; changing the filter updates it.
  const handleSetFilter = (key, value) => {
    dispatch(setFilter({ key, value }));
    if (key === 'coupon') {
      const next = new URLSearchParams(searchParams);
      if (value && value !== 'all') next.set('coupon', value);
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
          await dispatch(deleteOrderThunk(id)).unwrap();
          await refreshData();
          showToast(`Order ${id} deleted`);
          return true;
        } catch (err) {
          showMutationError('Delete', err);
          return false;
        }
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
              onChange: (v) => handleSetFilter('status', v),
              options: [{ value: 'all', label: 'All statuses' }, ...ORDER_STATUS_OPTIONS],
            },
            {
              id: 'ordersPaymentFilter',
              label: 'Payment',
              value: filters.payment,
              onChange: (v) => handleSetFilter('payment', v),
              options: [{ value: 'all', label: 'All payments' }, ...PAYMENT_METHOD_OPTIONS],
            },
            {
              id: 'ordersSortSelect',
              label: 'Sort by',
              value: filters.sort,
              onChange: (v) => handleSetFilter('sort', v),
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
              onChange={(e) => handleSetFilter('search', e.target.value)}
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
            setFilter={handleSetFilter}
            onClear={() => {
              dispatch(resetFilters());
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
        onViewBill={(id) => dispatch(setSelectedOrder(id))}
        onEdit={(id) => setEditing(findOrder(id) || null)}
        onCancel={(id) => setCancelling(findOrder(id) || null)}
        onDelete={deleteOrder}
      />
      <OrderBillModal
        orderId={selectedOrderId}
        onClose={() => dispatch(clearSelectedOrder())}
        canEdit={canCreate}
        isManager={isManager}
        onEdit={(id) => {
          dispatch(clearSelectedOrder());
          setEditing(findOrder(id) || null);
        }}
        onCancel={(id) => {
          dispatch(clearSelectedOrder());
          setCancelling(findOrder(id) || null);
        }}
      />
      {creating && (
        <OrderFormModal
          onClose={() => setCreating(false)}
          onCreated={(order) => {
            setCreating(false);
            dispatch(setSelectedOrder(order.id));
            dispatch(fetchOrdersThunk(companyId ? { companyId } : undefined));
          }}
        />
      )}
      {editing && <OrderEditModal order={editing} onClose={() => setEditing(null)} />}
      {cancelling && <CancelOrderModal order={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}
