# Dashboard engine: contract for page authors

This folder is the React port of the shared parts of `html-ref/scripts/dashboard.js`:
start-up, role guard, sidebar and header, plans and paywalls, backend loading, notifications, and helpers.
The pages that used dashboard.js (`dashboard`, `orders`, `inventory`, `delivery`, `returns`, `reports`, `users`, `profile`, `notifications`, `superuser`, `businesses`) are built on top of it.

**Rule 1: fidelity.** The rendered DOM must match what the HTML page showed after its scripts ran: tags, classes, ids, inline styles, SVGs, text and number formatting.
Copy markup from the template strings in `dashboard.js`. Convert inline styles to style objects with identical values.

**Rule 2: idiomatic React.**
- Don't use `innerHTML`, `dangerouslySetInnerHTML`, `document.querySelector` or `window.*` globals.
- Pass actions to components as props (for example, `<OrderRow onEdit onDelete />`).
- Keep filters and sorts in component state. Derive filtered rows during render and never store them.
- Never read `localStorage` in pages. Use the hooks below.

---

## 1. Folder map

| Path | What |
|---|---|
| `src/lib/dashboard/constants.js` | `ROLE_LABELS`, `ROLE_ALLOWED_PAGES`, `ROLE_ACTIONS`, `PLAN_DEFINITIONS`, `ROLE_NOTIFICATION_CONFIG`, `NOTIFICATION_CATEGORY_LABELS`, storage keys, `API_BASE_URL`/`API_BASE_CANDIDATES`, `DELIVERY_PARTNER_DIRECTORY`, `SUPPLIER_DIRECTORY`, `USER_MANAGED_ROLE_OPTIONS`, `CORE_AUTH_USER_KEYS`, `EMAIL_PATTERN`, `PHONE_PATTERN`, `PAGE_TITLES`, `PAGE_LABELS` |
| `src/lib/dashboard/storage.js` | `loadList`, `loadObject`, `saveList`, `saveObject` (engine-internal) |
| `src/lib/dashboard/session.js` | `normalizeRole`, `roleFromStorage`, `clearSession`, `setActiveBusiness(id, name)`, `computeBootContext(page)`, `applyBootStorageWrites(boot)` (used by the layout) |
| `src/lib/dashboard/api.js` | `apiRequest`, role mapping, return and delivery backend-id helpers, `fetchOperationalData` |
| `src/lib/dashboard/helpers.js` | Pure helpers: status normalisers, metrics, dates, views, ids, validation, business records |
| `src/lib/dashboard/notifications.js` | Per-role notification generation, read state, profile-settings record |
| `src/lib/dashboard/credentials.js` | Username and password helpers (`bb_auth_overrides`) |
| `src/lib/dashboard/store.js` | Operational state, persist and live sync, plans, UI bridge, `beginPageSession` (startApp) |
| `src/lib/dashboard/hooks.js` | `useDashboard`, `useSession`, `useNotifications`, `useOrders`, `useInventory`, `useDeliveries`, `useReturns`, `useUsers`, `useBusinesses`, `useResource` |
| `src/lib/dashboard/index.js` | Barrel that re-exports all of the above |
| `src/components/common/` | Shared UI: `Sidebar`, `TopHeader`, `StatCard`, `DataTable`, `Badge`, `FilterToolbar` (+ `FilterSelect`), `Modal`, `FormField`, `PageHeader`, `ChartCanvas` (+ `getColors`, `buildChartOptions`), `Toast`, `NotificationIcon`, `icons.jsx` |
| `src/components/dashboard/` | `DashboardLayout`, `QuickFormModal`, `QuickConfirmModal`, `PlanUpgradeModal`, `PlanFeatureLock`, `credentialsMessage.jsx` |

---

## 2. Writing a page

```jsx
// src/pages/OrdersPage.jsx
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import OrdersContent from '../components/orders/OrdersContent.jsx';
import NewOrderModal from '../components/orders/NewOrderModal.jsx';

export default function OrdersPage() {
  return (
    <DashboardLayout page="orders" toast="Order created successfully!" afterMain={<NewOrderModal />}>
      <OrdersContent />
    </DashboardLayout>
  );
}
```

### `<DashboardLayout page children afterMain toast />`

The layout handles everything that the static HTML shell and the start-up code of dashboard.js did:

