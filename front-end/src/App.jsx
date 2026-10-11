import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';

// One route per original HTML page. `/orders` replaces `orders.html`.
const PAGES = {
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
