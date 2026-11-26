import { useEffect, useMemo, useRef } from 'react';
import useViewState from '../../../shared/hooks/useViewState.js';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchInventoryThunk,
  fetchLowStockThunk,
  selectAllInventory,
  selectInventoryCategories,
  selectInventorySupplierNames,
  selectInventoryError,
} from '../inventorySlice.js';
import {
  fetchProductsThunk,
  updateProductThunk,
  deleteProductThunk,
  selectProductsError,
} from '../productsSlice.js';
import {
  fetchSuppliersThunk,
  selectSortedSuppliers,
  selectSuppliersError,
} from '../suppliersSlice.js';
import {
  importProductsCsvThunk,
  clearLastImportSummary,
  selectLastImportSummary,
  selectUploadsUploading,
  selectUploadsError,
} from '../uploadsSlice.js';
import { extractErrorMessage } from '../../../store/thunkUtils.js';
import PageHeader from '../../../shared/components/common/PageHeader.jsx';
import FilterToolbar from '../../../shared/components/common/FilterToolbar.jsx';
import { DistributionCard, StockCard } from './InventoryCharts.jsx';
import ProductTable from './ProductTable.jsx';
import SupplierDirectory from './SupplierDirectory.jsx';
import ReorderList from './ReorderList.jsx';
import MovementsPanel from './MovementsPanel.jsx';
import ProductFormModal from './ProductFormModal.jsx';
import StockActionModal from './StockActionModal.jsx';
import StockHistoryModal from './StockHistoryModal.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
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
  const inventory = useSelector(selectAllInventory);
  const suppliers = useSelector(selectSortedSuppliers);
  const categories = useSelector(selectInventoryCategories);
  const supplierNames = useSelector(selectInventorySupplierNames);
  const inventoryError = useSelector(selectInventoryError);
  const productsError = useSelector(selectProductsError);
  const suppliersError = useSelector(selectSuppliersError);
  const uploadsError = useSelector(selectUploadsError);
  const lastImportSummary = useSelector(selectLastImportSummary);
  const csvUploading = useSelector(selectUploadsUploading);

  const { state: dashState, hasActionAccess, openConfirm, showToast, refreshData, syncError } = useDashboard();
  const canManage = hasActionAccess('inventory');
  const roleKey = dashState.roleKey;
  const activeBusinessId = dashState.activeBusinessId;

  const scopeQuery = useMemo(() => {
    const bizId = String(activeBusinessId || '').trim();
    return roleKey === 'superuser' && bizId && bizId !== 'PLATFORM' ? { companyId: bizId } : undefined;
  }, [roleKey, activeBusinessId]);

  useEffect(() => {
    dispatch(fetchInventoryThunk(scopeQuery));
    dispatch(fetchProductsThunk({ includeInactive: 'true', ...scopeQuery }));
    if (canManage) {
      dispatch(fetchSuppliersThunk(scopeQuery));
      dispatch(fetchLowStockThunk(scopeQuery));
    }
  }, [dispatch, canManage, scopeQuery]);

  const [tab, setTab] = useViewState('products');
  const [category, setCategory] = useViewState('all');
  const [status, setStatus] = useViewState('all');
  const [supplier, setSupplier] = useViewState('all');
  const [sort, setSort] = useViewState('urgency');
  const [query, setQuery] = useViewState('');
  const [belowReorder, setBelowReorder] = useViewState(false);
  const [showInactive, setShowInactive] = useViewState(false);
  const [productRequest, setProductRequest] = useViewState(null);
  const [stockRequest, setStockRequest] = useViewState(null);
  const [historyItem, setHistoryItem] = useViewState(null);
  const csvInputRef = useRef(null);

  const activeItems = useMemo(() => inventory.filter((i) => i.active !== false), [inventory]);
  const inactiveCount = inventory.length - activeItems.length;
  const reorderCount = useMemo(() => activeItems.filter(isBelowReorder).length, [activeItems]);

  const categoryFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All categories' }, ...categories],
    [categories],
  );
  const supplierFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All suppliers' }, ...supplierNames],
    [supplierNames],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inventory
      .filter((i) => (showInactive ? true : i.active !== false))
      .filter((i) => category === 'all' || i.cat === category)
      .filter((i) => status === 'all' || i.status === status)
      .filter((i) => supplier === 'all' || i.supplier === supplier)
      .filter((i) => !belowReorder || isBelowReorder(i))
      .filter((i) => !q || `${i.productId} ${i.name} ${i.barcode} ${i.supplier} ${i.cat} ${i.location}`.toLowerCase().includes(q))
      .sort(SORTERS[sort] || SORTERS.urgency);
  }, [inventory, showInactive, category, status, supplier, belowReorder, query, sort]);

  const syncCatalogAfterWrite = () => {
    dispatch(fetchInventoryThunk(scopeQuery));
    dispatch(fetchProductsThunk({ includeInactive: 'true', ...scopeQuery }));
    if (canManage) {
      dispatch(fetchSuppliersThunk(scopeQuery));
      dispatch(fetchLowStockThunk(scopeQuery));
    }
    refreshData();
  };

  const done = (message) => {
    setProductRequest(null);
    setStockRequest(null);
    showToast(message);
    syncCatalogAfterWrite();
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
        try {
          await dispatch(deleteProductThunk(item.productId)).unwrap();
          done(`${item.name} deactivated.`);
        } catch (err) {
          fail(extractErrorMessage(err, 'Could not deactivate the product.'));
        }
        return true;
      },
    });

  const reactivate = async (item) => {
    try {
      await dispatch(
        updateProductThunk({
          id: item.productId,
          body: { active: true, version: item.productVersion },
        }),
      ).unwrap();
      done(`${item.name} is back on sale.`);
    } catch (err) {
      fail(extractErrorMessage(err, 'Could not reactivate the product.'));
    }
  };

  const handleCsvPick = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    try {
      const summary = await dispatch(
        importProductsCsvThunk({ file, companyId: scopeQuery?.companyId }),
      ).unwrap();
      showToast(`Imported ${summary.imported} product(s)${summary.failed ? ` (${summary.failed} failed)` : ''}.`);
      syncCatalogAfterWrite();
    } catch (err) {
      fail(extractErrorMessage(err, 'CSV import failed.'));
    }
  };

  const pageError = syncError || inventoryError || productsError || (canManage ? suppliersError : null) || uploadsError;

  return (
    <>
      <PageHeader
        title="Inventory"
        actions={
          canManage ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                aria-label="Import products CSV"
                onChange={handleCsvPick}
              />
              <button
                type="button"
                className="btn btn-outline"
                disabled={csvUploading}
                onClick={() => csvInputRef.current?.click()}
              >
                {csvUploading ? 'Importing…' : 'Import CSV'}
              </button>
              <button className="btn btn-primary" id="addProductBtnDyn" onClick={() => setProductRequest({ mode: 'add' })}>
                + Add product
              </button>
            </div>
          ) : null
        }
      />
      {pageError && (
        <div className="card" style={{ marginBottom: '14px', borderColor: 'var(--red)' }}>
          <div className="card-bd text-sm" style={{ color: 'var(--red)' }}>{pageError}</div>
        </div>
      )}
      {lastImportSummary && (
        <div className="card" style={{ marginBottom: '14px' }}>
          <div className="card-bd text-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <strong>CSV Import:</strong> {lastImportSummary.imported} imported, {lastImportSummary.failed} failed (out of {lastImportSummary.totalRows}).
              {Array.isArray(lastImportSummary.errors) && lastImportSummary.errors.length > 0 && (
                <ul style={{ margin: '6px 0 0 18px', color: 'var(--red)' }}>
                  {lastImportSummary.errors.map((errItem) => (
                    <li key={errItem.row}>Row {errItem.row}: {errItem.reason}</li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" className="btn btn-outline" onClick={() => dispatch(clearLastImportSummary())}>
              Dismiss
            </button>
          </div>
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
                { id: 'inventoryCategoryFilter', label: 'Category', value: category, onChange: setCategory, options: categoryFilterOptions },
                { id: 'inventoryStatusFilter', label: 'Stock status', value: status, onChange: setStatus, options: STATUS_OPTIONS },
                { id: 'inventorySupplierFilter', label: 'Supplier', value: supplier, onChange: setSupplier, options: supplierFilterOptions },
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
      {tab === 'movements' && <MovementsPanel inventory={inventory} canManage={canManage} scopeQuery={scopeQuery} />}
      {tab === 'suppliers' && <SupplierDirectory suppliers={suppliers} canManage={canManage} scopeQuery={scopeQuery} onSaved={done} onError={fail} openConfirm={openConfirm} />}

      <ProductFormModal
        request={productRequest}
        suppliers={suppliers}
        categories={categories}
        scopeQuery={scopeQuery}
        onClose={() => setProductRequest(null)}
        onSaved={done}
        onRefresh={syncCatalogAfterWrite}
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
      <StockHistoryModal item={historyItem} canManage={canManage} scopeQuery={scopeQuery} onClose={() => setHistoryItem(null)} />
    </>
  );
}