- **Page assets.** It calls `usePageSetup`: `CSS.dashboard`, `FONTS.app`, `<body data-page>`, and the title from `PAGE_TITLES[page]`. (`index.html` gives `#root` `display: contents` for every page, so the old `body > aside/main` flex CSS still applies.)
- **Role guard** (applyRoleBasedUI). It redirects as follows:
  - No session or an invalid role: clear the session and go to `/login`.
  - Cashier or customer on any page other than cashier: go to `/cashier`.
  - A page the role isn't allowed: go to `/<first allowed page>`.

  It sets `body[data-role]`. For a superuser on `superuser`, `profile` or `notifications`, it sets `body.no-sidebar-layout`. The storage side effects are the same as the original's, including the business-scoping block that removes `activeBusinessName`.
- **Hidden UI during load.** `body[data-app-ready]` stays `false` until the first backend load has finished, and the CSS keeps the UI hidden until then. A watchdog reveals the shell after 10 s.
- **Sidebar** (`<Sidebar>`). It renders the final nav: "POS Terminal" after Dashboard, "Super User Portal" after Users, `hidden` on disallowed items, the "Management" label rule, the active item, and PRO pills.
  - Clicking the menu button toggles `collapsed` on desktop and `mobile-open` on mobile. Clicking the overlay closes the mobile sidebar, and so does clicking a nav item when the width is 768px or less.
- **Header** (`<TopHeader>`). It shows:
  - The breadcrumb `BillBhai / <business>` and the page label.
  - The notification dropdown, with its dot.
  - The user menu: name, role label ("Super User (Full Access)" for a superuser), avatar and email.
  - The plan badge `#headerPlanBadge`.

  Only one dropdown is open at a time, and a click anywhere else closes both. **Logout** clears the session, then navigates to `/login`.
- **Children.** They render inside `.content-area#contentArea` **only after data is ready**. `renderPage()` re-mounts them.
- **Paywall.** On `delivery` or `returns` with the Starter plan, the layout renders `<PlanFeatureLock featureName="Delivery Operations" | "Returns & Refunds">` instead of the children.
- **Page-level static markup.** `afterMain` holds markup that sat between `</main>` and the toast in the HTML (the static modals `#newOrderModal`, `#addProductModal` and `#addUserModal`). It renders once data is ready and is **not** re-mounted by `renderPage()`.
- **Toast.** `toast` is the default text of the static `#successToast`. Pass it only on `orders`, `inventory` and `users`, the only pages that had one. On other pages `showToast()` is a no-op, as it was in the HTML.
- **Dynamic dialogs.** Quick form, confirm, credentials and plans dialogs render at the end, in the order they were opened.

Every mount of `DashboardLayout` behaves like a fresh HTML page load. It resets the store, re-fetches the backend and starts live sync, and it cleans all of this up on unmount. The code is safe under StrictMode.

### Original quirks that were kept on purpose

In the original, `applyRoleBasedUI()` crashed on a temporal-dead-zone error before it finished, whenever `activeBusinessId` was set, which covers every business-scoped session. So for those sessions:
- No header plan badge is shown until `switchCompanyPlan()` runs, which always shows it.
- No sidebar PRO pills are shown.
- The users list is never filtered by plan.

A superuser with no business scope does get the badge and pills.

`activeBusinessName` is read once per page load before the scoping block removes it. Because of that, the breadcrumb and the "Dashboard - X" title show the business name only on the first page after login.

The engine reproduces all of this; don't "fix" it in pages.

---

## 3. Reading data: `useDashboard()`, `useSession()`

```js
import { useDashboard, useSession } from '../../lib/dashboard/hooks.js';
const {
  orders, inventory, deliveries, returns, users, businesses, // immutable arrays (never mutate)
  state,               // full store snapshot (status, selectedBusiness, activeBusinessId, shell, ...)
  ready, roleKey, page, scopedBusinessName,                 // selectedBusiness?.name ?? activeBusinessName (page titles)
  hasActionAccess, hasOrderDeleteAccess, denyAction,
  activePlan, switchCompanyPlan, cancelSubscription, checkUserPlanCap, checkProductPlanCap,
  getProfileSubscriptionView, openPlanUpgrade,
  showToast, showMutationError, openQuickForm, openConfirm, showCredentialsModal,
  updateCollection, setCollection, persistOperationalData, publishDataSync, renderPage, apiRequest,
  getActiveNotifications, setNotificationReadState, markNotificationsRead,
  loadProfileSettingsRecord, saveProfileSettings,
} = useDashboard();

const { roleKey, roleLabel, userName, avatar, headerRoleLabel, email,
        activeBusinessId, activeBusinessName, scopedBusinessName, sessionCompanyId, page, ready } = useSession();
```

