import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchInventoryThunk,
  selectAllProducts,
  selectAllSuppliers,
  selectInventoryStatus,
  selectInventoryError,
} from '../../store/slices/inventorySlice.js';
import PageHeader from '../common/PageHeader.jsx';
import FilterToolbar from '../common/FilterToolbar.jsx';
import { DistributionCard, StockCard } from './InventoryCharts.jsx';
import ProductTable from './ProductTable.jsx';
import SupplierDirectory from './SupplierDirectory.jsx';
import ReorderList from './ReorderList.jsx';
import MovementsPanel from './MovementsPanel.jsx';
import ProductFormModal from './ProductFormModal.jsx';
import StockActionModal from './StockActionModal.jsx';
import StockHistoryModal from './StockHistoryModal.jsx';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { api } from '../../lib/http.js';
import { isBelowReorder } from './inventoryUtils.js';

const STATUS_OPTIONS = [{ value: 'all', label: 'All stock levels' }, 'In Stock', 'Low Stock', 'Critical', 'Out of Stock'];
const SORT_OPTIONS = [
  { value: 'urgency', label: 'Closest to running out' },
  { value: 'stock_low', label: 'Stock low-high' },
  { value: 'stock_high', label: 'Stock high-low' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'price_high', label: 'Price high-low' },
  { value: 'price_low', label: 'Price low-high' },
];
const SORTERS = {
  urgency: (a, b) => a.stock / Math.max(1, a.reorderLevel) - b.stock / Math.max(1, b.reorderLevel),
  stock_low: (a, b) => a.stock - b.stock,
  stock_high: (a, b) => b.stock - a.stock,
  name: (a, b) => a.name.localeCompare(b.name),
  price_high: (a, b) => b.price - a.price,
  price_low: (a, b) => a.price - b.price,
};
const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'reorder', label: 'Reorder list' },
  { key: 'movements', label: 'Stock movements' },
  { key: 'suppliers', label: 'Suppliers' },
];

