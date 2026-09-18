import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageSetup from '../hooks/usePageSetup.js';
import { CSS, FONTS } from '../lib/pageAssets.js';
import AmbientGlow from '../components/login/AmbientGlow.jsx';
import LoginCard from '../components/login/LoginCard.jsx';

// React port of login.html + scripts/script.js.

const LOGIN_API_URLS = ['http://localhost:3000/api/auth/login', 'http://localhost:4000/api/auth/login'];
const LOGIN_TIMEOUT_MS = 10000;
const BUSINESS_SCOPED_ROLES = ['admin', 'cashier', 'inventorymanager', 'deliveryops', 'returnhandler', 'customer'];
const CLEAN_STATUS = { username: { error: false, shake: false }, password: { error: false, shake: false } };
const FAILED = { error: true, shake: true };

function normalizeRole(role) {
  return String(role || '').toLowerCase().replace(/\s+/g, '');
}

function roleToKey(role) {
  const r = normalizeRole(role);
  if (r === 'superuser' || r === 'super') return 'superuser';
  if (r === 'admin' || r === 'opshead' || r === 'storemanager' || r === 'accountant' || r === 'supportagent') return 'admin';
  if (r === 'cashier') return 'cashier';
  if (r === 'returnhandler' || r === 'returns') return 'returnhandler';
  if (r === 'inventorymanager' || r === 'inventory') return 'inventorymanager';
  if (r === 'deliveryops' || r === 'deliverymanager' || r === 'delivery' || r === 'deliverydriver') return 'deliveryops';
  if (r === 'customer' || r === 'user') return 'customer';
  return 'admin';
}

function routeByRole(role) {
  const r = roleToKey(role);
  if (r === 'superuser') return '/superuser';
  if (r === 'admin') return '/dashboard';
  if (r === 'cashier') return '/cashier';
  if (r === 'returnhandler') return '/returns';
  if (r === 'inventorymanager') return '/inventory';
  if (r === 'deliveryops') return '/delivery';
  if (r === 'customer') return '/cashier';
  return '/dashboard';
}

// `dashboard.html?x=1` -> `/dashboard?x=1`
function htmlToRoute(page) {
  return `/${String(page).replace(/\.html(?=$|[?#])/i, '')}`;
}

async function backendLogin(credentials) {
  for (const url of LOGIN_API_URLS) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, LOGIN_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        signal: controller ? controller.signal : undefined,
      });
      return response;
    } catch {
      // Try next endpoint URL
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error('All auth endpoints unreachable');
}

export default function LoginPage() {
  usePageSetup({ title: 'BillBhai - Admin Login', styles: [CSS.login], fonts: FONTS.auth });

  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldStatus, setFieldStatus] = useState(CLEAN_STATUS);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const timers = useRef([]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  function later(fn, ms) {
    timers.current.push(setTimeout(fn, ms));
  }

  function handleFieldFocus(field) {
    setFieldStatus((prev) => ({ ...prev, [field]: { ...prev[field], error: false } }));
  }

  function handleShakeEnd(field) {
    setFieldStatus((prev) => ({ ...prev, [field]: { ...prev[field], shake: false } }));
  }

  function validateForm() {
    setErrorMessage('');
    const u = username.trim();
    const p = password.trim();
    setFieldStatus({
      username: u ? CLEAN_STATUS.username : FAILED,
      password: p ? CLEAN_STATUS.password : FAILED,
    });
    if (!u || !p) return null;
    return { username: u, password: p };
  }

  function handleAuthenticatedUser(userRecord) {
    const normalizedRole = roleToKey(userRecord.role);

    localStorage.setItem('userRole', normalizedRole);
    localStorage.setItem('userName', userRecord.username);

    if (BUSINESS_SCOPED_ROLES.includes(normalizedRole)) {
      const resolvedCompanyId = String(userRecord.companyId || '').trim();
      if (!resolvedCompanyId) {
        setErrorMessage('This account has no business mapped. Contact superuser.');
        setIsLoading(false);
        return;
      }
      localStorage.setItem('activeBusinessId', resolvedCompanyId);
      if (normalizedRole === 'returnhandler') {
        localStorage.setItem('activeBusinessName', 'Returns Desk');
      } else {
        localStorage.setItem('activeBusinessName', String(userRecord.businessName || userRecord.name || 'BillBhai').trim() || 'BillBhai');
      }
    } else {
      localStorage.removeItem('activeBusinessId');
      localStorage.removeItem('activeBusinessName');
    }

    localStorage.setItem('currentUser', JSON.stringify({
      id: userRecord.id,
      username: userRecord.username,
      name: userRecord.name || userRecord.username,
      role: normalizedRole,
      email: userRecord.email || '',
      companyId: String(userRecord.companyId || '').trim() || null,
    }));

    if (normalizedRole === 'customer') {
      sessionStorage.setItem('bb_customer_session_id', `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      sessionStorage.setItem('bb_customer_session_notifications', '[]');
    } else {
      sessionStorage.removeItem('bb_customer_session_id');
      sessionStorage.removeItem('bb_customer_session_notifications');
    }

    later(() => {
      setIsLoading(false);
      setIsSuccess(true);
      later(() => {
        const requestedRedirect = String(sessionStorage.getItem('bb_post_login_redirect') || '').trim();
        const safeRedirect = requestedRedirect && /\.html$/i.test(requestedRedirect) ? requestedRedirect : '';
        sessionStorage.removeItem('bb_post_login_redirect');
        if (safeRedirect && normalizedRole === 'admin') {
          navigate(htmlToRoute(safeRedirect));
          return;
        }
        navigate(routeByRole(normalizedRole));
      }, 800);
    }, 1200);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const credentials = validateForm();
    if (!credentials) return;

    setIsLoading(true);

    try {
      const response = await backendLogin(credentials);
      if (!mounted.current) return;

      if (!response.ok) {
        setFieldStatus((prev) => ({ ...prev, password: FAILED }));
        setErrorMessage(response.status === 401
          ? 'Incorrect username or password.'
          : 'Authentication failed from backend. Please try again.');
        setIsLoading(false);
        return;
      }

      const userRecord = await response.json();
      if (!mounted.current) return;
      handleAuthenticatedUser(userRecord);
    } catch (error) {
      console.error('Login error:', error);
      if (!mounted.current) return;
      setErrorMessage('Backend is unavailable. Start backend server and try again.');
      setIsLoading(false);
    }
  }

  return (
    <>
      <AmbientGlow />
      <LoginCard
        username={username}
        password={password}
        rememberMe={rememberMe}
        showPassword={showPassword}
        fieldStatus={fieldStatus}
        errorMessage={errorMessage}
        isLoading={isLoading}
        isSuccess={isSuccess}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onTogglePassword={() => setShowPassword((prev) => !prev)}
        onToggleRemember={() => setRememberMe((prev) => !prev)}
        onForgotClick={() => setErrorMessage('Password reset is backend-managed. Please contact system admin.')}
        onFieldFocus={handleFieldFocus}
        onShakeEnd={handleShakeEnd}
        onSubmit={handleSubmit}
      />
    </>
  );
}
