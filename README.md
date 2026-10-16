# BillBhai: Retail Billing & Order Management (React)

**Name:** Sarthak Suvan Chowdhary  
**Roll No:** S20240010218  

BillBhai is a retail POS and back-office app. The frontend is built with React 19 and Vite, communicating with an Express 5 API backend.

## Requirements

- Node.js 18 or newer, and npm
- Frontend: React 19, React Router 7, Chart.js 4, Vite 6
- Backend: Express 5 (included, only needed so the app has data)

## Setup and run

In the project folder:

```bash
npm install
npm run dev
```

`npm install` also installs the `front-end` and `back-end` folders. Then open **http://127.0.0.1:5500** (the API runs on port 4000).

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Cashier | `cashier` | `cashier123` |
| Inventory manager | `inventorymanager` | `inventory123` |
| Delivery ops | `deliveryops` | `delivery123` |
| Return handler | `returnhandler` | `return123` |
| Super user | `chirag` | `chirag1234` |

## Testing

- `npm run build` builds the React app (checks every component compiles).
- `npm test` runs the API tests.
- By hand:
  - **Cashier**: Log in as `cashier` → click **Walk-in customer (skip details)** → add products → proceed to checkout → click **Print Bill** (opens 80mm thermal receipt print preview).
  - **Orders**: Log in as `admin` → open `/orders` → search by customer/order ID (e.g. `rahul`) → click **Export CSV** to download `orders.csv` → click **Bill** on any order to view line items fetched from backend API → click **Edit** on online orders (Paid Upfront / COD) to verify payment method persistence.
  - **Inventory**: Open `/inventory` → search products by name, SKU, or supplier.
  - **Users & Profile**: Test user addition and credential generator on `/users`; test preferences and password update on `/profile`.

## My contribution

I built the forms, dialogs, and shared UI architecture: the shared Modal, FormField, DataTable, Badge, LegacySelect, and PageHeader components, and the Orders, Users, and Profile pages. I also implemented Order Search & CSV export, Order Bill modal with backend line items, POS 80mm thermal receipt printing, and POS Walk-in customer sales.

**Pages:** `/orders`, `/users`, `/profile`, plus POS extensions on `/cashier` and search on `/inventory`.

**Files I developed & modified** (in `front-end/src`):

- `components/common/Modal.jsx`, `FormField.jsx`, `DataTable.jsx`, `Badge.jsx`, `LegacySelect.jsx`, `PageHeader.jsx`
- `pages/OrdersPage.jsx`, `components/orders/OrdersContent.jsx`, `OrderFormModal.jsx`, `OrderBillModal.jsx`, `OrdersTable.jsx`, `OrderRow.jsx`
- `pages/UsersPage.jsx`, `components/users/UsersContent.jsx`, `UserFormModal.jsx`, `UserRow.jsx`, `UserProfile.jsx`, `useUserActions.js`
- `pages/ProfilePage.jsx`, `components/profile/ProfileContent.jsx`, `ProfileIdentityCard.jsx`, `SecurityCard.jsx`, `SubscriptionPlanCard.jsx`, `RecentActivityCard.jsx`, `AccountPreferencesForm.jsx`
- `components/cashier/Receipt.jsx`, `CustomerStep.jsx`, `PaymentStep.jsx`, `pages/CashierPage.jsx`, `lib/cashier/validation.js`
- `components/inventory/InventoryContent.jsx`
- `styles/theme.css` (80mm `@media print` thermal receipt styles)

**Removed legacy vanilla files:** `front-end/pages/orders.html`, `users.html`, `profile.html`.

**Commits:**
1. `feat(front-end): add shared Modal, FormField, DataTable, Badge and PageHeader components`
2. `feat(front-end): convert the orders page to React`
3. `feat(front-end): convert the users page to React`
4. `feat(front-end): convert the profile page to React`
5. `feat(orders): search, CSV export, view/reprint bill, editable online orders; inventory search`
6. `feat(pos): add printable 80mm bill and receipt component`
7. `feat(pos): add walk-in customer support skipping details`

**React & JavaScript concepts in my code:**

| Concept | Where & How |
|---|---|
| Components & props | `OrderRow({ order, canDelete, onEdit, onDelete })`, `DataTable`, `Badge`, `Receipt` |
| State & events | `OrdersContent` keeps filters, search `query`, and sort in `useState` |
| Controlled forms | `OrderFormModal`, `UserFormModal`, `AccountPreferencesForm` using `bind` abstraction |
| Lazy state initialization | `useState(() => buildOrderRows(orders))` avoiding recomputation on re-renders |
| `useLayoutEffect` | `LegacySelect` to set `ref.current.selectedIndex = -1` before browser paint |
| `useEffect` & async cleanup | `OrderBillModal` fetching order line items + products with cancelled guard |
| Render-time derived state | Search and filter logic executed directly during render |
| Custom render prop | `DataTable` delegating row rendering to `renderRow` |
| Event mechanics | `Modal` comparing `e.target === e.currentTarget` for backdrop dismiss |
| In-memory File/Blob | CSV export generating `Blob([csv], { type: 'text/csv' })` and triggering download |
| Print stylesheet | `@media print` in `theme.css` isolating `.receipt` on 80mm width |

## Team

- Mohit Jignesh Madhu: `/` (landing), `/cashier`, `/superuser`, `/businesses`
- Aditya Gupta: `/login`, `/register-business`, `/choose-plan`, `/business-welcome`, `/notifications`
- Sarthak Suvan Chowdhary: `/orders`, `/users`, `/profile`, POS receipt printing & walk-in sales
- Sharma Chirag Krishnakumar: `/dashboard`, `/inventory`, `/reports`
- Satyam Kumar: `/delivery`, `/returns`