Row shapes are the ones produced by `loadOperationalDataFromBackend`:
- **order**: `{ id, customer, items, total, payment, status, date: '18 Sep 14:05', companyId }`
- **inventory**: `{ sku, inventoryId, productId, name, cat, supplier, stock, price, status, reorderLevel, location }`
- **delivery**: `{ id, oid, orderId, customer, address, partner, partnerPhone, partnerAgency, partnerVehicle, dispatchDate, deliveryDate, status, etaMin, updatedAt, time }`
- **return**: `{ id, backendId, companyId, oid, orderId, customer, product, backendProduct, reason, amount, qty, status, requestedBy, staffId, returnType, updatedAt }`
- **user**: `{ id, companyId, name, role: 'Admin' | 'Cashier' | ..., status, email, phone, username }`
- **business**: `normalizeBusinessRecord()` output. `plan`, `subscriptionStatus` and similar fields exist only after the plan actions add them.

`useNotifications()` returns the active notification list, recomputed when data or read state changes.

---

## 4. Mutating data

Mutations are immutable updates, followed by persist. Persist refreshes the notification dropdown and broadcasts a live-sync event, the equivalent of `persistOperationalData()`.

```js
updateCollection('orders', rows => rows.filter(o => o.id !== id));            // + persist
updateCollection('returns', rows => rows.map(r => r.id === id ? { ...r, status: 'Refunded', updatedAt: formatDate() } : r));
updateCollection('users', nextRows, { persist: false });                      // no persist
updateCollection('orders', fn, { silentSync: true });                          // persist without broadcast
renderPage();   // original renderPage(currentPage): re-mounts page content (filters reset, charts rebuilt, scrollTop 0)
```

Call `renderPage()` exactly where the original called `renderPage(...)`. A plain store update only re-renders; it does not re-mount.

### Resource hooks (Lab 1 data-access pattern)

```js
const { rows, loading, saving, error, create, update, remove, setRows } = useOrders();
// also: useInventory() (idKey 'sku'), useDeliveries(), useReturns(), useUsers(), useBusinesses() ('/companies'),
// or useResource(collection, { basePath, idKey })

await create(body, { toRow: (resp, body) => mappedRow, prepend: true });  // POST basePath, adds row
await update(id, body, { apply: (row, resp, body) => ({ ...row, ...mapped }) }); // PUT basePath/id
await remove(id);                                                            // DELETE basePath/id
// every call also takes { path, role, persist, silentSync, domains }; errors are re-thrown:
try { await remove(id); showToast(`Order "${id}" deleted!`); } catch (err) { showMutationError('Order delete', err); }
```

`role` defaults to the session role (the original `apiRequest` default). When the original passed an explicit role, pass it too, for example `{ role: 'returnhandler' }`.

### Low-level API (`api.js`)

- `apiRequest(path, { method = 'GET', role, body })` sends the `x-role` header and tries `localhost:4000`, then `127.0.0.1:4000`, then `/api`. It throws `Error` with `.status` for HTTP errors.
- `mutationErrorMessage(label, err)`, `isNotFoundError(err)`, `buildBackendReturnPayload(item, overrides)`.
- `resolveBackendReturnId(item)`, `ensureBackendReturnId(item, overrides)`, `updateReturnOnBackend(item, payload)` and `resolveBackendDeliveryId(item)` **mutate the object you pass**, as in the original. Pass a copy (`const copy = { ...row }`) and write the copy back with `updateCollection`.
- `normalizeBackendRole`, `mapBackendRoleToLabel`, `mapRoleLabelToBackendRole`, `getCurrentSessionRole`.

---

## 5. Dialogs and toasts

