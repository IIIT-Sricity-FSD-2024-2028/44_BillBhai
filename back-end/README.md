# BillBhai Back-End API

Express.js API for the BillBhai retail order processing system. The source lives in
[`express/`](express/); see [express/README.md](express/README.md) for the full
architecture, endpoint list and Swagger docs.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev     # http://localhost:4000
```

| What | Where |
|---|---|
| API root | http://localhost:4000/api |
| Swagger UI | http://localhost:4000/api/docs |
| Health check | http://localhost:4000/health |

## Test

```bash
npm test                   # all Jest suites
npm run typecheck:express  # TypeScript check
```

## Seeded Demo Logins

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `cashier` | `cashier123` | cashier |
| `inventorymanager` | `inventory123` | inventorymanager |
| `deliveryops` | `delivery123` | deliveryops |
| `returnhandler` | `return123` | returnhandler |
| `chirag` | `chirag1234` | superuser |
| `customer` | `customer123` | customer |

## Important Notes

- The backend uses seeded in-memory data from `express/data/seed-data.ts`.
- Protected endpoints accept either the `x-role` header or a JWT from `POST /api/auth/login`.
- `/api/orders` includes the seeded orders immediately after startup.
- `returns` read endpoints require the `returnhandler` role.
