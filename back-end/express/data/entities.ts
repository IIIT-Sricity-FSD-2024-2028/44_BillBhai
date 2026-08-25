/**
 * Domain Entity Types
 *
 * Shared shapes for the in-memory data store. Module schemas import these so
 * every module agrees on the shape of a Product, an Order, and so on.
 */

export interface Company {
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
}

export interface User {
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

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  mobileNo: string;
  email: string;
  address: string;
}

export interface Supplier {
  id: string;
  name: string;
  mobileNo: string;
  email: string;
  address: string;
  gstNo: string;
}

export interface Product {
  id: string;
  supplierId: string;
  name: string;
  category: string;
  barcode?: string;
  price: number;
  size?: string;
  description?: string;
  imageUrl?: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  stockAvailable: number;
  reorderLevel: number;
  location: string;
  lastUpdated: string;
  status: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName?: string;
  customerAddress?: string;
  staffId: string;
  companyId: string;
  orderDate: string;
  orderType: string;
  checkoutMode: string;
  status: string;
  discountAmount: number;
  paymentMethod: string;
  total: number;
  promoCode?: string | null;
  itemsCount?: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  itemPrice: number;
}

export interface Bill {
  billNo: string;
  orderId: string;
  billDate: string;
  taxAmount: number;
  discountAmount: number;
}

export interface Payment {
  id: string;
  billNo: string;
  paymentDate: string;
  paymentMethod: string;
  paymentStatus: string;
  amountPaid: number;
}

export interface Delivery {
  id: string;
  orderId: string;
  customerName: string;
  address: string;
  partnerName: string;
  dispatchDate: string;
  deliveryDate: string | null;
  status: string;
}

export interface ReturnRecord {
  id: string;
  companyId: string;
  orderId: string;
  staffId: string;
  returnDate: string;
  reason: string;
  refundAmount: number;
  status: string;
  returnType: string;
  product: string;
  qty: number;
  requestedBy: string;
}

/** Standard envelope returned by every module's remove() operation. */
export interface DeleteResult<T> {
  message: string;
  [key: string]: string | T;
}