| API | Original | Notes |
|---|---|---|
| `showToast(msg)` | `showToast` | Adds the `show` class for 3 s. Only on pages with a `toast` prop. |
| `showMutationError(label, err)` | same | `console.warn` + toast `"<label> failed: <msg>"` |
| `openQuickForm({ title, submitLabel, fields, initialValues, onSubmit })` | `openQuickFormModal` | See the details after this table. |
| `openConfirm({ title, message, confirmLabel, onConfirm })` | `openQuickConfirmModal` | `message` is a string or JSX. The cancel button always says "Cancel". Returning `false` from `onConfirm` keeps the dialog open. A thrown error shows the toast "Action failed: ..." and keeps it open. |
| `showCredentialsModal(title, { name, username, password, role, email })` | same | |
| `openPlanUpgrade()` | `window.openPlanUpgradeModal` | Choosing a plan calls `switchCompanyPlan`. |
| `cancelSubscription()` | `window.cancelSubscription` | |
| `checkUserPlanCap()` / `checkProductPlanCap()` | same | Returns `false` and opens the "limit reached" dialog. |
| `denyAction(label)` | same | `alert("Access denied: ...")` |

**`openQuickForm` details.**
- Field types are `text`, `number`, `email`, `tel`, `select` (with `options`), and any other input type.
- Supported field keys are `required`, `placeholder`, `min`, `step`, `maxLength`, `inputMode`, `validation: 'phone'` and `defaultValue`.
- `onSubmit(values, close)` receives trimmed strings, with number fields converted to numbers. The dialog closes **only** when `close()` is called, and a rejected promise keeps it open.

**Your own dialogs** must use `<Modal>` and `<FormField>` from `components/common`:

```jsx
<Modal open={isOpen} id="newOrderModal" title={editing ? 'Edit Order' : 'Create New Order'} onClose={close}
       closeButtonId="orderModalClose" closeButtonType={null}>
  <form id="newOrderForm" noValidate onSubmit={submit}>
    <div className="modal-body">
      <FormField label="Customer Name *" htmlFor="orderCustomer" error="Customer name is required" invalid={errors.customer}>
        <input type="text" className={`form-control${errors.customer ? ' error' : ''}`} id="orderCustomer" ... />
      </FormField>
      ...
    </div>
    <div className="modal-footer">...</div>
  </form>
</Modal>
```

`FormField`'s `invalid` prop mirrors `setFieldError` and `clearFieldError`:
- `undefined`: untouched (no inline style).
- `true`: adds `.has-error` and `display:block`.
- `false`: `display:none`.

`errorMessage` overrides the error text.

---

## 6. Permissions

The original's `enforceActionPermissions()` hid buttons with `display:none`. **In React, never render them:**

```jsx
const { hasActionAccess, hasOrderDeleteAccess } = useDashboard();
<PageHeader title="Orders" actions={hasActionAccess('orders') ? <button className="btn btn-primary" id="newOrderBtnDyn">+ New Order</button> : null} />
{hasActionAccess('orders') && <button onClick={() => onEdit(o.id)}>Edit</button>}
{hasActionAccess('orders') && hasOrderDeleteAccess() && <button onClick={() => onDelete(o.id)}>Delete</button>}
```

| Module key | Hidden when not allowed |
|---|---|
| `inventory` | add, edit and delete product |
| `orders` | new, edit and delete order (delete also needs `hasOrderDeleteAccess()`: admin or superuser) |
| `users` | add, edit and delete user |
| `returns` | `#raiseReturnBtnDyn` and `[data-action=returns]` buttons |
| `delivery` | `[data-action=delivery]` buttons |
| `businesses` | `[data-action=businesses]` buttons |

Keep the handler-level checks too (`if (!hasActionAccess('orders')) { denyAction('Order update'); return; }`) where the original had them.

When every action button is hidden, `PageHeader` with `actions={null}` still renders the empty `.page-header-actions` div, as the original did.

---

## 7. Shared components (`src/components/common/`)

