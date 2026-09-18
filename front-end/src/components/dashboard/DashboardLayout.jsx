import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageSetup from '../../hooks/usePageSetup.js';
import { CSS, FONTS } from '../../lib/pageAssets.js';
import { FETCH_TIMEOUT_MS, PAGE_LABELS, PAGE_TITLES, ROLE_ALLOWED_PAGES } from '../../lib/dashboard/constants.js';
import { applyBootStorageWrites, clearSession, computeBootContext } from '../../lib/dashboard/session.js';
import { beginPageSession, getActiveCompanyPlan, registerUi, useDashboardStore } from '../../lib/dashboard/store.js';
import { useNotifications } from '../../lib/dashboard/hooks.js';
import Sidebar from '../common/Sidebar.jsx';
import TopHeader from '../common/TopHeader.jsx';
import Toast from '../common/Toast.jsx';
import PlanFeatureLock from './PlanFeatureLock.jsx';
import QuickFormModal from './QuickFormModal.jsx';
import QuickConfirmModal from './QuickConfirmModal.jsx';
import PlanUpgradeModal from './PlanUpgradeModal.jsx';
import { openCredentialsModal } from './credentialsMessage.jsx';

const PAYWALLED = {
  delivery: 'Delivery Operations',
  returns: 'Returns & Refunds',
};

let modalSeq = 0;

// Shown only when the initial backend load failed; hidden in normal use, so the
// page looks exactly like the HTML version whenever the API is reachable.
function BackendErrorBanner({ message, onRetry }) {
  return (
    <section className="card" role="alert" style={{ marginBottom: '14px', borderColor: 'var(--red)' }}>
      <div className="card-bd" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <strong style={{ color: 'var(--red)' }}>Backend unavailable</strong>
          <div className="text-sm text-muted">{message}</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={onRetry}>Retry</button>
      </div>
    </section>
  );
}

/**
 * Shared shell of every dashboard-family page (dashboard, orders, inventory,
 * delivery, returns, reports, users, profile, notifications, superuser,
 * businesses) - the React port of the duplicated sidebar/header HTML plus the
 * start-up part of dashboard.js.
 *
 *   <DashboardLayout page="orders" toast="Order created successfully!" afterMain={<OrderModal />}>
 *     <OrdersContent />
 *   </DashboardLayout>
 *
 * Props
 *  page       page key (drives <body data-page>, title, active nav item, role guard)
 *  children   page content, rendered inside .content-area#contentArea only after
 *             the initial backend load finished (like renderPage after startApp).
 *             Re-mounted by renderPage().
 *  afterMain  static markup that sat between </main> and the toast in the HTML
 *             page (e.g. #newOrderModal). Rendered once data is ready; NOT
 *             re-mounted by renderPage().
 *  toast      default text of the page's static #successToast (orders,
 *             inventory, users). Pages without it get no toast and
 *             showToast() is a no-op, exactly like the HTML pages.
 */
