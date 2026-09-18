// #inventoryTableBodyDyn table of renderInventory() (rows filtered/sorted by the page).
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';

const COLUMNS = ['SKU', 'Product', 'Category', 'Supplier', 'Supplier Contact', 'Lead Time', 'Stock', 'Unit Price', 'Status', 'Actions'];
const EDIT_STYLE = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const DELETE_STYLE = { padding: '4px 8px', fontSize: '0.75rem', color: 'var(--red)', borderColor: 'var(--red)' };

/**
 * rows      inventory rows with `supplierMeta` + `normalizedStatus`
 * canManage render Edit/Delete (hasActionAccess('inventory'))
 * onEdit(sku), onDelete(sku)
 */
export default function ProductTable({ rows, canManage, onEdit, onDelete }) {
  return (
    <section className="card"><div className="card-bd">
      <DataTable
        columns={COLUMNS}
        rows={rows}
        tbodyId="inventoryTableBodyDyn"
        emptyMessage="No inventory items match the selected filters."
        emptyColSpan={10}
        renderRow={(item, i) => (
          <tr key={`${item.sku}-${i}`}>
            <td className="cell-main">{item.sku}</td>
            <td>{item.name}</td>
            <td>{item.cat}</td>
            <td>{item.supplierMeta.name}</td>
            <td>{item.supplierMeta.contact}<div className="text-sm text-muted">{item.supplierMeta.phone}</div></td>
            <td>{item.supplierMeta.leadTimeDays} days</td>
            <td>{item.stock}</td>
            <td>Rs {Math.max(0, Number(item.price || 0)).toLocaleString()}</td>
            <td><Badge status={item.normalizedStatus} /></td>
            <td>
              {canManage && <button className="btn btn-outline" style={EDIT_STYLE} onClick={() => onEdit(item.sku)}>Edit</button>}
              {canManage && <button className="btn btn-outline" style={DELETE_STYLE} onClick={() => onDelete(item.sku)}>Delete</button>}
            </td>
          </tr>
        )}
      />
    </div></section>
  );
}