| Component | Props | Markup |
|---|---|---|
| `PageHeader` | `title`, `actions` (undefined means no actions div) | `.page-header > h2 + .page-header-actions` |
| `StatCard` | `icon`, `label`, `value`, `color` (`green`/`blue`/`red`/`amber`/...), optional `valueStyle`, `valueId`, `children` rendered after `.stat-value` | `.stat-card > .stat-icon.si-{color} + .stat-info` |
| `Badge` | `status` (text and colour), `type` (colour override), `label` or children (text override) | `badge()` and `statusBadge()`: `span.badge.b-{alnum lowercase}` |
| `DataTable` | `columns` (strings or `{ header, key, render, cellClassName }`), `rows`, `renderRow`, `getRowKey`, `emptyMessage`, `emptyColSpan`, `tbodyId` | `table()`. The empty row is `<tr><td colspan class="text-muted">` |
| `FilterToolbar` | `filters: [{ id, label, value, onChange(value), options }]`, `style`, children | `.card-bd.table-toolbar > .toolbar-group > label.toolbar-label + select.toolbar-select`. Controlled and stateless. |
| `FilterSelect` | `id`, `value`, `onChange`, `options` | bare `select.toolbar-select` |
| `Modal` | `open`, `title`, `onClose`, `maxWidth`, `id`, `closeButtonId`, `closeButtonType`, `closeOnOverlay` | `.modal-overlay[.active] > .modal > .modal-header` + children |
| `FormField` (+ `controlClass`) | `label`, `htmlFor`, `error`, `invalid`, or `hasError` + `errorDisplay` for the static page modals, `errorMessage`, `hint`, `hintFirst` | `.form-group > label.form-label + control + .form-error + .form-hint` |
| `ChartCanvas` | `id`, `type`, `data` and `options` (objects or functions) | `createChart()`. Built once on mount and destroyed on unmount. Change `key` or call `renderPage()` to rebuild. Default options come from `buildChartOptions` (shallow merge, as in the original). |
| `Toast` | `message`, `show` | Rendered by the layout |
| `Sidebar`, `TopHeader` | Presentational. Driven by `DashboardLayout`. | |
| `LegacySelect` (+ `effectiveSelectValue`) | `options`, `value`, `onChange` | `<select>` that shows nothing selected when the value has no option, like assigning `select.value` |
| `NotificationIcon` | `iconKey` | `getNotificationIcon()` (20×20) |
| `icons.jsx` | `NavIcons`, `BellIcon`, `LockIcon`, ... | |

`getColors()` returns `{ text, grid, red, amber, blue, green, purple }` (exported from `ChartCanvas.jsx`).

---

## 8. Helper reference (`helpers.js`, `notifications.js`, `credentials.js`)

Functions that read page globals in the original take them as arguments here.

- **Badges:** `badgeClass(txt, type)`, `statusBadgeType(s)`, `deliveryBadgeProps(status)` returns `{ text, type }` (deliveryBadge).
- **Status:** `normalizeDeliveryStatus`, `normalizeOrderStatus`, `normalizeInventoryStatus(status, stock)`, `determineStatus(stock, selected)`.
- **Metrics:** `getInventoryMetrics(inventory)`, `getInventoryCategoryCounts(inventory)`, `getDashboardStatusMetrics({ orders, returns, inventory })`.
- **Dates:**
  - `parseOrderDate`, `startOfDay`, `startOfWeek`
  - `getOrderTimelineEntries(orders)`, `buildRevenueTrendDays(orders, n)`, `buildRevenueTrendWeeks(orders, n)`
  - `formatDate()` returns "18 Sep 14:05"
  - `formatBackendDate(v)`, `formatRelativeTime(ms)`, `parseMonthEntry`
- **Views:** `getDeliveryPartnerDetails(item)`, `getDeliveryView({ deliveries, orders })`, `getReturnView({ returns, orders })`, `getSupplierDetails(item)`.
- **Profile activity:** `getRecentProfileActivity({ orders, returns, deliveries, inventory })` returns `{ time, before, strong, after }`. Render it as `{before}<strong>{strong}</strong>{after}`.
- **Ids:** `getNextOrderId(orders, extraIds?)`, `getNextReturnId(returns)`, `getNextSku(inventory, extraSkus?)`. The original also scanned the DOM table, which here becomes the optional `extra*` argument.
- **Validation:** `isValidEmailAddress`, `isValidPhoneNumber`, `normalizePhoneDigits`, `normalizeEditablePhone`, `escapeHtml`.
- **Records:** `normalizeBusinessRecord`, `buildBusinessSeedData`, `mergeSeedRecords`, `mergePrimaryWithSecondary`, `cloneRows`.
- **Notifications:**
  - `getActiveNotifications(state)`, `getDerivedNotifications(state)`, `generate*Notifications(state)`, `create*Notification(...)`, `makeNotificationRecord`
  - `getNotificationCategoryLabel`, `getNotificationPreferenceConfig(roleKey)`, `normalizeNotificationPreferences`, `getNotificationPriorityBadgeProps(n)` returns `{ text, type }`, `resolveNotificationViewState(input)`
  - `loadNotificationState(state)`, `getCurrentUserIdentity(state)`, `loadProfileSettingsRecord(state)`, `updatePasswordOverrideForCurrentUser(state, pw)`
  - Store actions that also refresh the dropdown: `setNotificationReadState(id, isRead)`, `markNotificationsRead(ids, isRead)`, `saveProfileSettings(record)`. `saveProfileSettings` also updates the header name, avatar and breadcrumb.
