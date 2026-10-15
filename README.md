# BillBhai — Retail Order Processing & Billing System

BillBhai is an enterprise-grade retail POS (Point of Sale) and operations management web application engineered with an Express.js TypeScript backend and a React (Vite) frontend.

---

## 1. Project Overview & Architecture

Modern retail environments require seamless, real-time coordination across orders, billing, payments, inventory, dispatches, returns, and operational reporting. BillBhai provides a full end-to-end operational suite supporting in-store POS checkout and delivery-based order lifecycles.

### Architecture Highlights:
- **Frontend**: Single-Page Application (SPA) built with React 19, Vite, React Router 7, and Chart.js.
- **Backend**: RESTful API service built with Express.js 5 and TypeScript, featuring Zod schema validation, Role-Based Access Control (RBAC), and Swagger/OpenAPI documentation.
- **Data Layer**: In-memory repository pattern pre-seeded with multi-tenant company, catalog, inventory, order, and user data for instant, deterministic testing and runtime evaluation.

### Key Business Domains & Roles:
- **Customer**: Browses catalog, places self-checkout orders, views receipts.
- **Cashier**: Processes counter billing, applies promo codes, handles takeaway/delivery checkouts, and prints 80mm receipts.
- **Inventory Manager**: Tracks stock levels, initiates reorders, performs manual adjustments, and manages supplier records.
- **Delivery Operations**: Manages driver dispatches, updates route status, tracks fulfillment milestones.
- **Return Handler**: Validates item conditions, records customer returns, and coordinates restocks/refunds.
- **Super User / Admin**: Full administrative visibility across businesses, sales trends, revenue metrics, and user provisioning.

---

## 2. Project Setup & Dependencies

### Prerequisites:
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- Supported OS: macOS, Linux, Windows

### Project Structure:
```
44_BillBhai/
├── back-end/
│   ├── express/
│   │   ├── config/          # Environment configuration
│   │   ├── data/            # In-memory entities & seed data
│   │   ├── docs/            # OpenAPI / Swagger definition
│   │   ├── middleware/      # Auth, RBAC, logging, error handling
│   │   ├── modules/         # Auth, Companies, Customers, Deliveries,
│   │   │                    # Inventory, Orders, Payments, Products,
│   │   │                    # Reports, Returns, Suppliers, Users
│   │   └── server.ts        # Express entry point
│   ├── package.json
│   └── tsconfig.json
├── front-end/
│   ├── src/
│   │   ├── components/      # UI components (Cashier, Inventory, Orders, etc.)
│   │   ├── hooks/           # Custom React hooks (Theme, PageSetup, etc.)
│   │   ├── lib/             # API client, store, helpers, POS logic
│   │   ├── pages/           # Route views (Dashboard, POS, Orders, Inventory, etc.)
│   │   └── main.jsx         # Vite React bootstrap
│   ├── package.json
│   └── vite.config.js
├── package.json             # Root monorepo dev orchestrator
└── README.md                # Project documentation & individual contributions
```

### Installation:
Run the following single command from the project root directory:

```bash
npm install
```

> **Note**: The root `postinstall` script automatically installs all required dependencies for both `back-end` and `front-end`.

---

## 3. Execution Steps

### Option A: Run Both Frontend & Backend Concurrently (Recommended)
From the project root:
```bash
npm run dev
```
This runs `concurrently` to spin up:
- **Backend API Server**: `http://localhost:4000`
- **Swagger Documentation**: `http://localhost:4000/api/docs`
- **Frontend Web Application**: `http://127.0.0.1:5500`

### Option B: Run Services Individually
- **Backend only**:
  ```bash
  npm run dev:backend
  ```
- **Frontend only**:
  ```bash
  npm run dev:frontend
  ```

### Accessing the Web Application:
- **Landing Page**: `http://127.0.0.1:5500/`
- **Login Portal**: `http://127.0.0.1:5500/login`
- **Cashier POS**: `http://127.0.0.1:5500/cashier`
- **Operations Dashboard**: `http://127.0.0.1:5500/dashboard`

### Demo Login Credentials:
| Username | Password | Role | Description |
|---|---|---|---|
| `admin` | `admin123` | admin | Store Administrator with full dashboard metrics |
| `cashier` | `cashier123` | cashier | Point of Sale operator & billing |
| `inventorymanager` | `inventory123` | inventorymanager | Stock monitoring, product catalog & supplier management |
| `deliveryops` | `delivery123` | deliveryops | Dispatch & delivery tracking |
| `returnhandler` | `return123` | returnhandler | Returns processing & inspection desk |
| `chirag` | `chirag1234` | superuser | Super Administrator across organizations |
| `customer` | `customer123` | customer | Self-service counter checkout |

