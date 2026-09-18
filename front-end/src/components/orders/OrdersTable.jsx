import DataTable from '../common/DataTable.jsx';
import OrderRow from './OrderRow.jsx';

export const ORDER_COLUMNS = ['ID', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Date', 'Actions'];
export const ORDERS_EMPTY_MESSAGE = 'No orders match the selected filters.';

/**
 * `<section class="card"><div class="card-bd">` + the orders table.
 * `rows` are table entries: { kind: 'row' | 'saved', order } or { kind: 'empty' }
 * (the "No orders match" row, which later saved rows are inserted before).
 */
export default function OrdersTable({ rows, canEdit, canDelete, onEdit, onDelete }) {
  return (
    <section className="card">
      <div className="card-bd">
        <DataTable
          columns={ORDER_COLUMNS}
          rows={rows}
          tbodyId="ordersTableBodyDyn"
          renderRow={(entry, index) => (entry.kind === 'empty'
            ? <tr key={`empty-${index}`}><td colSpan={8} className="text-muted">{ORDERS_EMPTY_MESSAGE}</td></tr>
            : (
              <OrderRow
                key={`${entry.kind}-${entry.order.id}-${index}`}
                order={entry.order}
                saved={entry.kind === 'saved'}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
        />
      </div>
    </section>
  );
}
