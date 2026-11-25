import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import InventoryContent from './components/InventoryContent.jsx';

export default function InventoryPage() {
  return (
    <DashboardLayout page="inventory" toast="Saved">
      <InventoryContent />
    </DashboardLayout>
  );
}
