/**
 * Account helpers for the Users and Register screens.
 *
 * Passwords live only on the server (as bcrypt hashes). The browser never
 * stores, generates or remembers one: a new or reset account gets a
 * temporary password from the server, shown once to the admin.
 */

/** Roles a business admin can give, as [server key, label]. */
export const STAFF_ROLES = [
  ['admin', 'Admin'],
  ['cashier', 'Cashier'],
  ['inventorymanager', 'Inventory Manager'],
  ['deliveryops', 'Delivery Ops'],
  ['returnhandler', 'Return Handler'],
  ['customer', 'Customer (self-checkout)'],
];

/** Same list plus super user, for the platform super user only. */
export const ALL_ROLES = [...STAFF_ROLES, ['superuser', 'Super User']];

export function roleLabel(roleKey) {
  const hit = ALL_ROLES.find(([key]) => key === roleKey);
  return hit ? hit[1].replace(' (self-checkout)', '') : String(roleKey || '');
}

/** A username to suggest from a name or email, e.g. "Priya Shah" → "priya.shah". */
export function buildUsernameSeed(name, email) {
  const fromName = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
  const fromEmail = String(email || '')
    .trim()
    .toLowerCase()
    .split('@')[0]
    .replace(/[^a-z0-9._-]/g, '');
  return (fromName || fromEmail || 'user').slice(0, 30);
}

/** Suggestion that does not clash with a username already on the list. */
export function suggestUsername(users, name, email) {
  const base = buildUsernameSeed(name, email);
  const taken = new Set((users || []).map((u) => String(u.username || '').toLowerCase()));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    if (!taken.has(`${base}${n}`)) return `${base}${n}`;
  }
  return `${base}${Date.now() % 1000}`;
}

/** Name to sign in with. */
export function getUserLoginHandle(user) {
  return String((user && (user.username || user.email)) || '').trim();
}
