import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';
import { SMALL_BTN, formatMobile, isBelowReorder, money, suggestedOrderQty } from './inventoryUtils.js';

/** Products at or below their reorder level, with how much to order and from whom. */
export default function ReorderList({ inventory, canManage, onReceive }) {
  const rows = inventory
    .filter((item) => item.active && isBelowReorder(item))
    .map((item) => ({ ...item, suggested: suggestedOrderQty(item) }))
    .sort((a, b) => a.stock / Math.max(1, a.reorderLevel) - b.stock / Math.max(1, b.reorderLevel));

  const bySupplier = rows.reduce((map, item) => {
    const key = item.supplier || 'No supplier';
    const entry = map.get(key) || { supplier: key, lines: 0, units: 0, value: 0 };
    entry.lines += 1;
    entry.units += item.suggested;
    entry.value += item.suggested * Number(item.costPrice ?? item.price ?? 0);
    map.set(key, entry);
    return map;
  }, new Map());

  return (
    <>
      <section className="card">
        <div className="card-hd">
          <h3>Reorder list ({rows.length})</h3>
          <span className="text-sm text-muted">Suggested quantity brings stock back to twice the reorder level, never below the supplier's minimum order.</span>
        </div>
        <div className="card-bd">
          <DataTable
            columns={[
              { header: 'Product', render: (i) => (<>{i.name}<div className="text-sm text-muted">{i.productId}</div></>) },
              { header: 'Stock', render: (i) => <strong>{i.stock}</strong> },
              { header: 'Reorder at', key: 'reorderLevel' },
              { header: 'Status', render: (i) => <Badge status={i.status} /> },
              {
                header: 'Supplier',
                render: (i) => (
                  <>
                    {i.supplier || '—'}
                    <div className="text-sm text-muted">{formatMobile(i.supplierPhone)}</div>
                  </>
                ),
              },
              { header: 'Lead time', render: (i) => (i.leadTimeDays !== undefined && i.leadTimeDays !== null ? `${i.leadTimeDays} days` : '—') },
              { header: 'Min. order', render: (i) => i.moq || '—' },
              { header: 'Order qty', render: (i) => <strong>{i.suggested}</strong> },
              {
                header: '',
                render: (i) =>
                  canManage ? (
                    <button className="btn btn-primary" style={SMALL_BTN} onClick={() => onReceive(i, i.suggested)}>
                      Receive
                    </button>
                  ) : null,
              },
            ]}
            rows={rows}
            getRowKey={(i) => i.productId}
            emptyMessage="Nothing to reorder: every product is above its reorder level."
          />
        </div>
      </section>
      {bySupplier.size > 0 && (
        <section className="card">
          <div className="card-hd">
            <h3>Order by supplier</h3>
          </div>
          <div className="card-bd">
            <DataTable
              columns={[
                { header: 'Supplier', key: 'supplier', cellClassName: 'cell-main' },
                { header: 'Products', key: 'lines' },
                { header: 'Units', key: 'units' },
                { header: 'Approx. cost', render: (r) => money(Math.round(r.value)) },
              ]}
              rows={[...bySupplier.values()]}
              getRowKey={(r) => r.supplier}
            />
          </div>
        </section>
      )}
    </>
  );
}
