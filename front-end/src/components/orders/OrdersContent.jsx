import { useLayoutEffect, useMemo, useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import FilterToolbar from '../common/FilterToolbar.jsx';
import OrdersTable, { ORDERS_EMPTY_MESSAGE } from './OrdersTable.jsx';
import OrderBillModal from './OrderBillModal.jsx';
import { useDashboard, useOrders } from '../../lib/dashboard/hooks.js';
import { getState } from '../../lib/dashboard/store.js';
import { downloadCsv } from '../../lib/dashboard/csv.js';
import {
  getNextOrderId,
  normalizeOrderStatus,
  parseOrderDate,
} from '../../lib/dashboard/helpers.js';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'total_high', label: 'Total high-low' },
  { value: 'total_low', label: 'Total low-high' },
];

const CSV_COLUMNS = [
  { label: 'Order ID', value: (o) => o.id },
  { label: 'Customer', value: (o) => o.customer },
  { label: 'Items', value: (o) => o.items },
  { label: 'Total', value: (o) => o.total },
  { label: 'Payment', value: (o) => o.normalizedPayment },
  { label: 'Status', value: (o) => o.normalizedStatus },
  { label: 'Date', value: (o) => o.date },
];

function buildOrderRows(orders) {
  return orders.map((order) => ({
    ...order,
    normalizedStatus: normalizeOrderStatus(order && order.status),
    normalizedPayment: String((order && order.payment) || 'Pending').trim() || 'Pending',
    parsedDate: parseOrderDate(order && order.date),
  }));
}

function sortRows(sortKey) {
  const time = (row) => (row.parsedDate ? row.parsedDate.getTime() : 0) || 0;
  const total = (row) => Math.max(0, Number(row.total || 0));
  return (a, b) => {
    if (sortKey === 'oldest') return time(a) - time(b);
    if (sortKey === 'total_high') return total(b) - total(a);
    if (sortKey === 'total_low') return total(a) - total(b);
    return time(b) - time(a);
  };
}

function applyTablePatches(entries, patches) {
  const firstCell = (entry) =>
    entry.kind === 'empty' ? ORDERS_EMPTY_MESSAGE : String(entry.order.id);
  return patches.reduce((rows, patch) => {
    if (patch.type === 'delete') return rows.filter((entry) => firstCell(entry) !== patch.id);
    let last = -1;
    rows.forEach((entry, i) => {
      if (firstCell(entry) === patch.oid) last = i;
    });
    const saved = { kind: 'saved', order: patch.order };
    return last !== -1 ? rows.map((entry, i) => (i === last ? saved : entry)) : [saved, ...rows];
  }, entries);
}

export default function OrdersContent({ patches, onResetPatches, onTablePatch, onOpenModal }) {
  const { orders, hasActionAccess, hasOrderDeleteAccess, denyAction, openConfirm, showToast } =
    useDashboard();
  const { remove } = useOrders();

  const orderRows = useMemo(() => buildOrderRows(orders), [orders]);
  const [status, setStatus] = useState('all');
  const [payment, setPayment] = useState('all');
  const [sortKey, setSortKey] = useState('newest');
  const [query, setQuery] = useState('');
  const [billOrderId, setBillOrderId] = useState(null);

  useLayoutEffect(() => {
    onResetPatches();
  }, []);

  const withReset = (setter) => (value) => {
    setter(value);
    onResetPatches();
  };

  const statusOptions = Array.from(new Set(orderRows.map((item) => item.normalizedStatus))).sort();
  const paymentOptions = Array.from(
    new Set(orderRows.map((item) => item.normalizedPayment)),
  ).sort();

  const search = query.trim().toLowerCase();
  const filtered = orderRows
    .filter((item) => {
      if (status !== 'all' && item.normalizedStatus !== status) return false;
      if (payment !== 'all' && item.normalizedPayment !== payment) return false;
      if (search && !`${item.id} ${item.customer}`.toLowerCase().includes(search)) return false;
      return true;
    })
    .sort(sortRows(sortKey));
  const baseEntries = filtered.length
    ? filtered.map((order) => ({ kind: 'row', order }))
    : [{ kind: 'empty' }];
  const entries = applyTablePatches(baseEntries, patches);

  const canEdit = hasActionAccess('orders');
  const canDelete = hasOrderDeleteAccess();

  const openNewOrder = () => {
    if (!hasActionAccess('orders')) {
      denyAction('Order create');
      return;
    }
    onOpenModal({
      edit: false,
      values: {
        orderId: getNextOrderId(orders),
        customer: '',
        items: '',
        total: '',
        payment: '',
        status: 'Pending',
      },
    });
  };

  const editOrder = (id) => {
    if (!hasActionAccess('orders')) {
      denyAction('Order update');
      return;
    }
    const o = orders.find((item) => item.id === id);
    if (!o) return;
    onOpenModal({
      edit: true,
      values: {
        orderId: String(o.id),
        customer: String(o.customer),
        items: String(o.items),
        total: String(o.total),
        payment: String(o.payment),
        status: String(o.status),
      },
    });
  };

  const deleteOrder = (id) => {
    if (!hasActionAccess('orders') || !hasOrderDeleteAccess()) {
      denyAction('Order delete');
      return;
    }
    openConfirm({
      title: 'Delete Order',
      message: `Delete Order ${id}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        if (!getState().orders.some((item) => item.id === id)) return true;
        await remove(id);
        onTablePatch({ type: 'delete', id });
        showToast(`Order "${id}" deleted!`);
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
              onClick={() => downloadCsv('orders.csv', CSV_COLUMNS, filtered)}
            >
              Export CSV
            </button>
            {canEdit && (
              <button className="btn btn-primary" id="newOrderBtnDyn" onClick={openNewOrder}>
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
              value: status,
              onChange: withReset(setStatus),
              options: [{ value: 'all', label: 'All statuses' }, ...statusOptions],
            },
            {
              id: 'ordersPaymentFilter',
              label: 'Payment',
              value: payment,
              onChange: withReset(setPayment),
              options: [{ value: 'all', label: 'All payments' }, ...paymentOptions],
            },
            {
              id: 'ordersSortSelect',
              label: 'Sort by',
              value: sortKey,
              onChange: withReset(setSortKey),
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
              placeholder="Order ID or customer"
              value={query}
              onChange={(e) => withReset(setQuery)(e.target.value)}
            />
          </div>
        </FilterToolbar>
      </section>
      <OrdersTable
        rows={entries}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={editOrder}
        onDelete={deleteOrder}
        onViewBill={setBillOrderId}
      />
      <OrderBillModal orderId={billOrderId} onClose={() => setBillOrderId(null)} />
    </>
  );
}
