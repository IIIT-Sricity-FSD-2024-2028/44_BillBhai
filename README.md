# Retail Order Processing & Billing System

## Problem Statement

Modern retail operations require a seamless, accurate, and scalable system to manage customer orders, billing, payments, inventory, delivery, returns, and reporting.  
Manual or loosely integrated processes often lead to billing errors, stock mismatches, delayed deliveries, and poor customer experience.

This project aims to design and implement a **Retail Order Processing and Billing System** that efficiently handles:

- End-to-end order lifecycle (from order creation to delivery)
- Accurate billing, discounts, taxes, and invoicing
- Inventory monitoring, replenishment, and adjustments
- Returns, refunds, and exchanges
- Sales tracking and operational reporting

The system is designed to support **both in-store and delivery-based retail workflows**, ensuring transparency, auditability, and operational efficiency.

---

## Identified Actors in this Domain

### Customer

An individual who purchases products or requests services from the store.

**Responsibilities:**

- Select products for purchase
- Avail discounts and loyalty benefits
- Make payments
- Receive bills, invoices, and receipts
- Request returns, refunds, or exchanges

---

### Cashier

Store staff responsible for order creation and billing at the point of sale.

**Responsibilities:**

- Scan and verify product barcodes
- Create and update orders
- Generate bills and invoices
- Apply discounts, loyalty benefits, and taxes
- Collect and confirm payments

---

### Return Handler 
Store staff responsible for managing customer returns, exchanges, and refunds.

**Responsibilities:**

- Verify returned items and eligibility
- Approve or reject return requests based on policy
- Process refunds and exchanges
- Coordinate with inventory updates after returns
- Ensure return records are properly logged for audit

---

### Delivery Operations Manager

Manages order dispatch and delivery lifecycle.

**Responsibilities:**

- Confirm delivery orders
- Assign delivery partners
- Track dispatch and delivery status
- Update delivery milestones

---

### Inventory Manager

Responsible for inventory availability and accuracy.

**Responsibilities:**

- Monitor stock levels
- Update inventory after sales, returns, and receipts
- Manage stock adjustments
- Trigger reorders when stock falls below reorder level

---

### Head of Operations

Oversees store-level operations and performance.

**Responsibilities:**

- Review sales and inventory reports
- Approve stock adjustments
- Monitor operational logs
- Analyze business performance

---

### Payment Gateway (External System)

Handles secure payment processing.

**Responsibilities:**

- Process digital payments (UPI, card, etc.)
- Confirm transaction status

---

## Planned Features (Actor-wise)

### Customer Features

- Product selection and order placement
- Loyalty account integration
- Discount and offer application
- Multiple payment options
- Order delivery tracking
- Return, refund, and exchange requests

---

### Cashier Features

- Barcode scanning and order verification
- Bill generation and modification
- Discount rule and tax component application
- Invoice generation post-payment
- Receipt issuance

---

### Return Handler Features

- Return request verification
- Return approval/rejection based on store policy
- Refund processing (cash / digital)
- Exchange handling (product swap / adjustment)
- Return record creation and tracking
- Return-related inventory update coordination

---

### Delivery Operations Features

- Delivery order creation
- Dispatch record generation
- Delivery partner assignment
- Delivery status updates (Out for Delivery, Delivered)

---

### Inventory Management Features

- Inventory item and stock level tracking
- Automatic stock updates after sales and returns
- Reorder level monitoring
- Goods receipt processing
- Stock adjustment handling

---

### Management & Reporting Features

- Sales tracking and analysis
- Inventory status and reorder reports
- Operational logs and audit trails
- Exportable and shareable reports

---

## Core System Modules

- Order Processing
- Billing & Invoicing
- Payment Handling
- Delivery Management
- Inventory Monitoring & Replenishment
- Returns & Refunds
- Sales & Operational Reporting

---

The system supports the following key use cases:

- Order Creation
- Billing and Invoice
- Return and Refund
- Process Order to Delivery Partner
- Sales Tracking & Report Analysis
- Inventory Monitoring, Update, and Reorder

---

## Key Highlights

- End-to-end retail workflow coverage
- Clear separation of actor responsibilities
- Return and refund flow handled by a dedicated Return Handler actor
- Audit-friendly operational logs
- Scalable design for multi-branch retail
- Supports both walk-in and delivery orders
