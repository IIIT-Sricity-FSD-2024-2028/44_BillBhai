import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import InventoryContent from '../components/inventory/InventoryContent.jsx';

export default function InventoryPage() {
  return (
    <DashboardLayout page="inventory" toast="Saved">
      <InventoryContent />
    </DashboardLayout>
  );
}
