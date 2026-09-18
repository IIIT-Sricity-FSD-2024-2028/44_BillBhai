// React port of renderInventory() in dashboard.js (page content inside #contentArea).
// Re-mounted by renderPage(), which resets the filters exactly like the original.
import { useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import FilterToolbar from '../common/FilterToolbar.jsx';
import { DistributionCard, StockCard } from './InventoryCharts.jsx';
import ProductTable from './ProductTable.jsx';
import SupplierDirectory from './SupplierDirectory.jsx';
import { EMPTY_PRODUCT_FORM } from './AddProductModal.jsx';
import { useDashboard, useInventory } from '../../lib/dashboard/hooks.js';
import { isNotFoundError } from '../../lib/dashboard/api.js';
import {
  getNextSku,
  getSupplierDetails,
  normalizeEditablePhone,
  normalizeInventoryStatus,
} from '../../lib/dashboard/helpers.js';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All stock levels' },
  'In Stock', 'Low Stock', 'Critical', 'Out of Stock',
];
const SORT_OPTIONS = [
  { value: 'stock_low', label: 'Stock low-high' },
  { value: 'stock_high', label: 'Stock high-low' },
  { value: 'price_high', label: 'Price high-low' },
  { value: 'price_low', label: 'Price low-high' },
];

const units = (v) => Math.max(0, Number(v || 0));
const SORTERS = {
  stock_high: (a, b) => units(b.stock) - units(a.stock),
  price_high: (a, b) => units(b.price) - units(a.price),
  price_low: (a, b) => units(a.price) - units(b.price),
  stock_low: (a, b) => units(a.stock) - units(b.stock),
};

/**
 * onOpenProductModal(mode, values) opens the page's static #addProductModal.
 */
export default function InventoryContent({ onOpenProductModal }) {
  const { hasActionAccess, denyAction, openConfirm, apiRequest, renderPage, showToast } = useDashboard();
  const { rows: inventory, setRows } = useInventory();
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('stock_low');
  const canManage = hasActionAccess('inventory');

  const categoryOptions = Array.from(new Set(inventory.map((item) => String((item && item.cat) || 'Uncategorized').trim() || 'Uncategorized'))).sort();
  const visibleRows = inventory
    .map((item) => ({
      ...item,
      supplierMeta: getSupplierDetails(item),
      normalizedStatus: normalizeInventoryStatus(item.status, item.stock),
    }))
    .filter((item) => {
      if (category !== 'all' && String(item.cat || 'Uncategorized').trim() !== category) return false;
      if (status !== 'all' && item.normalizedStatus !== status) return false;
      return true;
    })
    .sort(SORTERS[sort] || SORTERS.stock_low);

  // openAddProductModal() as wired to #addProductBtnDyn. The click handler received
  // the MouseEvent as `isEdit`, so the original never ran checkProductPlanCap() here.
  const handleAddProduct = () => {
    if (!hasActionAccess('inventory')) {
      denyAction('Inventory create');
      return;
    }
    onOpenProductModal('add', { ...EMPTY_PRODUCT_FORM, sku: getNextSku(inventory) });
  };

  // window.editProduct(sku)
  const handleEditProduct = (sku) => {
    if (!hasActionAccess('inventory')) {
      denyAction('Inventory update');
      return;
    }
    const p = inventory.find((i) => i.sku === sku);
    if (!p) return;
    const supplierDetails = getSupplierDetails(p);
    onOpenProductModal('edit', {
      sku: p.sku,
      name: String(p.name ?? ''),
      category: String(p.cat ?? ''),
      supplier: p.supplier || '',
      supplierPhone: normalizeEditablePhone(p.supplierPhone || supplierDetails.phone || ''),
      supplierEmail: p.supplierEmail || supplierDetails.email || '',
      leadTime: String(p.leadTimeDays || supplierDetails.leadTimeDays || 3),
      price: String(p.price ?? ''),
      stock: String(p.stock ?? ''),
      status: String(p.status ?? ''),
    });
  };

  // window.deleteProduct(sku)
  const handleDeleteProduct = (sku) => {
    if (!hasActionAccess('inventory')) {
      denyAction('Inventory delete');
      return;
    }
    openConfirm({
      title: 'Delete Product',
      message: `Delete Product ${sku}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const target = inventory.find((i) => i.sku === sku) || null;
        if (!target) return true;
        if (!target.inventoryId && !target.productId) {
          throw new Error('Missing backend identifiers for this inventory row');
        }
        if (target.inventoryId) {
          try {
            await apiRequest(`/inventory/${encodeURIComponent(String(target.inventoryId))}`, { method: 'DELETE', role: 'inventorymanager' });
          } catch (error) {
            if (!isNotFoundError(error)) throw error;
          }
        }
        if (target.productId) {
          try {
            await apiRequest(`/products/${encodeURIComponent(String(target.productId))}`, { method: 'DELETE', role: 'inventorymanager' });
          } catch (error) {
            if (!isNotFoundError(error)) throw error;
          }
        }
        setRows((rows) => {
          const index = rows.findIndex((i) => i.sku === sku);
          return index === -1 ? rows : rows.filter((_, i) => i !== index);
        });
        renderPage();
        showToast(`Product "${sku}" deleted!`);
        return true;
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        actions={canManage ? <button className="btn btn-primary" id="addProductBtnDyn" onClick={handleAddProduct}>+ Add Product</button> : null}
      />
      <section className="card" style={{ marginBottom: '14px' }}>
        <FilterToolbar
          filters={[
            { id: 'inventoryCategoryFilter', label: 'Category', value: category, onChange: setCategory, options: [{ value: 'all', label: 'All categories' }, ...categoryOptions] },
            { id: 'inventoryStatusFilter', label: 'Stock status', value: status, onChange: setStatus, options: STATUS_FILTER_OPTIONS },
            { id: 'inventorySortSelect', label: 'Sort by', value: sort, onChange: setSort, options: SORT_OPTIONS },
          ]}
        />
      </section>
      <section className="grid-2">
        <DistributionCard inventory={inventory} />
        <StockCard inventory={inventory} />
      </section>
      <ProductTable rows={visibleRows} canManage={canManage} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />
      <SupplierDirectory inventory={inventory} />
    </>
  );
}
