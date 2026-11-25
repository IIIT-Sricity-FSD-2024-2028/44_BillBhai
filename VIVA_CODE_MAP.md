# BillBhai — Live Evaluation / Viva Code Map

When the evaluator opens any page in the browser, use this table to jump straight to the matching **Feature Folder** (Page + Components + Redux Slice + API Repo) and **Backend Module**:

## 1. Folder Layout (`front-end/src/`)
- **`features/<domain>/`**: Vertical slice per screen/domain — contains `*Page.jsx`, `components/`, `*Slice.js`, and `*Repo.js`.
- **`store/`**: Central Redux store (`store.js`, `storeBridge.js`, `thunkUtils.js`, `uiSlice.js`, `__tests__/`).
- **`shared/`**: Shared layout & utilities (`components/common/`, `components/dashboard/`, `hooks/`, `lib/`, `styles/`).

---

## 2. Complete Page URL $\rightarrow$ Frontend Feature $\rightarrow$ Redux $\rightarrow$ Backend Map

| Browser URL | Frontend Feature Folder (`front-end/src/features/...`) | Page Entry | Redux Slice(s) | Frontend Repo(s) | Backend Module (`back-end/express/modules/...`) |
|---|---|---|---|---|---|
| `/` | `landing/` | `LandingPage.jsx` | — | — | — |
| `/login` | `auth/` | `LoginPage.jsx` | `authSlice.js` | `authRepo.js` | `auth/` |
| `/register-business` | `companies/` | `RegisterBusinessPage.jsx` | `companiesSlice.js` | `companiesRepo.js` | `companies/` |
| `/choose-plan` | `companies/` | `ChoosePlanPage.jsx` | `companiesSlice.js` | `companiesRepo.js` | `companies/` |
| `/business-welcome` | `companies/` | `BusinessWelcomePage.jsx` | `companiesSlice.js` | `companiesRepo.js` | `companies/` |
| `/businesses` & `/superuser` | `companies/` | `BusinessesPage.jsx`, `SuperuserPage.jsx` | `companiesSlice.js` | `companiesRepo.js` | `companies/` |
| `/cashier` | `cashier/` | `CashierPage.jsx` | `posCartSlice.js`, `customersSlice.js`, `paymentsSlice.js` | `posRepo.js`, `customersRepo.js`, `paymentsRepo.js` | `orders/`, `customers/`, `payments/`, `inventory/` |
| `/orders` | `orders/` | `OrdersPage.jsx` | `ordersSlice.js` | `ordersRepo.js` | `orders/` |
| `/inventory` | `inventory/` | `InventoryPage.jsx` | `inventorySlice.js`, `productsSlice.js`, `suppliersSlice.js`, `uploadsSlice.js` | `inventoryRepo.js`, `productsRepo.js`, `suppliersRepo.js`, `uploadsRepo.js` | `inventory/`, `products/`, `suppliers/`, `uploads/` |
| `/delivery` | `deliveries/` | `DeliveryPage.jsx` | `deliveriesSlice.js`, `deliverySlice.js` | `deliveriesRepo.js` | `deliveries/` |
| `/returns` | `returns/` | `ReturnsPage.jsx` | `returnsSlice.js` | `returnsRepo.js` | `returns/` |
| `/coupons` | `coupons/` | `CouponsPage.jsx` | `couponsSlice.js` | `couponsRepo.js` | `coupons/` |
| `/dashboard` & `/reports` | `reports/` | `DashboardPage.jsx`, `ReportsPage.jsx` | `reportsSlice.js` | `reportsRepo.js` | `reports/` |
| `/users` | `users/` | `UsersPage.jsx` | `usersSlice.js` | `usersRepo.js` | `users/` |
| `/profile` | `profile/` | `ProfilePage.jsx` | `usersSlice.js`, `activitySlice.js` | `usersRepo.js`, `activityRepo.js` | `users/`, `activity/` |
| `/notifications` | `notifications/` | `NotificationsPage.jsx` | `uiSlice.js` *(in `src/store/`)* | — | — |

---

## 3. Tracing Any Action Live in 3 Clicks
1. Open `front-end/src/features/<page-domain>/`.
2. Open `*Page.jsx` or `components/*Content.jsx` $\rightarrow$ show `useSelector(...)` (reads from Redux) and `dispatch(...Thunk())`.
3. Open `*Slice.js` and `*Repo.js` in the **same folder** $\rightarrow$ show `UI -> Thunk -> Repo -> API -> DB -> .fulfilled -> Redux`.
