/**
 * The one way the front-end talks to the BillBhai API.
 *
 * - Sends the sign-in token (issued by POST /auth/login) on every call. The
 *   server works out the role and business from the token, so nothing the
 *   browser stores can widen what a user may do.
 * - Turns error responses into Error objects whose message is the server's
 *   own explanation ("Only 3 Milk left in stock"), ready to show to the user.
 * - On 401 (expired or revoked session) clears the session and goes back to
 *   the login page.
 *
 * The API address comes from VITE_API_URL (front-end/.env), default
 * http://localhost:4000/api.
 */

import { notifyUnauthorized } from '../../store/storeBridge.js';

export const API_BASE_URL = String(
  import.meta.env?.VITE_API_URL ||
    (typeof process !== 'undefined' ? process.env?.VITE_API_URL : '') ||
    'http://localhost:4000/api',
).replace(/\/$/, '');

const TOKEN_KEY = 'bb_auth_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked */
  }
}

/** Removes everything the browser keeps about the signed-in user. */
export function clearStoredSession() {
  [
    TOKEN_KEY,
    'userRole',
    'userName',
    'currentUser',
    'activeBusinessId',
    'activeBusinessName',
    'activeBusinessPlan',
    // Older builds kept staff passwords here; never again.
    'bb_auth_overrides',
  ].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
}

let redirecting = false;

/** Resets the 401 redirect guard (called on new sign-in and in isolated tests). */
export function resetRedirectGuard() {
  redirecting = false;
}

/** Saves what POST /auth/login returned. */
export function storeLoginSession(session) {
  resetRedirectGuard();
  const role = String(session.role || '').toLowerCase();
  setAuthToken(session.accessToken);
  localStorage.setItem('userRole', role);
  localStorage.setItem('userName', session.name || session.username);
  localStorage.setItem(
    'currentUser',
    JSON.stringify({
      id: session.id,
      username: session.username,
      name: session.name || session.username,
      role,
      email: session.email || '',
      phone: session.mobileNo || '',
      companyId: role === 'superuser' ? null : session.companyId || null,
    }),
  );
  if (role === 'superuser') {
    localStorage.removeItem('activeBusinessId');
    localStorage.removeItem('activeBusinessName');
  } else if (session.companyId) {
    localStorage.setItem('activeBusinessId', session.companyId);
    localStorage.setItem('activeBusinessName', session.businessName || '');
    if (session.plan) localStorage.setItem('activeBusinessPlan', session.plan);
  }
}

function toQuery(query) {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

/**
 * api('/orders', { method: 'POST', body, query })
 * Resolves with the parsed JSON body. Rejects with Error { status, details }.
 */
export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = { Accept: 'application/json' };
  if (options.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  const token = getAuthToken();
  if (token && !options.anonymous) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${toQuery(options.query)}`, {
      method,
      headers,
      cache: 'no-store',
      body: options.body !== undefined ? (isFormData ? options.body : JSON.stringify(options.body)) : undefined,
    });
  } catch (cause) {
    const error = new Error(`Cannot reach the BillBhai server at ${API_BASE_URL}. Is the backend running?`);
    error.status = 0;
    error.cause = cause;
    throw error;
  }

  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && payload.message ? payload.message : `Request failed (HTTP ${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = payload && typeof payload === 'object' ? payload.details : undefined;
    if (response.status === 401 && !options.anonymous && !redirecting) {
      redirecting = true;
      clearStoredSession();
      notifyUnauthorized();
      if (typeof window !== 'undefined' && window.location && !String(window.location.pathname || '').startsWith('/login')) {
        try {
          window.location.assign('/login?expired=1');
        } catch {
          /* jsdom test environments do not implement window.location.assign */
        }
      }
    }
    throw error;
  }
  return payload;
}

/** Short user-facing text for a failed call. */
export function errorText(error, fallback = 'Something went wrong') {
  if (!error) return fallback;
  return String(error.message || fallback);
}
