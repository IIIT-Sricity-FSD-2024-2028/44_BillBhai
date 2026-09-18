import DataTable from '../common/DataTable.jsx';

const money = (value) => `Rs ${Math.round(value).toLocaleString()}`;

/** #reportsSupplierTableBody rows. */
export function SupplierTable({ rows }) {
  return (
    <DataTable
      columns={[
        { header: 'Rank', render: (_, i) => `#${i + 1}`, cellClassName: 'cell-main' },
        { header: 'Supplier', key: 'supplier' },
        { header: 'SKUs', key: 'skus' },
        { header: 'Avg Price', render: (r) => money(r.avgPrice) },
        { header: 'Stock Value', render: (r) => money(r.stockValue) },
      ]}
      rows={rows}
      getRowKey={(r) => r.supplier}
      tbodyId="reportsSupplierTableBody"
      emptyMessage="No supplier records available."
    />
  );
}

/** #reportsSummaryTableBody rows (one per period bucket). */
export function SummaryTable({ rows }) {
  return (
    <DataTable
      columns={[
        { header: 'Period', key: 'label', cellClassName: 'cell-main' },
        { header: 'Revenue', render: (r) => money(r.revenue) },
        { header: 'Orders', key: 'orders' },
        { header: 'Returns', key: 'returns' },
        { header: 'Net', render: (r) => money(r.net) },
      ]}
      rows={rows}
      getRowKey={(r) => r.key}
      tbodyId="reportsSummaryTableBody"
      emptyMessage="No report data available in this range."
    />
  );
}
