// React port of inventory.html + renderInventory() / product modal logic in dashboard.js.
import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import InventoryContent from '../components/inventory/InventoryContent.jsx';
import AddProductModal, { EMPTY_PRODUCT_FORM } from '../components/inventory/AddProductModal.jsx';

export default function InventoryPage() {
  // The page owns the static #addProductModal state: the content (re-mounted by
  // renderPage) opens it, the modal itself stays mounted like the HTML markup.
  const [productModal, setProductModal] = useState({ open: false, request: { id: 0, mode: 'add', values: EMPTY_PRODUCT_FORM } });

  const openProductModal = (mode, values) => setProductModal((m) => ({
    open: true,
    request: { id: m.request.id + 1, mode, values },
  }));
  const closeProductModal = () => setProductModal((m) => ({ ...m, open: false }));

  return (
    <DashboardLayout
      page="inventory"
      toast="Product added successfully!"
      afterMain={<AddProductModal open={productModal.open} request={productModal.request} onClose={closeProductModal} />}
    >
      <InventoryContent onOpenProductModal={openProductModal} />
    </DashboardLayout>
  );
}