---

## 4. Testing Instructions

### Run Backend Unit & Integration Tests:
```bash
npm test
```
- Executes Jest test suites across all backend modules.
- **Expected Result**: **13 test suites passed, 198 tests passed**.

### Verify TypeScript Types:
```bash
npm --prefix back-end run typecheck:express
```
- Performs static type verification using the TypeScript compiler (`tsc --noEmit`).

### Production Build Verification (Frontend):
```bash
npm run build
```
- Builds the optimized production bundle with Vite into `front-end/dist`.

---

## 5. Individual Contribution: Chirag Sharma

- **Student Name**: Chirag Sharma
- **Email**: chirag.k24@iiits.in
- **Group**: 44 (44_BillBhai)
- **Role**: Full Stack Development, Core Architecture, Inventory-Order Synchronization, Dashboard Analytics

### Specific Files Developed and Modified:

1. **`back-end/express/modules/inventory/inventory.service.ts`**
   - Implemented `consumeStock(productId: string, quantity: number): InventoryItem | null`.
   - Ensures sold item quantities are deducted from available stock upon checkout while guaranteeing stock never drops below zero (preventing POS counter deadlocks when stock counts lag physical inventory).
   - Dynamically recomputes inventory status (`In Stock`, `Low Stock`, `Out of Stock`) based on reorder thresholds.

2. **`back-end/express/modules/inventory/inventory.test.ts`**
   - Developed unit tests verifying `consumeStock`:
     - Test that stock drops accurately by sold quantity.
     - Test that stock floors at 0 and transitions status to `Out of Stock` rather than throwing errors.
     - Test that sales of items with no inventory row gracefully return `null` without throwing exceptions.

3. **`back-end/express/modules/orders/orders.service.ts`**
   - Integrated dependency injection of `InventoryService` into `OrdersService`.
   - Wired `inventory.consumeStock(item.productId, item.quantity)` directly into the order creation pipeline so every completed counter sale or online order automatically deducts the corresponding inventory items in real time.

4. **`back-end/express/modules/orders/orders.test.ts`**
   - Added test suite coverage verifying that `OrdersService.createOrder` successfully triggers stock reduction in the inventory service for all line items.

5. **`back-end/express/data/seed-data.ts`**
   - Fixed `USR-005` (`returnhandler` - Hemant Rawat) `companyId` mapping from `BIZ-102` to `BIZ-101`.
   - Resolved multi-tenant isolation bug where the returns desk operator was unable to view or process return requests belonging to the primary store (`BIZ-101`).

6. **`front-end/src/lib/apiClient.js`**
   - Synchronized demo user profile for `returnhandler` to `BIZ-101` in the client-side session context, ensuring returns desk operators see store returns (`RET-220`, `RET-221`).

7. **`front-end/src/pages/DashboardPage.jsx`**
   - Added dynamic "Today's Sales" analytics to the Revenue `StatCard`.
   - Computed current day's revenue total and bill volume (`Today: ₹X · N bills`) using timeline entry aggregation and `startOfDay` time boundaries.

8. **`front-end/src/lib/dashboard/helpers.js`**
   - Enhanced `parseOrderDate()` to handle year-less date strings (e.g. `"15 Oct 20:06"`).
   - Inferred current calendar year dynamically, fixing a bug where browser native Date parsing assumed the year 2001, which skewed dashboard revenue trend charts and timeline sorting.

9. **`front-end/src/components/inventory/AddProductModal.jsx`**
   - Implemented `resolveSupplierId()` logic during product creation and editing.
   - Prevents supplier information from inadvertently resetting to the default supplier ("Agarwal Traders") when editing products.
   - Supports resolving suppliers by name, auto-creating new suppliers when valid contact details are supplied, and preserving existing supplier associations.

10. **`front-end/src/lib/dashboard/api.js`**
    - Preserved `supplierId` field on operational inventory records in `fetchOperationalData()`, allowing seamless round-trip supplier persistence.

11. **Initial Project Foundations & Architecture** (from earlier project phases):
    - Authored original UI layouts, responsive CSS styling tokens, SRS requirements documentation, and landing/admin design specifications.