export default function InventoryContent() {
  const dispatch = useDispatch();
  const reduxProducts = useSelector(selectAllProducts);
  const reduxSuppliers = useSelector(selectAllSuppliers);
  const inventoryStatus = useSelector(selectInventoryStatus);
  const inventoryError = useSelector(selectInventoryError);

  const { inventory: dashInventory, suppliers: dashSuppliers, hasActionAccess, openConfirm, showToast, refreshData, syncError } = useDashboard();
  const canManage = hasActionAccess('inventory');

  useEffect(() => {
    dispatch(fetchInventoryThunk());
  }, [dispatch]);

  const inventory = reduxProducts.length ? reduxProducts : dashInventory;
  const suppliers = reduxSuppliers.length ? reduxSuppliers : dashSuppliers;

  const [tab, setTab] = useState('products');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [supplier, setSupplier] = useState('all');
  const [sort, setSort] = useState('urgency');
  const [query, setQuery] = useState('');
  const [belowReorder, setBelowReorder] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [productRequest, setProductRequest] = useState(null);
  const [stockRequest, setStockRequest] = useState(null);
  const [historyItem, setHistoryItem] = useState(null);

  const activeItems = inventory.filter((i) => i.active);
  const inactiveCount = inventory.length - activeItems.length;
  const reorderCount = activeItems.filter(isBelowReorder).length;
  const categories = Array.from(new Set(inventory.map((i) => i.cat || 'Uncategorized'))).sort();
  const supplierNames = Array.from(new Set(inventory.map((i) => i.supplier).filter(Boolean))).sort();

  const q = query.trim().toLowerCase();
  const rows = inventory
    .filter((i) => (showInactive ? true : i.active))
    .filter((i) => category === 'all' || i.cat === category)
    .filter((i) => status === 'all' || i.status === status)
    .filter((i) => supplier === 'all' || i.supplier === supplier)
    .filter((i) => !belowReorder || isBelowReorder(i))
    .filter((i) => !q || `${i.productId} ${i.name} ${i.barcode} ${i.supplier} ${i.cat} ${i.location}`.toLowerCase().includes(q))
    .sort(SORTERS[sort] || SORTERS.urgency);

  const done = (message) => {
    setProductRequest(null);
    setStockRequest(null);
    showToast(message);
    refreshData();
  };
  const fail = (message) => showToast(message);

  const openReceive = (item, quantity) => setStockRequest({ kind: 'receive', item, quantity });
  const openAdjust = (item) => setStockRequest({ kind: 'adjust', item });

  const deactivate = (item) =>
    openConfirm({
      title: 'Deactivate product',
      message: `${item.name} will disappear from the till and can no longer be sold. Its sales history and stock records are kept, and you can reactivate it later.`,
      confirmLabel: 'Deactivate',
      onConfirm: async () => {
        await api(`/products/${encodeURIComponent(item.productId)}`, { method: 'DELETE' });
        done(`${item.name} deactivated.`);
        return true;
      },
    });

  const reactivate = async (item) => {
    try {
      await api(`/products/${encodeURIComponent(item.productId)}`, { method: 'PUT', body: { active: true, version: item.productVersion } });
      done(`${item.name} is back on sale.`);
    } catch (err) {
      fail(err.message || 'Could not reactivate the product.');
    }
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        actions={
          canManage ? (
            <button className="btn btn-primary" id="addProductBtnDyn" onClick={() => setProductRequest({ mode: 'add' })}>
              + Add product
            </button>
          ) : null
        }
      />
      {(syncError || inventoryError) && (
        <div className="card" style={{ marginBottom: '14px', borderColor: 'var(--red)' }}>
          <div className="card-bd text-sm" style={{ color: 'var(--red)' }}>{syncError || inventoryError}</div>
        </div>
      )}
      <div className="chart-tabs" style={{ marginBottom: '14px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" className={tab === t.key ? 'chart-tab active' : 'chart-tab'} onClick={() => setTab(t.key)} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
            {t.label}
            {t.key === 'reorder' && reorderCount ? ` (${reorderCount})` : ''}
            {t.key === 'suppliers' ? ` (${suppliers.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          <section className="card" style={{ marginBottom: '14px' }}>
            <FilterToolbar
              filters={[
                { id: 'inventoryCategoryFilter', label: 'Category', value: category, onChange: setCategory, options: [{ value: 'all', label: 'All categories' }, ...categories] },
                { id: 'inventoryStatusFilter', label: 'Stock status', value: status, onChange: setStatus, options: STATUS_OPTIONS },
                { id: 'inventorySupplierFilter', label: 'Supplier', value: supplier, onChange: setSupplier, options: [{ value: 'all', label: 'All suppliers' }, ...supplierNames] },
                { id: 'inventorySortSelect', label: 'Sort by', value: sort, onChange: setSort, options: SORT_OPTIONS },
              ]}
            >
              <div className="toolbar-group">
                <label className="toolbar-label" htmlFor="inventorySearch">
                  Search
                </label>
                <input id="inventorySearch" type="search" className="toolbar-select" placeholder="Name, SKU, barcode, supplier" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="toolbar-group">
                <label className="toolbar-label" htmlFor="inventoryBelowReorder">
                  <input id="inventoryBelowReorder" type="checkbox" checked={belowReorder} onChange={(e) => setBelowReorder(e.target.checked)} /> At or below reorder level
                </label>
                <label className="toolbar-label" htmlFor="inventoryShowInactive">
                  <input id="inventoryShowInactive" type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive ({inactiveCount})
                </label>
              </div>
            </FilterToolbar>
            <div className="card-bd text-sm text-muted" style={{ paddingTop: 0 }}>
              Showing {rows.length} of {showInactive ? inventory.length : activeItems.length} products.
            </div>
          </section>
          <ProductTable
            rows={rows}
            canManage={canManage}
            onEdit={(item) => setProductRequest({ mode: 'edit', item })}
            onReceive={(item) => openReceive(item)}
            onAdjust={openAdjust}
            onHistory={setHistoryItem}
            onDeactivate={deactivate}
            onReactivate={reactivate}
          />
          <section className="grid-2" style={{ marginTop: '14px' }}>
            <DistributionCard inventory={inventory} />
            <StockCard inventory={inventory} />
          </section>
        </>
      )}
      {tab === 'reorder' && <ReorderList inventory={inventory} canManage={canManage} onReceive={openReceive} />}
      {tab === 'movements' && <MovementsPanel inventory={inventory} />}
      {tab === 'suppliers' && <SupplierDirectory suppliers={suppliers} canManage={canManage} onSaved={done} onError={fail} openConfirm={openConfirm} />}

      <ProductFormModal
        request={productRequest}
        suppliers={suppliers}
        categories={categories}
        onClose={() => setProductRequest(null)}
        onSaved={done}
        onRefresh={refreshData}
        onReceive={(item) => {
          setProductRequest(null);
          openReceive(item);
        }}
        onAdjust={(item) => {
          setProductRequest(null);
          openAdjust(item);
        }}
      />
      <StockActionModal request={stockRequest} suppliers={suppliers} onClose={() => setStockRequest(null)} onSaved={done} />
      <StockHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />
    </>
  );
}
