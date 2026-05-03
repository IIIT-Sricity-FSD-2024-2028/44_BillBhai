# BillBhai Back-End API

NestJS API for the BillBhai retail order processing system.

## Setup

```bash
npm install
```

## Run

```bash
# development with watch
npm run start:dev

# standard start
npm run start

# production build/run
npm run build
npm run start:prod
```

The API runs on `http://localhost:3000` by default.

## Test

```bash
npm run test
npm run test:e2e
npm run test:smoke
```

## Key API Modules

- `auth`
- `products`
- `customers`
- `orders`
- `deliveries`
- `returns`
- `inventory`
- `suppliers`
- `companies`
- `users`
- `reports`

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

- The backend uses seeded in-memory data from `src/common/seed/seed-data.ts`.
- `x-role` is required on API requests for role-based access control.
- `/api/orders` includes the two seeded orders immediately after startup.
- `returns` read endpoints require the `returnhandler` role.
- Some role examples in Swagger may still show older demo usernames; the table above reflects the actual seeded accounts.
