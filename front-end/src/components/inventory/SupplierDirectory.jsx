// "Supplier Directory" card of renderInventory(): one row per distinct supplier name.
import DataTable from '../common/DataTable.jsx';
import { getSupplierDetails } from '../../lib/dashboard/helpers.js';

export default function SupplierDirectory({ inventory }) {
  const suppliers = Array.from(
    inventory.reduce((map, item) => {
      const details = getSupplierDetails(item);
      if (!map.has(details.name)) map.set(details.name, details);
      return map;
    }, new Map()).values(),
  );

  return (
    <section className="card"><div className="card-hd"><h3>Supplier Directory</h3></div><div className="card-bd">
      <DataTable
        columns={[
          { header: 'Supplier', key: 'name', cellClassName: 'cell-main' },
          { header: 'Contact Person', key: 'contact' },
          { header: 'Phone', key: 'phone' },
          { header: 'Email', key: 'email' },
          { header: 'Lead Time', render: (d) => `${d.leadTimeDays} days` },
          { header: 'MOQ', key: 'moq' },
          { header: 'Rating', render: (d) => `${d.rating.toFixed(1)} / 5` },
        ]}
        rows={suppliers}
        getRowKey={(d) => d.name}
        emptyMessage="No supplier details available."
      />
    </div></section>
  );
}
