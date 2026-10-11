# BillBhai Front-End

React (Vite) single-page app for the BillBhai retail order processing system.
It is a one-to-one port of the earlier static HTML/CSS/JavaScript pages: same
markup, same stylesheets, same behaviour, now built from React components.

## Run

From the repo root (starts the Express backend too):

```bash
npm run dev
```

Or only the frontend:

```bash
cd front-end
npm install
npm run dev        # http://127.0.0.1:5500
npm run build      # production build in dist/
```

The app talks to the backend at `http://localhost:4000/api`. Port 5500 is the
origin the backend already allows through CORS.

## Pages

| Route | Page |
|---|---|
| `/` | Landing |
| `/login` | Login |
| `/register-business`, `/choose-plan`, `/business-welcome` | Business sign-up flow |
| `/cashier` | Cashier POS terminal |
| `/dashboard` | Dashboard (admin/superuser; separate views for inventory, delivery and returns roles) |
| `/orders`, `/inventory`, `/delivery`, `/returns`, `/reports`, `/users` | Admin console |
| `/profile`, `/notifications` | Profile & settings, notifications |
| `/superuser`, `/businesses` | Super User portal |

Old links such as `orders.html` redirect to `/orders`.

## Structure

```
src/
  App.jsx                 routes (one per former HTML page)
  pages/                  one component per page
  components/
    common/               shared UI: Sidebar, TopHeader, StatCard, DataTable, Badge,
                          FilterToolbar, Modal, FormField, PageHeader, ChartCanvas, Toast ...
    dashboard/            DashboardLayout (shared admin layout) and shared dialogs
    <page>/               components for a single page (orders, inventory, cashier, ...)
  lib/
    dashboard/            admin data store, API calls, roles/plans, notifications, hooks
                          (useDashboard, useSession, useOrders, useInventory, ...)
                          -> see lib/dashboard/README.md
    cashier/              POS data loading, validation and order submission
    apiClient.js          generic API client
    pageAssets.js         per-page stylesheets and fonts
  hooks/usePageSetup.js   mounts each page's own CSS, fonts and <body> attributes
  styles/                 the original stylesheets, unchanged
```

Each page loads only the stylesheets its HTML page used (via `usePageSetup`), so
the original CSS files work unchanged without leaking between pages.

## Demo Logins

Use the same demo credentials documented in the root `README.md`:

- `admin` / `admin123`
- `cashier` / `cashier123`
- `inventorymanager` / `inventory123`
- `deliveryops` / `delivery123`
- `returnhandler` / `return123`
- `chirag` / `chirag1234`
- `customer` / `customer123`

## Notes

- Role-based access: each role only sees its allowed pages, and buttons a role
  cannot use are not rendered.
- If the backend is not running, the admin pages show a "Backend unavailable"
  message with a Retry button.
