# BillBhai Front-End

Static HTML/CSS/JavaScript UI for the BillBhai retail order processing system.

## Run

The frontend is served as static files. You can open it with a local static server or use the root dev script.

### Option 1: run from the repo root

```bash
npm run dev
```

This starts:

- Backend API at `http://localhost:3000`
- Frontend at `http://127.0.0.1:5500`

### Option 2: serve the frontend only

If you want to run only the frontend, serve the `front-end/pages` folder with any static server.

Example:

```bash
npx live-server front-end/pages --host=127.0.0.1 --port=5500 --watch=front-end/pages
```

## Open Pages

- Landing page: `http://127.0.0.1:5500/pages/index.html`
- Cashier page: `http://127.0.0.1:5500/pages/cashier.html`
- Dashboard page: `http://127.0.0.1:5500/pages/dashboard.html`
- Inventory page: `http://127.0.0.1:5500/pages/inventory.html`
- Delivery page: `http://127.0.0.1:5500/pages/delivery.html`
- Returns page: `http://127.0.0.1:5500/pages/returns.html`

## API Connection

The frontend talks to the backend at `http://localhost:3000/api`.
Requests use the `x-role` header for access control.

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

- The UI supports role-based pages and fallback mock data where applicable.
- If the backend is not running, some pages will show local mock state instead of live API data.