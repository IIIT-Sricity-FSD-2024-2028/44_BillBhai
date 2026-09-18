# BillBhai — Retail Order Processing & Billing System

BillBhai is a retail POS and operations app with an Express.js backend and a React frontend.

## About The Project

Modern retail operations need a reliable system for orders, billing, payments, inventory, deliveries, returns, and reporting. This project is built to support both in-store and delivery-based workflows while keeping data transparent and easy to audit.

It covers:

- End-to-end order lifecycle from creation to delivery
- Billing, discounts, taxes, and invoicing
- Inventory monitoring, replenishment, and adjustments
- Returns, refunds, and exchanges
- Sales tracking and operational reporting

## Identified Actors

- **Customer** — buys products, makes payments, and requests returns/refunds
- **Cashier** — creates orders, verifies items, and handles billing
- **Return Handler** — manages returns, exchanges, and refunds
- **Delivery Operations** — assigns riders and tracks delivery status
- **Inventory Manager** — monitors stock and stock adjustments
- **Super User / Admin** — oversees the overall system and reporting

## Core Modules

- Order Processing
- Billing & Invoicing
- Payment Handling
- Delivery Management
- Inventory Monitoring & Replenishment
- Returns & Refunds
- Sales & Operational Reporting

## Project Structure

- `back-end/` — Express.js API (`back-end/express/`), seeded demo data, role-based access control
- `front-end/` — React (Vite) single-page app: landing, login, registration, cashier POS and the admin console
- Root `package.json` — convenience scripts to run both apps together

## Prerequisites

- Node.js 18+ recommended
- npm

## Quick Start

### 1) Install dependencies

```bash
npm install
```

That is the only install step. The root `postinstall` script also installs
the `back-end/` and `front-end/` dependencies.

### 2) Start both apps

```bash
npm run dev
```

This starts:

- Backend API at `http://localhost:4000` (Swagger UI at `http://localhost:4000/api/docs`)
- Frontend at `http://127.0.0.1:5500`

### 3) Open the UI

- Landing page: `http://127.0.0.1:5500/`
- Login: `http://127.0.0.1:5500/login`
- Cashier POS: `http://127.0.0.1:5500/cashier`
- Dashboard: `http://127.0.0.1:5500/dashboard`

## Backend API

The backend is an Express.js app under `back-end/express/`. See [back-end/express/README.md](back-end/express/README.md).

Common endpoints:

- `/api/auth/login`
- `/api/products`
- `/api/customers`
- `/api/orders`
- `/api/deliveries`
- `/api/returns`
- `/api/inventory`
- `/api/suppliers`
- `/api/companies`
- `/api/users`
- `/api/reports/*`

Requests use the `x-role` header (or a JWT from login) for role-based access control.

## Frontend Notes

- The frontend is a React app served by Vite from `front-end/`; see [front-end/README.md](front-end/README.md)
- It talks to the backend at `http://localhost:4000/api`
- If the backend is not running, the admin pages say so and offer a Retry button

## Demo Login Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `cashier` | `cashier123` | cashier |
| `inventorymanager` | `inventory123` | inventorymanager |
| `deliveryops` | `delivery123` | deliveryops |
| `returnhandler` | `return123` | returnhandler |
| `chirag` | `chirag1234` | superuser |
| `customer` | `customer123` | customer |

## Useful Scripts

Root scripts:

```bash
npm run dev            # backend + frontend
npm run dev:backend    # Express API only
npm run dev:frontend   # React app only
npm run build          # production build of the frontend
npm test               # backend test suite
```

## Notes

- The backend seeds orders, customers, products, deliveries, returns, inventory, and users in memory on startup.
- `/api/orders` returns the seeded order records immediately after backend start.
- `returns` endpoints require the `returnhandler` role for reads.
