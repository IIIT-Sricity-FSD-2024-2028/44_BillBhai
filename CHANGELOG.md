# Changelog

BillBhai follows [semantic versioning](https://semver.org): MAJOR.MINOR.PATCH.
The API reports its version at `GET /api`; the front-end and back-end
`package.json` files carry the same number.

Besides release versions, every record a person can change (orders, products,
stock rows, suppliers, coupons, deliveries, returns, users, businesses) has its
own version: a `version` number, `createdAt`, `updatedAt` and `updatedBy`. An
edit sent with an older version is refused (409), so two people cannot silently
overwrite each other, and `GET /api/activity` shows who changed what and when.

## 2.0.0 (2026-11-18)

Rework after the evaluation with Bheemappa sir: the server is now the single
source of truth, every page reads the same data, and every write is checked.

### Breaking
- Sign-in uses the token from `POST /api/auth/login` (`Authorization: Bearer`).
  The `x-role` header is ignored outside the test suite.
- Every list and record is limited to the signed-in user's business. Only the
  super user sees across businesses.
- `PUT /api/inventory/:id` no longer accepts `stockAvailable`. Stock changes go
  through `POST /api/inventory/adjust` (with a reason) or `/receive`.
- Saved bills cannot have their total, items, discount or payment method edited.
  Cancel (`POST /api/orders/:id/cancel`) or raise a return instead.
- `POST /api/orders/bills` and `/payments` were removed: the checkout writes the
  bill and payment itself.

### Billing and the till
- Prices, discounts, GST and totals are worked out on the server from the
  catalogue. A line sent with a different price is refused (409).
- Stock is checked when the bill is quoted and again when it is saved; the till
  shows stock on every product and caps quantities.
- Payment method (Cash, UPI, Card, COD), cash received and change due.
- Delivery orders need a customer phone and address and create their delivery
  in the same request; if the delivery cannot be booked the sale is undone.
- Walk-in sales use one shared walk-in customer instead of a made-up one.
- Printed bill shows GSTIN, bill number, cashier, unit prices and GST included.
- "My sales today" for each cashier, with cash in drawer and reprint.

### Stock
- Every product has a stock row, created with the product.
- Stock ledger: every change (sale, return, cancellation, goods received,
  adjustment, exchange) is a movement with reason, person and time.
- Receive stock, adjust with a reason, stock history, reorder list.
- Suppliers are real records per business (contact, lead time, minimum order).
- Products are deactivated, not deleted, so old bills keep their lines.

### Returns
- A return is built from its order: only items on the order, quantity up to
  what was bought minus what was already returned, refund worked out from the
  price paid (discount shared out).
- Pending → Approved → Refunded / Exchanged, or Rejected with a reason.
- A refund puts the items back on the shelf (unless damaged) and updates the
  order's refunded amount and status. Return window: 30 days.

### Delivery
- Status flow enforced on the server: Pending → Assigned → Dispatched →
  Out for Delivery → Delivered; Failed Attempt (with reason, up to 3 tries);
  Returned to Store and Cancelled put stock back and cancel the order.
- Partner phone, agency, vehicle and ETA are stored. Delivered needs the
  receiver's name and, for COD, the cash collected, which records the payment.

### Coupons
- Coupons per business: percent or flat, minimum bill, cap, validity dates,
  usage limit, per-customer limit. Checked on the server at checkout.
- Coupon analytics: uses, customers (new and repeat), sales, discount given,
  average bill with and without coupons, return rate, by cashier, daily trend,
  top products. Orders can be filtered by coupon.

### Reports and admin
- One definition of money everywhere: gross sales, refunds, net sales, cash
  collected, COD still pending. Date ranges use India time.
- Plan limits (staff, products, delivery, returns, coupons) are enforced by
  the server. Business sign-up creates the business and its admin together.
- Staff passwords are never stored in the browser; new accounts get a
  temporary password shown once.
- Data is saved to `back-end/data-store/billbhai-data.json` and survives a
  restart. Delete the file, or call `POST /api/admin/reset-demo` as the super
  user, to go back to the demo data.

## 1.0.0

First React and Express version.
