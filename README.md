# BillBhai — Retail Order Processing & Billing System

BillBhai is a retail POS and operations demo with a NestJS backend and a static frontend.

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

- `back-end/` — NestJS API, seeded demo data, role-based access control
- `front-end/` — Static HTML/CSS/JS UI for cashier, dashboard, delivery, returns, and profile pages
- Root `package.json` — convenience scripts to run both apps together

## Prerequisites

- Node.js 18+ recommended
- npm

## Quick Start

### 1) Install dependencies

```bash
npm install
npm --prefix back-end install
```

### 2) Start both apps

```bash
npm run dev
```

This starts:

- Backend API at `http://localhost:3000`
- Frontend at `http://127.0.0.1:5500`

### 3) Open the UI

- Landing page: `http://127.0.0.1:5500/pages/index.html`
- Cashier page: `http://127.0.0.1:5500/pages/cashier.html`
- Dashboard page: `http://127.0.0.1:5500/pages/dashboard.html`

## Backend API

The backend is a NestJS app under `back-end/`.

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

Requests use the `x-role` header for role-based access control.

## Frontend Notes

- The frontend is static and served from `front-end/pages`
- It talks to the backend at `http://localhost:3000/api`
- If the backend is not running, some pages fall back to local mock data

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
npm run dev:backend
npm run dev:frontend
npm run dev
```

Backend scripts live in [back-end/package.json](back-end/package.json).

## Notes

- The backend seeds orders, customers, products, deliveries, returns, inventory, and users in memory on startup.
- `/api/orders` returns the seeded order records immediately after backend start.
- `returns` endpoints require the `returnhandler` role for reads.
