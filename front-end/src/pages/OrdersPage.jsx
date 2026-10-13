import { useCallback, useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import OrdersContent from '../components/orders/OrdersContent.jsx';
import OrderFormModal from '../components/orders/OrderFormModal.jsx';

let requestSeq = 0;

export default function OrdersPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRequest, setModalRequest] = useState(null);
  const [modalTitle, setModalTitle] = useState('Create New Order');
  const [tablePatches, setTablePatches] = useState([]);

  const resetPatches = useCallback(() => setTablePatches((p) => (p.length ? [] : p)), []);
  const addPatch = useCallback((patch) => setTablePatches((p) => [...p, patch]), []);

  const openModal = useCallback(({ edit, values }) => {
    setModalTitle(edit ? 'Edit Order' : 'Create New Order');
    setModalRequest({ id: ++requestSeq, values });
    setModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const onSaved = useCallback((oid, order) => addPatch({ type: 'save', oid, order }), [addPatch]);

  return (
    <DashboardLayout
      page="orders"
      toast="Order created successfully!"
      afterMain={
        <OrderFormModal
          open={modalOpen}
          request={modalRequest}
          title={modalTitle}
          onClose={closeModal}
          onSaved={onSaved}
        />
      }
    >
      <OrdersContent
        patches={tablePatches}
        onResetPatches={resetPatches}
        onTablePatch={addPatch}
        onOpenModal={openModal}
      />
    </DashboardLayout>
  );
}
