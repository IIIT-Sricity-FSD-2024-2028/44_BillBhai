/**
 * Domain Entity Types
 *
 * Shared shapes for the data store. Module schemas import these so every
 * module agrees on the shape of a Product, an Order, and so on.
 *
 * Every record a person can change carries `Versioned` fields: a version
 * number that goes up on each change, plus who changed it and when. An update
 * that sends an older `version` is rejected with 409, so two people editing
 * the same record cannot silently overwrite each other.
 */

export interface Versioned {
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface Company extends Partial<Versioned> {
  id: string;
  name: string;
  owner: string;
  adminName: string;
  type: string;
  email: string;
  phone: string;
  gstNo: string;
  address: string;
  status: string;
  productsPlan: string;
  tenureMonths: number;
  storesCount: number;
  profit: number;
  paymentDue: number;
  plan?: string;
  subscriptionStatus?: string;
  monthlyPrice?: number;
  renewalDate?: string;
  stores?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  notes?: string;
}

export interface User extends Partial<Versioned> {
  id: string;
  companyId: string;
  name: string;
  role: string;
  email: string;
  mobileNo: string;
  username: string;
  password: string;
  status: string;
}

/** A user with the credential stripped - the only shape ever sent over HTTP. */
export type SafeUser = Omit<User, 'password'>;

export interface Customer extends Partial<Versioned> {
  id: string;
  companyId: string;
  name: string;
  mobileNo: string;
  email: string;
  address: string;
}

export interface Supplier extends Partial<Versioned> {
  id: string;
  companyId: string;
  name: string;
  contactPerson?: string;
  mobileNo: string;
  email: string;
  address: string;
  gstNo: string;
  leadTimeDays?: number;
  moq?: number;
}

export interface Product extends Partial<Versioned> {
  id: string;
  companyId: string;
  supplierId: string;
  name: string;
  category: string;
  barcode?: string;
  /** Selling price, GST inclusive. */
  price: number;
  /** What the store pays the supplier per unit. */
  costPrice?: number;
  /** GST slab in percent (0, 5, 12, 18 or 28). */
  gstRate: number;
  size?: string;
  description?: string;
  imageUrl?: string;
  /** Inactive products stay on old bills but can no longer be sold. */
  active: boolean;
}

export interface InventoryItem extends Partial<Versioned> {
  id: string;
  companyId: string;
  productId: string;
  stockAvailable: number;
  reorderLevel: number;
  location: string;
  lastUpdated: string;
  status: string;
}

/** Why a stock count changed. Every change to stockAvailable writes one. */
export type StockMovementType =
  | 'opening'
  | 'sale'
  | 'return'
  | 'cancel'
  | 'receive'
  | 'adjust'
  | 'exchange';

export interface StockMovement {
  id: string;
  companyId: string;
  productId: string;
  type: StockMovementType;
  /** Signed: positive puts stock back on the shelf, negative takes it off. */
  quantity: number;
  balanceAfter: number;
  reason: string;
  refType?: string;
  refId?: string;
  by: string;
  at: string;
}

export interface Order extends Partial<Versioned> {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  staffId: string;
  staffName?: string;
  companyId: string;
  orderDate: string;
  orderType: string;
  checkoutMode: string;
  status: string;
  subtotal?: number;
  discountAmount: number;
  deliveryCharge?: number;
  taxAmount?: number;
  paymentMethod: string;
  /** Paid, Pending (COD not yet collected), Refunded, Partially Refunded, Voided. */
  paymentStatus?: string;
  total: number;
  refundedAmount?: number;
  promoCode?: string | null;
  itemsCount?: number;
  notes?: string;
  cancelReason?: string;
  deleted?: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName?: string;
  quantity: number;
  /** Unit price charged, taken from the product at the time of sale. */
  itemPrice: number;
  gstRate?: number;
}

export interface Bill {
  billNo: string;
  orderId: string;
  companyId?: string;
  billDate: string;
  subtotal?: number;
  taxAmount: number;
  discountAmount: number;
  deliveryCharge?: number;
  total?: number;
}

export interface Payment {
  id: string;
  billNo: string;
  orderId?: string;
  companyId?: string;
  paymentDate: string;
  paymentMethod: string;
  paymentStatus: string;
  amountPaid: number;
  collectedBy?: string;
}

export interface DeliveryEvent {
  status: string;
  at: string;
  by: string;
  note?: string;
}

export interface Delivery extends Partial<Versioned> {
  id: string;
  companyId?: string;
  orderId: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  partnerName: string;
  partnerPhone?: string;
  partnerAgency?: string;
  partnerVehicle?: string;
  etaMinutes?: number;
  dispatchDate: string;
  deliveryDate: string | null;
  status: string;
  /** Cash the partner must collect at the door (0 for prepaid orders). */
  codAmount?: number;
  cashCollected?: number;
  attempts?: number;
  failureReason?: string;
  receiverName?: string;
  history?: DeliveryEvent[];
}

export interface ReturnLine {
  productId: string;
  productName: string;
  qty: number;
  /** Price paid per unit after the order's discount was shared out. */
  unitPrice: number;
  amount: number;
}

export interface ReturnRecord extends Partial<Versioned> {
  id: string;
  companyId: string;
  orderId: string;
  staffId: string;
  returnDate: string;
  reason: string;
  refundAmount: number;
  status: string;
  returnType: string;
  /** Display summary of the lines, e.g. "Milk ×2, Bread Loaf ×1". */
  product: string;
  qty: number;
  items?: ReturnLine[];
  requestedBy: string;
  refundMethod?: string;
  restock?: boolean;
  rejectReason?: string;
  note?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Coupon extends Partial<Versioned> {
  id: string;
  companyId: string;
  code: string;
  description?: string;
  /** percent: value is a percentage. flat: value is rupees off. */
  type: 'percent' | 'flat';
  value: number;
  minOrder: number;
  /** Cap on the discount for percent coupons (0 = no cap). */
  maxDiscount: number;
  validFrom: string;
  validTo: string;
  /** Total redemptions allowed (0 = unlimited). */
  usageLimit: number;
  /** Redemptions allowed per customer (0 = unlimited). */
  perCustomerLimit: number;
  active: boolean;
}

export interface ActivityEntry {
  id: string;
  companyId: string;
  entity: string;
  entityId: string;
  action: string;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  by: string;
  at: string;
}

/** Standard envelope returned by every module's remove() operation. */
export interface DeleteResult<T> {
  message: string;
  [key: string]: string | T;
}