- **Credentials:**
  - `decodeUserToken`, `encodeUserToken`, `normalizeAuthUserKey`, `mapUserRoleToAuthRole`, `buildUsernameSeed`
  - `usernameTaken(users, key, owner)`, `generateUniqueUsername(users, name, email, existing)`, `generateTemporaryPassword()`, `getUserLoginHandle(user)`
  - `upsertAuthCredentialsForUser(users, record, opts)`, `removeAuthCredentialsForUser(record)`
- **Plans (`store.js`):**
  - `getActiveCompanyPlan(businesses?)`, `switchCompanyPlan(key)`, `cancelSubscription()`, `checkUserPlanCap()`, `checkProductPlanCap()`
  - `getProfileSubscriptionView(state?)` returns the data behind `updateProfileSubscriptionCard()`: badge class, price and suffix, renewal text, `cancelled`, and users, products and stores quotas `{ count, max, percent, level }`
  - `getScopedBusinessName(state?)`
- **Store internals:** `getState`, `subscribe`, `useDashboardStore`, `patchState(patch)` (escape hatch), `setShell(patch)`, `bumpNotifications()`.

---

## 9. Example page

```jsx
import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import FilterToolbar from '../components/common/FilterToolbar.jsx';
import DataTable from '../components/common/DataTable.jsx';
import Badge from '../components/common/Badge.jsx';
import { useDashboard, useUsers } from '../lib/dashboard/hooks.js';

function UsersContent() {
  const { hasActionAccess, openConfirm, showToast, showMutationError, checkUserPlanCap } = useDashboard();
  const { rows, remove } = useUsers();
  const [role, setRole] = useState('all');                         // filter state lives here
  const visible = rows.filter(u => role === 'all' || u.role === role); // derived during render
  const canManage = hasActionAccess('users');

  const onDelete = (user) => openConfirm({
    title: 'Delete User', message: `Delete ${user.name}?`, confirmLabel: 'Delete',
    onConfirm: async () => {
      try { await remove(user.id); } catch (err) { showMutationError('User delete', err); return false; }
      showToast(`User "${user.name}" deleted!`);
      return true;
    },
  });

  return (
    <>
      <PageHeader title="Users" actions={canManage ? <button className="btn btn-primary" id="addUserBtnDyn" onClick={() => checkUserPlanCap()}>+ Add User</button> : null} />
      <section className="card" style={{ marginBottom: '14px' }}>
        <FilterToolbar filters={[{ id: 'usersRoleFilter', label: 'Role', value: role, onChange: setRole,
          options: [{ value: 'all', label: 'All roles' }, ...new Set(rows.map(u => u.role))] }]} />
      </section>
      <section className="card"><div className="card-bd">
        <DataTable
          columns={['Name', 'Role', 'Status', 'Actions']}
          rows={visible}
          emptyMessage="No users match the selected filters."
          renderRow={(u) => (
            <tr key={u.id}>
              <td className="cell-main">{u.name}</td><td>{u.role}</td><td><Badge status={u.status} /></td>
              <td>{canManage && <button className="btn btn-outline" onClick={() => onDelete(u)}>Delete</button>}</td>
            </tr>
          )}
        />
      </div></section>
    </>
  );
}

export default function UsersPage() {
  return <DashboardLayout page="users" toast="User added successfully!"><UsersContent /></DashboardLayout>;
}
```

The markup in this example is illustrative. Copy the exact markup of the page you port from `dashboard.js`.

`src/pages/DashboardPage.jsx` is a complete, verified port you can use as a reference. The role variants live in `components/inventory/InventoryManagerDashboard.jsx`, `components/delivery/DeliveryOpsDashboard.jsx` and `components/returns/ReturnHandlerDashboard.jsx`. They take no props and use `useDashboard()`.
