import DataTable from '../common/DataTable.jsx';
import OrderRow from './OrderRow.jsx';

export const ORDER_COLUMNS = ['ID', 'Customer', 'Type', 'Items', 'Total', 'Payment', 'Status', 'Date', 'Actions'];
export const ORDERS_EMPTY_MESSAGE = 'No orders match the selected filters.';

export default function OrdersTable({ rows, canEdit, isManager, onViewBill, onEdit, onCancel, onDelete }) {
  return (
    <section className="card">
      <div className="card-bd">
        <DataTable
          columns={ORDER_COLUMNS}
          rows={rows}
          pageSize={25}
          tbodyId="ordersTableBodyDyn"
          emptyMessage={ORDERS_EMPTY_MESSAGE}
          renderRow={(order) => (
            <OrderRow
              key={order.id}
              order={order}
              canEdit={canEdit}
              isManager={isManager}
              onViewBill={onViewBill}
              onEdit={onEdit}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          )}
        />
      </div>
    </section>
  );
}
