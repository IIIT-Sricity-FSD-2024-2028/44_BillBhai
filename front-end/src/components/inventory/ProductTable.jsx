import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';
import { DANGER_BTN, SMALL_BTN, formatMobile, money } from './inventoryUtils.js';

const COLUMNS = ['SKU', 'Product', 'Supplier', 'Stock', 'Reorder at', 'Unit price', 'Status', 'Actions'];

export default function ProductTable({ rows, canManage, onEdit, onReceive, onAdjust, onHistory, onDeactivate, onReactivate }) {
  return (
    <section className="card">
      <div className="card-bd">
        <DataTable
          columns={COLUMNS}
          rows={rows}
          tbodyId="inventoryTableBodyDyn"
          emptyMessage="No products match the selected filters."
          emptyColSpan={COLUMNS.length}
          renderRow={(item) => (
            <tr key={item.productId} style={item.active ? undefined : { opacity: 0.55 }}>
              <td className="cell-main">
                {item.productId}
                {item.barcode && <div className="text-sm text-muted">{item.barcode}</div>}
              </td>
              <td>
                {item.name}
                {item.size && <span className="text-muted"> · {item.size}</span>}
                <div className="text-sm text-muted">
                  {item.cat} · {item.location} · GST {item.gstRate}%
                </div>
              </td>
              <td>
                {item.supplier || '—'}
                {item.supplierContact && <div className="text-sm text-muted">{item.supplierContact}</div>}
                {item.supplierPhone && <div className="text-sm text-muted nowrap">{formatMobile(item.supplierPhone)}</div>}
              </td>
              <td>
                <strong>{item.stock}</strong>
              </td>
              <td>{item.reorderLevel}</td>
              <td className="nowrap">
                {money(item.price)}
                {item.costPrice !== undefined && item.costPrice !== null && (
                  <div className="text-sm text-muted">cost {money(item.costPrice)}</div>
                )}
              </td>
              <td>
                {item.active ? <Badge status={item.status} /> : <Badge status="Inactive" />}
              </td>
              <td>
                <div className="row-actions">
                {canManage && item.active && (
                  <>
                    <button className="btn btn-outline" style={SMALL_BTN} onClick={() => onReceive(item)}>
                      Receive
                    </button>
                    <button className="btn btn-outline" style={SMALL_BTN} onClick={() => onAdjust(item)}>
                      Adjust
                    </button>
                    <button className="btn btn-outline" style={SMALL_BTN} onClick={() => onEdit(item)}>
                      Edit
                    </button>
                  </>
                )}
                <button className="btn btn-outline" style={SMALL_BTN} onClick={() => onHistory(item)}>
                  History
                </button>
                {canManage &&
                  (item.active ? (
                    <button className="btn btn-outline" style={DANGER_BTN} onClick={() => onDeactivate(item)}>
                      Deactivate
                    </button>
                  ) : (
                    <button className="btn btn-outline" style={SMALL_BTN} onClick={() => onReactivate(item)}>
                      Reactivate
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          )}
        />
      </div>
    </section>
  );
}
