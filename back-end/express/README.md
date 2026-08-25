# BillBhai — Express.js Back-End

Express.js implementation of the BillBhai Retail Order Processing and Billing
System, migrated from the original NestJS application in `back-end/src/`.

The NestJS backend runs on port **3000**, this Express backend on port **4000**,
so both can run at the same time and be compared side by side.

All **62 REST endpoints** of the NestJS API were migrated, with identical paths,
identical role rules and identical response shapes. Seven new endpoints were
added for file upload and token based sign-in.

---

## 1. Running it

```bash
cd back-end
npm install          # first time only
npm run dev:express  # http://localhost:4000
```

| What | Where |
|---|---|
| API root | http://localhost:4000/api |
| **Swagger UI** | **http://localhost:4000/api/docs** |
| Health check | http://localhost:4000/health |
| Uploaded files | http://localhost:4000/uploads |
| Log files | `back-end/logs/` |

```bash
npm run test:express       # 187 tests across 13 suites
npm run typecheck:express  # TypeScript, no errors
```

### Demo logins

| Username | Password | Role |
|---|---|---|
| `chirag` | `chirag1234` | superuser |
| `admin` | `admin123` | admin |
| `cashier` | `cashier123` | cashier |
| `inventorymanager` | `inventory123` | inventorymanager |
| `deliveryops` | `delivery123` | deliveryops |
| `returnhandler` | `return123` | returnhandler |
| `customer` | `customer123` | customer |

Every protected endpoint accepts either credential:

```bash
# 1. The x-role header, as used by the existing frontend
curl http://localhost:4000/api/products -H "x-role: cashier"

# 2. A JWT issued by the login endpoint
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .accessToken)
curl http://localhost:4000/api/products -H "Authorization: Bearer $TOKEN"
```

---

## 2. Evaluation criteria — where each one lives

### Middleware

| Required | Library used | File | Mounted in `app.ts` |
|---|---|---|---|
| **Logging** | `morgan` + `winston` + `winston-daily-rotate-file` | `middleware/request-logger.middleware.ts`, `utils/logger.ts` | step 5 |
| **Error handling** | custom, plus `zod` and `multer` error normalisation | `middleware/error-handler.middleware.ts`, `middleware/not-found.middleware.ts` | steps 11 and 12 |
| **File upload** | `multer` | `middleware/upload.middleware.ts` | used at route level in `modules/uploads/` |
| **Security** | `helmet`, `cors`, `express-rate-limit`, `bcryptjs`, `jsonwebtoken` | `middleware/security.middleware.ts`, `middleware/cors.middleware.ts`, `middleware/rbac.middleware.ts` | steps 2, 3 and 8 |
| **Router-level** | `express.Router` | every `modules/<name>/<name>.routes.ts` | mounted by `routes/index.ts` |

Two more run on every request: `requestContextMiddleware` (correlation id) and
`validate` (zod schema validation, attached per route).

### Middleware execution order

`app.ts` registers the stack in this exact order, and the reason for the order
is written in the file header:

```
 1. requestContextMiddleware   correlation id + receive timestamp
 2. helmet                     security response headers
 3. cors                       cross origin allowlist
 4. express.json / urlencoded  body parsing, 1mb ceiling
 5. morgan -> winston          one access log line per request, to file
 6. slowRequestLogger          escalates requests over 1s to warn
 7. express.static             serves /uploads
 8. express-rate-limit         200 requests per minute on /api
 9. Swagger UI                 /api/docs
10. apiRouter                  all 12 feature modules
11. notFoundHandler            unmatched route -> NotFoundError
12. errorHandler               single JSON envelope + writes to the log file
```

### Log and error management

`utils/logger.ts` configures winston with `winston-daily-rotate-file`. Files are
written to `back-end/logs/`, rotated **daily**, rolled over at 10MB, gzipped,
and kept for 14 days:

| File | Contents |
|---|---|
| `application-YYYY-MM-DD.log` | every request and application event |
| `error-YYYY-MM-DD.log` | warnings and errors: 4xx, 5xx, RBAC denials, rate-limit trips |
| `exceptions-YYYY-MM-DD.log` | uncaught exceptions |
| `rejections-YYYY-MM-DD.log` | unhandled promise rejections |

