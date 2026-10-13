import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterBusinessPage from './pages/RegisterBusinessPage.jsx';
import ChoosePlanPage from './pages/ChoosePlanPage.jsx';
import BusinessWelcomePage from './pages/BusinessWelcomePage.jsx';
import CashierPage from './pages/CashierPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import DeliveryPage from './pages/DeliveryPage.jsx';
import ReturnsPage from './pages/ReturnsPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import SuperuserPage from './pages/SuperuserPage.jsx';
import BusinessesPage from './pages/BusinessesPage.jsx';

// One route per original HTML page. `/orders` replaces `orders.html`.
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
  users: UsersPage,
  profile: ProfilePage,
  notifications: NotificationsPage,
  superuser: SuperuserPage,
  businesses: BusinessesPage,
};

// Keeps old links such as `dashboard.html?id=1` working by redirecting to `/dashboard?id=1`.
function LegacyHtmlRedirect() {
  const { file } = useParams();
  const name = String(file || '').replace(/\.html$/, '');
  const target = name === 'index' || !PAGES[name] ? '/' : `/${name}`;
  return <Navigate to={`${target}${window.location.search}${window.location.hash}`} replace />;
}

export default function App() {
  // Following a link in the HTML app was always a full page load, even to the
  // page you were on. Keying each page by location.key keeps that behaviour:
  // every navigation mounts the page fresh.
  const location = useLocation();
  return (
    <Routes>
      <Route path="/" element={<LandingPage key={location.key} />} />
      {Object.entries(PAGES).map(([path, Page]) => (
        <Route key={path} path={`/${path}`} element={<Page key={location.key} />} />
      ))}
      <Route path="/:file" element={<LegacyHtmlRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
