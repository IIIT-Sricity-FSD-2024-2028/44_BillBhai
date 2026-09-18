import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import UsersContent from '../components/users/UsersContent.jsx';
import UserFormModal from '../components/users/UserFormModal.jsx';

let requestSeq = 0;

export default function UsersPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRequest, setModalRequest] = useState(null);

  const openModal = useCallback((request) => {
    setModalRequest({ ...request, id: ++requestSeq });
    setModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const goBack = useCallback(() => navigate('/users'), [navigate]);

  return (
    <DashboardLayout
      page="users"
      toast="User added successfully!"
      afterMain={<UserFormModal open={modalOpen} request={modalRequest} onClose={closeModal} />}
    >
      <UsersContent onOpenModal={openModal} onBack={goBack} />
    </DashboardLayout>
  );
}
