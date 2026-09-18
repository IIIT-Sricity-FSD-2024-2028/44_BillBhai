// Username / credential helpers ported from dashboard.js (auth overrides in
// localStorage 'bb_auth_overrides'). Functions that read the page-level
// `users` array take it as a parameter.
import { AUTH_OVERRIDE_STORAGE_KEY, CORE_AUTH_USER_KEYS } from './constants.js';
import { normalizeRole } from './session.js';
import { loadObject, saveObject } from './storage.js';

export function decodeUserToken(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch (err) {
    return raw;
  }
}

export function encodeUserToken(value) {
  return encodeURIComponent(String(value || '').trim());
}

export function normalizeAuthUserKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '');
}

export function mapUserRoleToAuthRole(roleLabel) {
  const key = normalizeRole(roleLabel);
  if (key === 'superuser' || key === 'super') return 'Super User';
  if (key === 'admin' || key === 'opshead' || key === 'storemanager' || key === 'accountant' || key === 'supportagent') return 'Admin';
  if (key === 'cashier') return 'Cashier';
  if (key === 'returnhandler' || key === 'returns') return 'Return Handler';
  if (key === 'inventorymanager' || key === 'inventory') return 'Inventory Manager';
  if (key === 'deliveryops' || key === 'delivery' || key === 'deliverymanager' || key === 'deliverydriver') return 'Delivery Ops';
  if (key === 'customer' || key === 'user') return 'Customer';
  return 'Admin';
}

export function buildUsernameSeed(name, email) {
  const emailSeed = String(email || '').trim().split('@')[0] || '';
  const nameSeed = String(name || '').trim().toLowerCase().replace(/\s+/g, '.');
  const rawSeed = emailSeed || nameSeed || 'user';
  return normalizeAuthUserKey(rawSeed) || `user${Math.floor(Math.random() * 900 + 100)}`;
}

export function usernameTaken(users, usernameKey, existingOwnerName) {
  if (!usernameKey) return true;
  if (CORE_AUTH_USER_KEYS.has(usernameKey)) return true;

  const overrides = loadObject(AUTH_OVERRIDE_STORAGE_KEY, {});
  if (Object.prototype.hasOwnProperty.call(overrides, usernameKey)) {
    const owner = String((overrides[usernameKey] && overrides[usernameKey].name) || '').trim();
    if (!existingOwnerName || owner !== existingOwnerName) return true;
  }

  return users.some((user) => {
    const currentKey = normalizeAuthUserKey(user && user.username);
    if (!currentKey) return false;
    if (currentKey !== usernameKey) return false;
    const ownerName = String((user && user.name) || '').trim();
    return !existingOwnerName || ownerName !== existingOwnerName;
  });
}

export function generateUniqueUsername(users, name, email, existingUsername) {
  const currentKey = normalizeAuthUserKey(existingUsername);
  if (currentKey) return currentKey;
  const base = buildUsernameSeed(name, email);
  let candidate = base;
  let suffix = 2;
  while (usernameTaken(users, candidate, String(name || '').trim())) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function generateTemporaryPassword() {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const numberPart = String(Math.floor(Math.random() * 90) + 10);
  return `Bb${randomPart}${numberPart}!`;
}

export function getUserLoginHandle(user) {
  const username = normalizeAuthUserKey(user && user.username);
  if (username) return username;
  const email = String((user && user.email) || '').trim().toLowerCase();
  if (email) return email;
  return buildUsernameSeed(user && user.name, email);
}

/** Returns { username, password, generated }. Throws when preferredUsername is taken. */
export function upsertAuthCredentialsForUser(users, userRecord, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const userName = String((userRecord && userRecord.name) || '').trim();
  const userEmail = String((userRecord && userRecord.email) || '').trim();
  const userStatus = String((userRecord && userRecord.status) || 'Active').trim() || 'Active';
  const existingUsername = normalizeAuthUserKey(opts.existingUsername || (userRecord && userRecord.username));
  const preferredUsername = normalizeAuthUserKey(opts.preferredUsername);
  if (preferredUsername && usernameTaken(users, preferredUsername, userName)) {
    throw new Error('Username is already in use. Please choose another username.');
  }
  const username = preferredUsername || generateUniqueUsername(users, userName, userEmail, existingUsername);

  const overrides = loadObject(AUTH_OVERRIDE_STORAGE_KEY, {});
  const previousRecord = existingUsername && overrides[existingUsername] && typeof overrides[existingUsername] === 'object' ? overrides[existingUsername] : {};
  const currentRecord = overrides[username] && typeof overrides[username] === 'object' ? overrides[username] : {};

  const knownPassword = String(currentRecord.password || previousRecord.password || '').trim();
  const forcedPassword = String(opts.forcePassword || '').trim();
  const password = forcedPassword || knownPassword || generateTemporaryPassword();

  if (existingUsername && existingUsername !== username) delete overrides[existingUsername];

  overrides[username] = {
    ...currentRecord,
    username,
    email: userEmail,
    name: userName,
    role: mapUserRoleToAuthRole(userRecord && userRecord.role),
    status: userStatus,
    password,
  };
  saveObject(AUTH_OVERRIDE_STORAGE_KEY, overrides);

  return { username, password, generated: !forcedPassword && !knownPassword };
}

export function removeAuthCredentialsForUser(userRecord) {
  const overrides = loadObject(AUTH_OVERRIDE_STORAGE_KEY, {});
  const username = normalizeAuthUserKey(userRecord && userRecord.username);
  const userEmail = String((userRecord && userRecord.email) || '').trim().toLowerCase();
  const userName = String((userRecord && userRecord.name) || '').trim().toLowerCase();

  if (username && Object.prototype.hasOwnProperty.call(overrides, username)) {
    delete overrides[username];
    saveObject(AUTH_OVERRIDE_STORAGE_KEY, overrides);
    return;
  }

  Object.keys(overrides).forEach((key) => {
    const record = overrides[key] && typeof overrides[key] === 'object' ? overrides[key] : {};
    const recordEmail = String(record.email || '').trim().toLowerCase();
    const recordName = String(record.name || '').trim().toLowerCase();
    if ((userEmail && recordEmail === userEmail) || (userName && recordName === userName)) delete overrides[key];
  });
  saveObject(AUTH_OVERRIDE_STORAGE_KEY, overrides);
}
