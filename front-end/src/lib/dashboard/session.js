import {
  OPERATIONAL_STORAGE_KEYS,
  PLAN_DEFINITIONS,
  ROLE_ALLOWED_PAGES,
  ROLE_LABELS,
} from './constants.js';
import { loadObject } from './storage.js';

export function normalizeRole(role) {
  return String(role || '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function roleFromStorage(value) {
  const key = normalizeRole(value);
  if (key === 'super' || key === 'superuser') return 'superuser';
  if (key === 'admin') return 'admin';
  if (key === 'cashier') return 'cashier';
  if (key === 'returnhandler' || key === 'returns') return 'returnhandler';
  if (key === 'inventorymanager' || key === 'inventory') return 'inventorymanager';
  if (key === 'deliveryops' || key === 'deliverymanager' || key === 'delivery')
    return 'deliveryops';
  if (key === 'customer' || key === 'user') return 'customer';
  return '';
}

export function clearSession() {
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('activeBusinessId');
  localStorage.removeItem('activeBusinessName');
  sessionStorage.removeItem('bb_customer_session_id');
  sessionStorage.removeItem('bb_customer_session_notifications');
}

export function setActiveBusiness(id, name) {
  localStorage.setItem('activeBusinessId', id);
  localStorage.setItem('activeBusinessName', name);
}

const BUSINESS_SCOPED_ROLES = [
  'admin',
  'cashier',
  'deliveryops',
  'returnhandler',
  'inventorymanager',
];

export function computeBootContext(page) {
  const currentPage = page || 'dashboard';
  const currentUser = loadObject('currentUser', {});
  const storedName = String(localStorage.getItem('userName') || currentUser.name || '').trim();
  const storedRole = String(localStorage.getItem('userRole') || currentUser.role || '').trim();
  const sessionCompanyId = String((currentUser && currentUser.companyId) || '').trim();
  const writes = [];

  const invalid = {
    page: currentPage,
    roleKey: '',
    redirect: '/login',
    clearSession: true,
    noSidebarLayout: false,
    shell: null,
    scopedAtBoot: false,
    proPills: { delivery: false, returns: false },
    activeBusinessId: '',
    activeBusinessName: '',
    sessionCompanyId,
    currentUser,
    writes,
  };

  if (!storedName || !storedRole) return invalid;

  if (!localStorage.getItem('userName')) writes.push(['set', 'userName', storedName]);
  if (!localStorage.getItem('userRole')) writes.push(['set', 'userRole', storedRole]);

  const roleKey = roleFromStorage(storedRole);
  if (!roleKey || !ROLE_ALLOWED_PAGES[roleKey]) return { ...invalid, writes: [] };

  const storedBusinessId = localStorage.getItem('activeBusinessId') || '';
  let lsBusinessId = storedBusinessId;
  if (roleKey !== 'superuser' && sessionCompanyId) {
    writes.push(['set', 'activeBusinessId', sessionCompanyId]);
    lsBusinessId = sessionCompanyId;
  }
  let lsBusinessName = localStorage.getItem('activeBusinessName') || '';

  const shell = {
    userName: storedName,
    avatar: storedName.charAt(0).toUpperCase(),
    roleLabel: ROLE_LABELS[roleKey] || storedRole,
    email: currentUser.email || '',
    bcBusinessName: '',
  };

  const allowedPages = ROLE_ALLOWED_PAGES[roleKey] || [];
  let redirect = null;
  let noSidebarLayout = false;

  if (
    (roleKey === 'cashier' || roleKey === 'customer') &&
    !['cashier', 'profile', 'notifications'].includes(currentPage)
  ) {
    redirect = '/cashier';
  } else {
    noSidebarLayout =
      roleKey === 'superuser' && ['superuser', 'profile', 'notifications'].includes(currentPage);
    if (roleKey === 'superuser' && currentPage === 'superuser') {
      writes.push(['remove', 'activeBusinessId']);
      writes.push(['remove', 'activeBusinessName']);
      lsBusinessId = '';
      lsBusinessName = '';
    }
    shell.bcBusinessName = lsBusinessName;
    if (!allowedPages.includes(currentPage)) {
      redirect = `/${allowedPages[0] || 'dashboard'}`;
    } else if (roleKey === 'superuser') {
      shell.roleLabel = 'Super User (Full Access)';
    }
  }

  const scopedAtBoot = Boolean(lsBusinessId);
  let proPills = { delivery: false, returns: false };
  if (!scopedAtBoot) {
    const saved = localStorage.getItem('activeBusinessPlan');
    const plan = (saved && PLAN_DEFINITIONS[saved]) || PLAN_DEFINITIONS.pro;
    proPills = { delivery: !plan.features.delivery, returns: !plan.features.returns };
  }

  let activeBusinessId = String(lsBusinessId || '').trim();
  const activeBusinessName = String(lsBusinessName || '').trim();
  if (BUSINESS_SCOPED_ROLES.includes(roleKey)) {
    const preferredBusinessId = sessionCompanyId || activeBusinessId;
    if (preferredBusinessId) {
      // The saved shop name only goes stale when the shop itself changes.
      if (preferredBusinessId !== storedBusinessId) writes.push(['remove', 'activeBusinessName']);
      activeBusinessId = preferredBusinessId;
      writes.push(['set', 'activeBusinessId', activeBusinessId]);
    }
  }

  return {
    page: currentPage,
    roleKey,
    redirect,
    clearSession: false,
    noSidebarLayout,
    shell,
    scopedAtBoot,
    proPills,
    activeBusinessId,
    activeBusinessName,
    sessionCompanyId,
    currentUser,
    writes,
  };
}

export function applyBootStorageWrites(boot) {
  if (boot.clearSession) clearSession();
  boot.writes.forEach(([op, key, value]) => {
    if (op === 'set') localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  });
  OPERATIONAL_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (err) {}
  });
}
