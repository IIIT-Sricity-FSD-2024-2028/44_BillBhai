// React port of orders.html + renderOrders() / the #newOrderModal logic in dashboard.js.
import { useCallback, useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import OrdersContent from '../components/orders/OrdersContent.jsx';
import OrderFormModal from '../components/orders/OrderFormModal.jsx';

let requestSeq = 0;

export default function OrdersPage() {
  // #newOrderModal is static page markup: its state outlives renderPage().
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRequest, setModalRequest] = useState(null);
  // editOrder() set the heading to "Edit Order"; openNewOrderModal() never reset it.
  const [modalTitle, setModalTitle] = useState('Create New Order');
  // Rows handleNewOrder()/deleteOrder() wrote into (or removed from) the rendered table.
  const [tablePatches, setTablePatches] = useState([]);

  const resetPatches = useCallback(() => setTablePatches((p) => (p.length ? [] : p)), []);
  const addPatch = useCallback((patch) => setTablePatches((p) => [...p, patch]), []);

  const openModal = useCallback(({ edit, values }) => {
    if (edit) setModalTitle('Edit Order');
    setModalRequest({ id: ++requestSeq, values });
    setModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const onSaved = useCallback((oid, order) => addPatch({ type: 'save', oid, order }), [addPatch]);

  return (
    <DashboardLayout
      page="orders"
      toast="Order created successfully!"
      afterMain={(
        <OrderFormModal open={modalOpen} request={modalRequest} title={modalTitle} onClose={closeModal} onSaved={onSaved} />
      )}
    >
      <OrdersContent patches={tablePatches} onResetPatches={resetPatches} onTablePatch={addPatch} onOpenModal={openModal} />
    </DashboardLayout>
  );
}