Each entry is JSON and carries the request id, so a response a user saw can be
found in the log:

```json
{"level":"warn","message":"Product P999 not found","statusCode":404,
 "method":"GET","url":"/api/products/P999","role":"admin",
 "requestId":"fe0459b3-d3d4-4801-b593-3429b4aedee6","durationMs":2,
 "timestamp":"2026-08-25 17:20:06.377"}
```

Every error response uses the same envelope, produced in one place by
`errorHandler`:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Product P999 not found",
  "requestId": "fe0459b3-d3d4-4801-b593-3429b4aedee6",
  "timestamp": "2026-08-25T17:20:06.377Z",
  "path": "/api/products/P999"
}
```

### File upload endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/uploads/image` | upload a product image |
| POST | `/api/uploads/products/csv` | bulk import products from CSV |
| POST | `/api/uploads/products/:id/image` | upload an image and attach it to a product |
| GET | `/api/uploads` | list uploaded files |
| GET | `/api/uploads/:id` | one upload record |
| DELETE | `/api/uploads/:id` | delete the record and the file on disk |

Uploads are limited to 5MB, restricted by MIME type, stored under a sanitised
timestamped filename so a hostile name cannot escape the directory, and served
back from `/uploads`.

---

## 3. Folder structure

```
back-end/express/
├── app.ts                  application factory and the middleware stack
├── server.ts               listen, startup banner, graceful shutdown
├── config/index.ts         all environment configuration, read in one place
├── data/                   entity types and the seeded in-memory store
├── docs/                   OpenAPI document and Swagger UI wiring
├── errors/                 HttpError classes (400/401/403/404/409/500)
├── middleware/             the shared middleware layer
├── routes/index.ts         mounts every module under /api
├── utils/logger.ts         winston + daily rotation
└── modules/<name>/         one folder per feature, five files each:
                            <name>.routes.ts       endpoints + route middleware
                            <name>.controller.ts   HTTP in, HTTP out
                            <name>.service.ts      business logic, no Express
                            <name>.schema.ts       zod schemas and DTO types
                            <name>.test.ts         tests
```

Twelve modules follow this shape: `auth`, `companies`, `users`, `customers`,
`products`, `inventory`, `orders`, `deliveries`, `returns`, `reports`,
`suppliers`, `uploads`. The `example` module is the reference template kept for
anyone adding a thirteenth.

### The layered request path

```
Request
  -> app.ts middleware stack (context, security, parsing, logging)
  -> routes/index.ts          picks the module
  -> <name>.routes.ts         requireRoles(...) then validate(...)
  -> <name>.controller.ts     reads params/query/body, sets the status code
  -> <name>.service.ts        business logic on the in-memory store
  <- response, or an error thrown to errorHandler
```

A service never imports Express and never sees a request or response object,
so business logic can be tested without HTTP.

---

## 4. Migration notes

- **Endpoint parity is exact.** All 62 NestJS endpoints exist with the same
  paths, methods and role rules, verified by walking the registered router
  stack and diffing it against the OpenAPI document exported from NestJS.
- **A missing `x-role` header returns 403, not 401.** The NestJS `RolesGuard`
  did this, so the Express `requireRoles` reproduces it verbatim, including the
  message. An invalid or expired JWT returns 401, because that path is new.
- **Seeded passwords are hashed at startup** with bcrypt. The demo logins in
  the table above still work, but no plain text password is stored in memory,
  returned by an endpoint, or written to a log.
- **The seed data lives in `express/data/`**, not in `back-end/src/`. This keeps
  the documented cutover possible: when NestJS is retired, `back-end/src/` can
  be deleted and `back-end/express/` renamed to `back-end/src/` without a single
  import breaking.
- **Express 5 note.** `req.query` is a getter and can no longer be assigned to,
  so `validate.middleware.ts` installs the validated query with
  `Object.defineProperty`.
