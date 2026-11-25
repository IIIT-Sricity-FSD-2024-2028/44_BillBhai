import DataTable from '../../../shared/components/common/DataTable.jsx';
import Badge from '../../../shared/components/common/Badge.jsx';
import { rupees, shortDay } from '../../orders/components/orderFormat.js';

const r0 = (v) => rupees(v, { decimals: 0 });

export function DayTable({ days }) {
  return (
    <DataTable
      columns={[
        { header: 'Day', render: (d) => shortDay(d.day), cellClassName: 'cell-main' },
        { header: 'Bills', key: 'orders' },
        { header: 'Billed', render: (d) => r0(d.gross) },
        { header: 'Discount', render: (d) => r0(d.discount) },
        { header: 'Refunds', render: (d) => r0(d.refunds) },
        { header: 'Net', render: (d) => r0(d.net) },
      ]}
      rows={[...days].reverse()}
      getRowKey={(d) => d.day}
      emptyMessage="No sales in this period."
    />
  );
}

export function CashierTable({ rows }) {
  const total = rows.reduce((s, r) => s + r.net, 0) || 1;
  return (
    <DataTable
      columns={[
        { header: 'Billed by', key: 'staff', cellClassName: 'cell-main' },
        { header: 'Bills', key: 'orders' },
        { header: 'Net sales', render: (r) => r0(r.net) },
        { header: 'Avg bill', render: (r) => r0(r.orders ? r.net / r.orders : 0) },
      ]}
      rows={rows}
      getRowKey={(r) => r.staff}
      emptyMessage="No sales in this period."
    />
  );
}

export function ProductTable({ rows }) {
  return (
    <DataTable
      columns={[
        { header: '#', render: (_, i) => i + 1, cellClassName: 'cell-main' },
        { header: 'Product', key: 'productName' },
        { header: 'Units sold', key: 'quantity' },
        { header: 'Sales (after discount)', render: (r) => r0(r.sales) },
      ]}
      rows={rows}
      getRowKey={(r) => r.productId}
      emptyMessage="Nothing sold in this period."
    />
  );
}

export function CountTable({ counts, label, emptyMessage }) {
  const rows = Object.entries(counts || {})
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
  return (
    <DataTable
      columns={[
        { header: label, render: (r) => <Badge status={r.key} />, cellClassName: 'cell-main' },
        { header: 'Count', key: 'count' },
      ]}
      rows={rows}
      getRowKey={(r) => r.key}
      emptyMessage={emptyMessage}
    />
  );
}

export function LowStockTable({ rows, nameOf }) {
  return (
    <DataTable
      columns={[
        { header: 'Product', render: (r) => nameOf(r.productId), cellClassName: 'cell-main' },
        { header: 'On shelf', key: 'stockAvailable' },
        { header: 'Reorder at', key: 'reorderLevel' },
        { header: 'Status', render: (r) => <Badge status={r.status} /> },
      ]}
      rows={[...rows].sort((a, b) => a.stockAvailable - b.stockAvailable)}
      getRowKey={(r) => r.id}
      emptyMessage="Everything is above its reorder level."
    />
  );
}