export default function DashboardLayout({ page, children, afterMain, toast }) {
  const navigate = useNavigate();
  // Pure snapshot of the session decisions dashboard.js made on page load.
  const [boot] = useState(() => computeBootContext(page));

  usePageSetup({
    title: PAGE_TITLES[page],
    styles: [CSS.dashboard],
    fonts: FONTS.app,
    bodyClass: boot.noSidebarLayout ? 'no-sidebar-layout' : '',
    bodyAttrs: { 'data-page': page },
  });

  const s = useDashboardStore();
  const notifications = useNotifications();
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modals, setModals] = useState([]);
  const [toastState, setToastState] = useState({ message: toast, show: false });
  const contentRef = useRef(null);
  const redirectedRef = useRef(false);
  const toastTimers = useRef([]);
  const hasToast = toast !== undefined;

  useLayoutEffect(() => {
    if (boot.roleKey) document.body.setAttribute('data-role', boot.roleKey);
  }, [boot.roleKey]);

  useLayoutEffect(() => {
    document.body.setAttribute('data-app-ready', ready || revealed ? 'true' : 'false');
  }, [ready, revealed]);

  // Modal / toast host exposed to the engine (openQuickForm, openConfirm, ...).
  const uiApi = useMemo(() => {
    const open = (kind, config) => setModals((list) => [...list, { id: ++modalSeq, kind, config }]);
    const openConfirm = (config) => open('confirm', config);
    return {
      showToast: (message) => {
        if (!hasToast) return;
        setToastState({ message, show: true });
        toastTimers.current.push(setTimeout(() => setToastState((t) => ({ ...t, show: false })), 3000));
      },
      openQuickForm: (config) => open('form', config),
      openConfirm,
      openPlanUpgrade: () => open('plan', null),
      showCredentialsModal: (title, credential) => openCredentialsModal(openConfirm, title, credential),
    };
  }, [hasToast]);

  useLayoutEffect(() => registerUi(uiApi), [uiApi]);

  useEffect(() => () => toastTimers.current.forEach(clearTimeout), []);

  // startApp(): storage side effects and role redirects.
  useEffect(() => {
    applyBootStorageWrites(boot);
    if (boot.redirect && !redirectedRef.current) {
      redirectedRef.current = true;
      navigate(boot.redirect);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // startApp(): backend load. Runs again when the user presses Retry.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (boot.redirect) return undefined;
    const dispose = beginPageSession(boot, { onReady: () => setReady(true) });
    const watchdog = setTimeout(() => setRevealed(true), FETCH_TIMEOUT_MS + 3000);
    return () => {
      clearTimeout(watchdog);
      dispose();
    };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryLoad = () => {
    setReady(false);
    setAttempt((n) => n + 1);
  };

  // renderPage() resets the scroll position of the content area.
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [s.renderNonce]);

  if (boot.redirect) return null;

  const closeModal = (id) => setModals((list) => list.filter((m) => m.id !== id));
  const onNavClick = () => {
    if (window.innerWidth <= 768) setMobileOpen(false);
  };
  const onMenuToggle = () => {
    if (window.innerWidth <= 768) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  };
  const onLogout = () => clearSession();

  const activePlan = getActiveCompanyPlan(s.businesses);
  let planBadge = null;
  if (s.shell.planBadgeVisible) {
    let bClass = 'b-active';
    if (activePlan.key === 'starter') bClass = 'b-pending';
    if (activePlan.key === 'enterprise') bClass = 'b-processing';
    planBadge = {
      className: `badge ${bClass}`,
      label: activePlan.name.replace(' Plan', ''),
      title: `Current Plan: ${activePlan.name} (Click to manage subscription)`,
      onClick: uiApi.openPlanUpgrade,
    };
  }

  // #bcPage = nav span textContent (includes " PRO" when the pill was injected).
  const proPills = s.shell.proPills || {};
  let title = PAGE_LABELS[page];
  if ((page === 'delivery' && proPills.delivery) || (page === 'returns' && proPills.returns)) title = `${title} PRO`;

  const lockedFeature = PAYWALLED[page] && activePlan.key === 'starter' ? PAYWALLED[page] : null;
  const legacyShell = page === 'notifications';

  return (
    <>
      <Sidebar
        page={page}
        allowedPages={ROLE_ALLOWED_PAGES[boot.roleKey] || []}
        proPills={proPills}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavClick={onNavClick}
        onLogout={onLogout}
        legacyIcons={legacyShell}
      />
      <main className="main-content" id="mainContent">
        <TopHeader
          title={title}
          businessName={s.shell.bcBusinessName}
          planBadge={planBadge}
          notifications={notifications}
          user={{ name: s.shell.userName, avatar: s.shell.avatar, roleLabel: s.shell.roleLabel, email: s.shell.email }}
          page={page}
          onMenuToggle={onMenuToggle}
          onNavClick={onNavClick}
          onLogout={onLogout}
          legacyMenu={legacyShell}
        />
        <div className="content-area" id="contentArea" ref={contentRef}>
          {ready && s.loadError && <BackendErrorBanner message={s.loadError} onRetry={retryLoad} />}
          {ready && (
            <Fragment key={s.renderNonce}>
              {lockedFeature ? <PlanFeatureLock featureName={lockedFeature} /> : children}
            </Fragment>
          )}
        </div>
      </main>
      {ready && afterMain}
      {hasToast && <Toast message={toastState.message} show={toastState.show} />}
      <div className="sidebar-overlay" id="sidebarOverlay" onClick={() => setMobileOpen(false)} />
      {modals.map((m) => {
        const onClose = () => closeModal(m.id);
        if (m.kind === 'form') return <QuickFormModal key={m.id} config={m.config} onClose={onClose} />;
        if (m.kind === 'confirm') return <QuickConfirmModal key={m.id} config={m.config} onClose={onClose} />;
        return <PlanUpgradeModal key={m.id} onClose={onClose} />;
      })}
    </>
  );
}
