import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import LandingPage from './features/landing/LandingPage.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import RegisterBusinessPage from './features/companies/RegisterBusinessPage.jsx';
import ChoosePlanPage from './features/companies/ChoosePlanPage.jsx';
import BusinessWelcomePage from './features/companies/BusinessWelcomePage.jsx';
import CashierPage from './features/cashier/CashierPage.jsx';
import DashboardPage from './features/reports/DashboardPage.jsx';
import OrdersPage from './features/orders/OrdersPage.jsx';
import InventoryPage from './features/inventory/InventoryPage.jsx';
import DeliveryPage from './features/deliveries/DeliveryPage.jsx';
import ReturnsPage from './features/returns/ReturnsPage.jsx';
import ReportsPage from './features/reports/ReportsPage.jsx';
import CouponsPage from './features/coupons/CouponsPage.jsx';
import UsersPage from './features/users/UsersPage.jsx';
import ProfilePage from './features/profile/ProfilePage.jsx';
import NotificationsPage from './features/notifications/NotificationsPage.jsx';
import SuperuserPage from './features/companies/SuperuserPage.jsx';
import BusinessesPage from './features/companies/BusinessesPage.jsx';
import ThemeToggle from './shared/components/common/ThemeToggle.jsx';

const PAGES = {
  login: LoginPage,
  'register-business': RegisterBusinessPage,
  'choose-plan': ChoosePlanPage,
  'business-welcome': BusinessWelcomePage,
  cashier: CashierPage,
  dashboard: DashboardPage,
  orders: OrdersPage,
  inventory: InventoryPage,
  delivery: DeliveryPage,
  returns: ReturnsPage,
  reports: ReportsPage,
  coupons: CouponsPage,
  users: UsersPage,
  profile: ProfilePage,
  notifications: NotificationsPage,
  superuser: SuperuserPage,
  businesses: BusinessesPage,
};

// Pages without a header of their own get the floating theme button.
const FLOATING_TOGGLE_PATHS = ['/login', '/register-business', '/business-welcome'];

function LegacyHtmlRedirect() {
  const { file } = useParams();
  const name = String(file || '').replace(/\.html$/, '');
  const target = name === 'index' || !PAGES[name] ? '/' : `/${name}`;
  return <Navigate to={`${target}${window.location.search}${window.location.hash}`} replace />;
}

export default function App() {
  const location = useLocation();
  return (
    <>
      {FLOATING_TOGGLE_PATHS.includes(location.pathname) && <ThemeToggle floating />}
      <Routes>
        <Route path="/" element={<LandingPage key={location.key} />} />
        {Object.entries(PAGES).map(([path, Page]) => (
          <Route key={path} path={`/${path}`} element={<Page key={location.key} />} />
        ))}
        <Route path="/:file" element={<LegacyHtmlRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
