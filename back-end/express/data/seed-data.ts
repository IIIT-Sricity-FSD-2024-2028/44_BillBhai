/**
 * SEED DATA - initial state of the data store.
 *
 * The seed is built so that every number agrees with every other number:
 * each order's total is worked out from its lines with the same helpers the
 * live checkout uses, every sale has a stock movement, every paid order has a
 * bill and a payment, and today's stock is what the opening stock minus the
 * history of sales and returns leaves. Nothing here is typed in twice.
 *
 * A few named records (ORD-4829, ORD-4828, ORD-4827, RET-220, RET-221,
 * DEL-900, DEL-901) are fixed so tests and demos can point at them. The rest of
 * the history (about 45 days of sales) is generated with a seeded random
 * number generator, so it is the same on every start, with dates counted back
 * from the moment the server started.
 *
 * Demo credentials are stored in plain text here purely so the seeded logins
 * documented in the README keep working. UsersService hashes every one of them
 * with bcrypt at startup, and no plain text password is ever compared,
 * returned, or written to a log.
 */

import {
  Bill,
  Company,
  Coupon,
  Customer,
  Delivery,
  DeliveryEvent,
  InventoryItem,
  Order,
  OrderItem,
  Payment,
  Product,
  ReturnRecord,
  StockMovement,
  Supplier,
  User,
} from './entities';
import { inclusiveTax, linesSubtotal, netUnitPrice, round2 } from '../utils/money';

const SEED_NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET = 330 * 60 * 1000;
const HISTORY_DAYS = 45;
const HISTORY_START = new Date(SEED_NOW - (HISTORY_DAYS + 1) * DAY).toISOString();

function stamp(): { version: number; createdAt: string; updatedAt: string } {
  return { version: 1, createdAt: HISTORY_START, updatedAt: HISTORY_START };
}

/** An instant `daysAgo` days back at the given India time of day. */
function istMoment(daysAgo: number, hour: number, minute: number): number {
  const nowIst = new Date(SEED_NOW + IST_OFFSET);
  const base = Date.UTC(
    nowIst.getUTCFullYear(),
    nowIst.getUTCMonth(),
    nowIst.getUTCDate() - daysAgo,
    hour,
    minute,
  );
  return base - IST_OFFSET;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Companies, users, customers, suppliers                              */
/* ------------------------------------------------------------------ */

export const PLATFORM_COMPANY_ID = 'PLATFORM';

export const seedCompanies: Company[] = [
  {
    id: 'BIZ-101',
    name: 'FreshKart Central',
    owner: 'Ritu Malhotra',
    adminName: 'Arjun Mehta',
    type: 'Grocery Retail',
    email: 'central@freshkart.in',
    phone: '+91-9870011101',
    gstNo: '07AABCF1234K1Z5',
    address: '14 Connaught Place, New Delhi 110001',
    status: 'Active',
    productsPlan: 'Growth / Pro',
    plan: 'pro',
    subscriptionStatus: 'Active',
    monthlyPrice: 1999,
    renewalDate: new Date(SEED_NOW + 20 * DAY).toISOString().slice(0, 10),
    tenureMonths: 32,
    storesCount: 6,
    profit: 0,
    paymentDue: 0,
    ...stamp(),
  },
  {
    id: 'BIZ-102',
    name: 'Metro Mart East',
    owner: 'Aman Bedi',
    adminName: 'Shreya Nair',
    type: 'Supermarket',
    email: 'ops@metromarteast.in',
    phone: '+91-9870011102',
    gstNo: '19AACCM5678L1Z2',
    address: '22 Park Street, Kolkata 700016',
    status: 'Active',
    productsPlan: 'Growth / Pro',
    plan: 'pro',
    subscriptionStatus: 'Active',
    monthlyPrice: 1999,
    renewalDate: new Date(SEED_NOW + 9 * DAY).toISOString().slice(0, 10),
    tenureMonths: 18,
    storesCount: 4,
    profit: 0,
    paymentDue: 15000,
    ...stamp(),
  },
];

function user(
  id: string,
  companyId: string,
  name: string,
  role: string,
  username: string,
  password: string,
  mobileNo: string,
  email: string,
): User {
  return { id, companyId, name, role, email, mobileNo, username, password, status: 'Active', ...stamp() };
}

export const seedUsers: User[] = [
  user('USR-001', 'BIZ-101', 'Arjun Mehta', 'admin', 'admin', 'admin123', '9870011201', 'admin@billbhai.com'),
  user('USR-002', 'BIZ-101', 'Komal Shah', 'cashier', 'cashier', 'cashier123', '9870011202', 'cashier@billbhai.com'),
  user('USR-003', 'BIZ-101', 'Irfan Ali', 'inventorymanager', 'inventorymanager', 'inventory123', '9870011203', 'inventorymanager@billbhai.com'),
  user('USR-004', 'BIZ-101', 'Gopal Yadav', 'deliveryops', 'deliveryops', 'delivery123', '9870011204', 'deliveryops@billbhai.com'),
  user('USR-005', 'BIZ-101', 'Hemant Rawat', 'returnhandler', 'returnhandler', 'return123', '9870011205', 'returnhandler@billbhai.com'),
  user('USR-006', PLATFORM_COMPANY_ID, 'Chirag', 'superuser', 'chirag', 'chirag1234', '9870011206', 'chirag@billbhai.com'),
  user('USR-007', 'BIZ-101', 'Demo Customer', 'customer', 'customer', 'customer123', '9810001999', 'customer@demo.com'),
  user('USR-008', 'BIZ-102', 'Shreya Nair', 'admin', 'metroadmin', 'metro123', '9870011208', 'admin@metromarteast.in'),
  user('USR-009', 'BIZ-102', 'Tanmay Das', 'cashier', 'metrocashier', 'metro123', '9870011209', 'cashier@metromarteast.in'),
];

function customer(id: string, companyId: string, name: string, mobileNo: string, email: string, address: string): Customer {
  return { id, companyId, name, mobileNo, email, address, ...stamp() };
}

/** The one shared record each store uses for customers who give no details. */
export const WALK_IN_CUSTOMER_IDS: Record<string, string> = {
  'BIZ-101': 'CUS-900',
  'BIZ-102': 'CUS-901',
};

export const seedCustomers: Customer[] = [
  customer('CUS-001', 'BIZ-101', 'Rahul Sharma', '9810001001', 'rahul@example.com', '12, MG Road, Sector 14'),
  customer('CUS-002', 'BIZ-101', 'Priya Patel', '9810001002', 'priya@example.com', 'A-204, Green Park'),
  customer('CUS-003', 'BIZ-101', 'Amit Kumar', '9810001003', 'amit@example.com', 'Plot 7, Industrial Area'),
  customer('CUS-004', 'BIZ-101', 'Sneha Gupta', '9810001004', 'sneha@example.com', '302, Lotus Tower'),
  customer('CUS-005', 'BIZ-101', 'Vikram Joshi', '9810001005', 'vikram@example.com', 'H.No 15, Civil Lines'),
  customer('CUS-006', 'BIZ-101', 'Anjali Verma', '9810001006', 'anjali@example.com', 'B-11, Lajpat Nagar'),
  customer('CUS-007', 'BIZ-101', 'Rohit Bansal', '9810001007', '', '7, Karol Bagh Market'),
  customer('CUS-008', 'BIZ-101', 'Fatima Khan', '9810001008', 'fatima@example.com', '45, Jamia Nagar'),
  customer('CUS-009', 'BIZ-101', 'Karan Malhotra', '9810001009', '', 'C-9, Rajouri Garden'),
  customer('CUS-010', 'BIZ-101', 'Meera Iyer', '9810001010', 'meera@example.com', '19, Hauz Khas Village'),
  customer('CUS-900', 'BIZ-101', 'Walk-in Customer', '', '', ''),
  customer('CUS-101', 'BIZ-102', 'Sourav Ghosh', '9830002001', 'sourav@example.com', '8, Salt Lake Sector II'),
  customer('CUS-102', 'BIZ-102', 'Ritika Sen', '9830002002', '', '21, Ballygunge Place'),
  customer('CUS-103', 'BIZ-102', 'Arindam Bose', '9830002003', 'arindam@example.com', '5, New Town Action Area I'),
  customer('CUS-901', 'BIZ-102', 'Walk-in Customer', '', '', ''),
];

function supplier(
  id: string,
  companyId: string,
  name: string,
  contactPerson: string,
  mobileNo: string,
  email: string,
  address: string,
  gstNo: string,
  leadTimeDays: number,
  moq: number,
): Supplier {
  return { id, companyId, name, contactPerson, mobileNo, email, address, gstNo, leadTimeDays, moq, ...stamp() };
}

export const seedSuppliers: Supplier[] = [
  supplier('SUP-001', 'BIZ-101', 'Agarwal Traders', 'Sanjay Agarwal', '9811544101', 'sanjay@agarwaltraders.in', 'Naya Bazar, Delhi', '07AAFCA1111A1Z1', 2, 25),
  supplier('SUP-002', 'BIZ-101', 'Sharma Wholesale', 'Neha Sharma', '9891722055', 'orders@sharmawholesale.in', 'Khari Baoli, Delhi', '07AAFCS2222B1Z2', 3, 30),
  supplier('SUP-003', 'BIZ-101', 'Fortune Dist.', 'Ritesh Jain', '9900411233', 'north@fortunedist.in', 'Okhla Phase II, Delhi', '07AAFCF3333C1Z3', 4, 20),
  supplier('SUP-004', 'BIZ-101', 'City Dairy', 'Mehul Shah', '9717055544', 'supply@citydairy.in', 'Azadpur, Delhi', '07AAFCC4444D1Z4', 1, 40),
  supplier('SUP-005', 'BIZ-101', 'SnackHub Foods', 'Varun Sethi', '9910077442', 'supply@snackhubfoods.in', 'Noida Sector 63', '09AAFCS5555E1Z5', 2, 48),
  supplier('SUP-006', 'BIZ-101', 'Cool Bev', 'Ankita Roy', '9818033021', 'ops@coolbev.in', 'Gurugram Sector 18', '06AAFCC6666F1Z6', 2, 36),
  supplier('SUP-007', 'BIZ-101', 'HomeSpark Supplies', 'Pallavi Jain', '9810156512', 'care@homespark.in', 'Mayapuri, Delhi', '07AAFCH7777G1Z7', 3, 18),
  supplier('SUP-101', 'BIZ-102', 'Bengal Staples Co.', 'Debashis Roy', '9831100101', 'orders@bengalstaples.in', 'Burrabazar, Kolkata', '19AAFCB8888H1Z8', 2, 20),
  supplier('SUP-102', 'BIZ-102', 'Eastern Dairy Farms', 'Moumita Paul', '9831100102', 'supply@easterndairy.in', 'Barasat, Kolkata', '19AAFCE9999J1Z9', 1, 30),
  supplier('SUP-103', 'BIZ-102', 'Hooghly Home Care', 'Sanjib Dutta', '9831100103', 'care@hooghlyhome.in', 'Howrah', '19AAFCH1010K1Z0', 3, 12),
];

/* ------------------------------------------------------------------ */
/* Catalogue and target stock                                          */
/* ------------------------------------------------------------------ */

interface CatalogueRow {
  id: string;
  companyId: string;
  supplierId: string;
  name: string;
  category: string;
  price: number;
  gstRate: number;
  size: string;
  description: string;
  /** Units on the shelf at the moment the server starts. */
  stockNow: number;
  reorderLevel: number;
  location: string;
  /** Relative popularity used by the history generator. */
  weight: number;
}

const CATALOGUE: CatalogueRow[] = [
  { id: 'P001', companyId: 'BIZ-101', supplierId: 'SUP-001', name: 'Basmati Rice', category: 'Groceries', price: 380, gstRate: 5, size: '5kg', description: 'Premium basmati rice', stockNow: 145, reorderLevel: 20, location: 'Shelf A1', weight: 5 },
  { id: 'P002', companyId: 'BIZ-101', supplierId: 'SUP-002', name: 'Toor Dal', category: 'Groceries', price: 120, gstRate: 5, size: '1kg', description: 'Yellow split pigeon peas', stockNow: 230, reorderLevel: 20, location: 'Shelf A2', weight: 6 },
  { id: 'P003', companyId: 'BIZ-101', supplierId: 'SUP-003', name: 'Refined Oil', category: 'Groceries', price: 155, gstRate: 5, size: '1L', description: 'Refined sunflower oil', stockNow: 18, reorderLevel: 20, location: 'Shelf A3', weight: 5 },
  { id: 'P004', companyId: 'BIZ-101', supplierId: 'SUP-004', name: 'Amul Butter', category: 'Dairy', price: 275, gstRate: 12, size: '500g', description: 'Pasteurised butter', stockNow: 32, reorderLevel: 10, location: 'Chiller 1', weight: 3 },
  { id: 'P005', companyId: 'BIZ-101', supplierId: 'SUP-004', name: 'Milk', category: 'Dairy', price: 60, gstRate: 0, size: '1L', description: 'Full cream milk', stockNow: 14, reorderLevel: 20, location: 'Chiller 1', weight: 9 },
  { id: 'P006', companyId: 'BIZ-101', supplierId: 'SUP-005', name: 'Bread Loaf', category: 'Bakery', price: 45, gstRate: 0, size: 'Regular', description: 'Whole wheat bread', stockNow: 26, reorderLevel: 15, location: 'Rack B4', weight: 7 },
  { id: 'P007', companyId: 'BIZ-101', supplierId: 'SUP-005', name: 'Maggi Noodles', category: 'Snacks', price: 54, gstRate: 12, size: 'Pack of 4', description: 'Instant noodles', stockNow: 96, reorderLevel: 20, location: 'Rack C3', weight: 6 },
  { id: 'P008', companyId: 'BIZ-101', supplierId: 'SUP-006', name: 'Tea Powder', category: 'Beverages', price: 160, gstRate: 5, size: '250g', description: 'Premium tea', stockNow: 58, reorderLevel: 12, location: 'Rack D2', weight: 4 },
  { id: 'P009', companyId: 'BIZ-101', supplierId: 'SUP-006', name: 'Coffee Jar', category: 'Beverages', price: 180, gstRate: 18, size: '100g', description: 'Instant coffee', stockNow: 7, reorderLevel: 10, location: 'Rack D2', weight: 2 },
  { id: 'P010', companyId: 'BIZ-101', supplierId: 'SUP-001', name: 'Atta Flour', category: 'Groceries', price: 248, gstRate: 5, size: '5kg', description: 'Whole wheat flour', stockNow: 122, reorderLevel: 15, location: 'Shelf A4', weight: 4 },
  { id: 'P011', companyId: 'BIZ-101', supplierId: 'SUP-002', name: 'Sugar', category: 'Groceries', price: 48, gstRate: 5, size: '1kg', description: 'Refined sugar', stockNow: 64, reorderLevel: 10, location: 'Shelf A5', weight: 5 },
  { id: 'P012', companyId: 'BIZ-101', supplierId: 'SUP-004', name: 'Paneer', category: 'Dairy', price: 78, gstRate: 5, size: '200g', description: 'Fresh cottage cheese', stockNow: 21, reorderLevel: 25, location: 'Chiller 2', weight: 4 },
  { id: 'P013', companyId: 'BIZ-101', supplierId: 'SUP-004', name: 'Curd Cup', category: 'Dairy', price: 26, gstRate: 5, size: '200g', description: 'Fresh curd', stockNow: 88, reorderLevel: 10, location: 'Chiller 2', weight: 5 },
  { id: 'P014', companyId: 'BIZ-101', supplierId: 'SUP-005', name: 'Potato Chips', category: 'Snacks', price: 20, gstRate: 12, size: 'Classic', description: 'Salted potato chips', stockNow: 172, reorderLevel: 15, location: 'Rack C1', weight: 6 },
  { id: 'P015', companyId: 'BIZ-101', supplierId: 'SUP-005', name: 'Biscuits', category: 'Snacks', price: 12, gstRate: 18, size: 'Single Pack', description: 'Glucose biscuits', stockNow: 154, reorderLevel: 15, location: 'Rack C2', weight: 6 },
  { id: 'P016', companyId: 'BIZ-101', supplierId: 'SUP-006', name: 'Orange Juice', category: 'Beverages', price: 42, gstRate: 12, size: '500ml', description: 'Fresh orange juice', stockNow: 37, reorderLevel: 10, location: 'Chiller 3', weight: 3 },
  { id: 'P017', companyId: 'BIZ-101', supplierId: 'SUP-006', name: 'Mineral Water', category: 'Beverages', price: 20, gstRate: 18, size: '1L', description: 'Packaged drinking water', stockNow: 9, reorderLevel: 15, location: 'Rack D1', weight: 5 },
  { id: 'P018', companyId: 'BIZ-101', supplierId: 'SUP-007', name: 'Bath Soap', category: 'Home Care', price: 34, gstRate: 18, size: 'Single', description: 'Herbal bath soap', stockNow: 74, reorderLevel: 20, location: 'Rack E3', weight: 3 },
  { id: 'P019', companyId: 'BIZ-101', supplierId: 'SUP-007', name: 'Dishwash Liquid', category: 'Home Care', price: 58, gstRate: 18, size: '250ml', description: 'Lemon dishwash liquid', stockNow: 48, reorderLevel: 10, location: 'Shelf E1', weight: 3 },
  { id: 'P020', companyId: 'BIZ-101', supplierId: 'SUP-007', name: 'Detergent Powder', category: 'Home Care', price: 96, gstRate: 18, size: '1kg', description: 'Washing powder', stockNow: 0, reorderLevel: 10, location: 'Shelf E2', weight: 3 },
  { id: 'P101', companyId: 'BIZ-102', supplierId: 'SUP-101', name: 'Gobindobhog Rice', category: 'Groceries', price: 140, gstRate: 5, size: '1kg', description: 'Aromatic short-grain rice', stockNow: 80, reorderLevel: 15, location: 'Aisle 1', weight: 5 },
  { id: 'P102', companyId: 'BIZ-102', supplierId: 'SUP-101', name: 'Mustard Oil', category: 'Groceries', price: 185, gstRate: 5, size: '1L', description: 'Kachi ghani mustard oil', stockNow: 12, reorderLevel: 15, location: 'Aisle 1', weight: 4 },
  { id: 'P103', companyId: 'BIZ-102', supplierId: 'SUP-101', name: 'Masoor Dal', category: 'Groceries', price: 110, gstRate: 5, size: '1kg', description: 'Red lentils', stockNow: 64, reorderLevel: 10, location: 'Aisle 2', weight: 4 },
  { id: 'P104', companyId: 'BIZ-102', supplierId: 'SUP-102', name: 'Mishti Doi', category: 'Dairy', price: 40, gstRate: 5, size: '200g', description: 'Sweet set curd', stockNow: 30, reorderLevel: 12, location: 'Chiller A', weight: 6 },
  { id: 'P105', companyId: 'BIZ-102', supplierId: 'SUP-102', name: 'Toned Milk', category: 'Dairy', price: 54, gstRate: 0, size: '1L', description: 'Toned milk', stockNow: 40, reorderLevel: 20, location: 'Chiller A', weight: 7 },
  { id: 'P106', companyId: 'BIZ-102', supplierId: 'SUP-103', name: 'Floor Cleaner', category: 'Home Care', price: 99, gstRate: 18, size: '500ml', description: 'Pine floor cleaner', stockNow: 22, reorderLevel: 8, location: 'Aisle 5', weight: 2 },
  { id: 'P107', companyId: 'BIZ-102', supplierId: 'SUP-103', name: 'Toothpaste', category: 'Personal Care', price: 95, gstRate: 18, size: '150g', description: 'Fluoride toothpaste', stockNow: 3, reorderLevel: 10, location: 'Aisle 6', weight: 3 },
  { id: 'P108', companyId: 'BIZ-102', supplierId: 'SUP-101', name: 'Puffed Rice', category: 'Snacks', price: 30, gstRate: 5, size: '500g', description: 'Muri', stockNow: 55, reorderLevel: 10, location: 'Aisle 3', weight: 4 },
];

export const seedProducts: Product[] = CATALOGUE.map((row) => ({
  id: row.id,
  companyId: row.companyId,
  supplierId: row.supplierId,
  name: row.name,
  category: row.category,
  barcode: `89012${row.id.replace(/\D/g, '').padStart(5, '0')}`,
  price: row.price,
  costPrice: round2(row.price * 0.78),
  gstRate: row.gstRate,
  size: row.size,
  description: row.description,
  active: true,
  ...stamp(),
}));

/* ------------------------------------------------------------------ */
/* Coupons                                                             */
/* ------------------------------------------------------------------ */

function isoDay(daysFromNow: number): string {
  return new Date(SEED_NOW + daysFromNow * DAY).toISOString().slice(0, 10);
}

export const seedCoupons: Coupon[] = [
  { id: 'CPN-001', companyId: 'BIZ-101', code: 'WELCOME10', description: '10% off for every customer', type: 'percent', value: 10, minOrder: 0, maxDiscount: 150, validFrom: isoDay(-120), validTo: isoDay(120), usageLimit: 0, perCustomerLimit: 0, active: true, ...stamp() },
  { id: 'CPN-002', companyId: 'BIZ-101', code: 'FLAT50', description: '₹50 off on bills of ₹500 or more', type: 'flat', value: 50, minOrder: 500, maxDiscount: 0, validFrom: isoDay(-60), validTo: isoDay(60), usageLimit: 200, perCustomerLimit: 3, active: true, ...stamp() },
  { id: 'CPN-003', companyId: 'BIZ-101', code: 'DIWALI15', description: 'Festive 15% off, capped at ₹200', type: 'percent', value: 15, minOrder: 300, maxDiscount: 200, validFrom: isoDay(-30), validTo: isoDay(-18), usageLimit: 100, perCustomerLimit: 1, active: true, ...stamp() },
  { id: 'CPN-004', companyId: 'BIZ-101', code: 'SUMMER20', description: 'Summer sale (ended)', type: 'percent', value: 20, minOrder: 400, maxDiscount: 250, validFrom: isoDay(-200), validTo: isoDay(-140), usageLimit: 0, perCustomerLimit: 0, active: false, ...stamp() },
  { id: 'CPN-101', companyId: 'BIZ-102', code: 'WELCOME10', description: '10% off for every customer', type: 'percent', value: 10, minOrder: 0, maxDiscount: 100, validFrom: isoDay(-120), validTo: isoDay(120), usageLimit: 0, perCustomerLimit: 0, active: true, ...stamp() },
  { id: 'CPN-102', companyId: 'BIZ-102', code: 'PUJA100', description: '₹100 off on ₹1,000+', type: 'flat', value: 100, minOrder: 1000, maxDiscount: 0, validFrom: isoDay(-40), validTo: isoDay(20), usageLimit: 50, perCustomerLimit: 1, active: true, ...stamp() },
];

/** Discount a coupon gives on a subtotal (no validity checks). */
export function couponDiscount(coupon: Coupon, subtotal: number): number {
  const raw = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
  const capped = coupon.type === 'percent' && coupon.maxDiscount > 0 ? Math.min(raw, coupon.maxDiscount) : raw;
  return round2(Math.min(subtotal, Math.max(0, capped)));
}

/* ------------------------------------------------------------------ */
/* History generator                                                   */
/* ------------------------------------------------------------------ */

export const DELIVERY_PARTNERS = [
  { name: 'Rajesh K.', phone: '9821444770', agency: 'SwiftDrop Logistics', vehicle: 'Bike DL3S AB 4471' },
  { name: 'Sunil M.', phone: '9810431852', agency: 'Metro Last Mile', vehicle: 'Bike DL8S CF 2210' },
  { name: 'Deepak R.', phone: '9873922815', agency: 'RapidX Couriers', vehicle: 'Scooter DL5S Q 9081' },
  { name: 'Imran S.', phone: '9876012345', agency: 'In-house', vehicle: 'Cycle' },
];

export const seedOrders: Order[] = [];
export const seedOrderItems: OrderItem[] = [];
export const seedBills: Bill[] = [];
export const seedPayments: Payment[] = [];
export const seedDeliveries: Delivery[] = [];
export const seedReturns: ReturnRecord[] = [];
export const seedStockMovements: StockMovement[] = [];

const productById = new Map(seedProducts.map((p) => [p.id, p]));
const customerById = new Map(seedCustomers.map((c) => [c.id, c]));
const userById = new Map(seedUsers.map((u) => [u.id, u]));
/** Net units that leave the shelf, per product, over the whole history. */
const unitsOut = new Map<string, number>();
const pendingMoves: Array<Omit<StockMovement, 'id' | 'balanceAfter'>> = [];

let orderSeq = 4400;
let itemSeq = 1;
let billSeq = 1;
let paySeq = 1;
let delSeq = 800;
let retSeq = 200;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

interface DraftLine {
  productId: string;
  quantity: number;
}

interface DraftOrder {
  id?: string;
  companyId: string;
  at: number;
  customerId: string;
  staffId: string;
  mode: 'takeaway_now' | 'prepaid_delivery' | 'cod_delivery';
  paymentMethod: string;
  lines: DraftLine[];
  couponCode?: string;
  /** Final state for delivery orders. */
  deliveryState?: 'Pending' | 'Assigned' | 'Dispatched' | 'Out for Delivery' | 'Delivered' | 'Returned to Store';
  cancelled?: string;
  partnerIndex?: number;
}

function buildOrder(draft: DraftOrder): Order {
  const id = draft.id ?? `ORD-${orderSeq++}`;
  const cust = customerById.get(draft.customerId)!;
  const staff = userById.get(draft.staffId)!;
  const priced = draft.lines.map((line) => {
    const product = productById.get(line.productId)!;
    return { ...line, itemPrice: product.price, gstRate: product.gstRate, productName: product.name };
  });
  const subtotal = linesSubtotal(priced);
  const coupon = draft.couponCode
    ? seedCoupons.find((c) => c.companyId === draft.companyId && c.code === draft.couponCode)
    : undefined;
  const discount = coupon ? couponDiscount(coupon, subtotal) : 0;
  const isDelivery = draft.mode !== 'takeaway_now';
  const deliveryCharge = isDelivery && subtotal - discount < 500 ? 30 : 0;
  const total = round2(subtotal - discount + deliveryCharge);
  const taxAmount = inclusiveTax(priced, discount);
  const at = iso(draft.at);

  let status = isDelivery ? 'Processing' : 'Delivered';
  let paymentStatus = draft.mode === 'cod_delivery' ? 'Pending' : 'Paid';
  if (isDelivery) {
    const state = draft.deliveryState ?? 'Delivered';
    if (state === 'Dispatched' || state === 'Out for Delivery') status = 'Shipped';
    if (state === 'Delivered') {
      status = 'Delivered';
      paymentStatus = 'Paid';
    }
    if (state === 'Returned to Store') {
      status = 'Cancelled';
      paymentStatus = draft.mode === 'cod_delivery' ? 'Voided' : 'Refunded';
    }
  }
  if (draft.cancelled) {
    status = 'Cancelled';
    paymentStatus = paymentStatus === 'Paid' ? 'Refunded' : 'Voided';
  }

  const order: Order = {
    id,
    customerId: cust.id,
    customerName: cust.name,
    customerPhone: cust.mobileNo || undefined,
    customerAddress: isDelivery ? cust.address : undefined,
    staffId: staff.id,
    staffName: staff.name,
    companyId: draft.companyId,
    orderDate: at,
    orderType: isDelivery ? 'delivery' : 'pickup',
    checkoutMode: draft.mode,
    status,
    subtotal,
    discountAmount: discount,
    deliveryCharge,
    taxAmount,
    paymentMethod: draft.paymentMethod,
    paymentStatus,
    total,
    refundedAmount: paymentStatus === 'Refunded' ? total : 0,
    promoCode: coupon ? coupon.code : null,
    itemsCount: priced.reduce((sum, line) => sum + line.quantity, 0),
    cancelReason: draft.cancelled,
    version: 1,
    createdAt: at,
    updatedAt: at,
    updatedBy: staff.username,
  };
  seedOrders.push(order);

  priced.forEach((line) => {
    seedOrderItems.push({
      id: `OI-${String(itemSeq++).padStart(4, '0')}`,
      orderId: id,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      itemPrice: line.itemPrice,
      gstRate: line.gstRate,
    });
    unitsOut.set(line.productId, (unitsOut.get(line.productId) ?? 0) + line.quantity);
    pendingMoves.push({
      companyId: draft.companyId,
      productId: line.productId,
      type: 'sale',
      quantity: -line.quantity,
      reason: `Sold on ${id}`,
      refType: 'order',
      refId: id,
      by: staff.username,
      at,
    });
  });

  const billNo = `BILL-${String(billSeq++).padStart(4, '0')}`;
  seedBills.push({
    billNo,
    orderId: id,
    companyId: draft.companyId,
    billDate: at,
    subtotal,
    taxAmount,
    discountAmount: discount,
    deliveryCharge,
    total,
  });

  const restocked = status === 'Cancelled';
  if (restocked) {
    const cancelAt = iso(draft.at + 3 * 60 * 60 * 1000);
    priced.forEach((line) => {
      unitsOut.set(line.productId, (unitsOut.get(line.productId) ?? 0) - line.quantity);
      pendingMoves.push({
        companyId: draft.companyId,
        productId: line.productId,
        type: 'cancel',
        quantity: line.quantity,
        reason: draft.cancelled ? `Order cancelled: ${draft.cancelled}` : `Returned to store on ${id}`,
        refType: 'order',
        refId: id,
        by: draft.cancelled ? 'admin' : 'deliveryops',
        at: cancelAt,
      });
    });
  }

  const paidAtCheckout = draft.mode !== 'cod_delivery';
  if (paidAtCheckout || paymentStatus === 'Paid') {
    seedPayments.push({
      id: `PAY-${String(paySeq++).padStart(4, '0')}`,
      billNo,
      orderId: id,
      companyId: draft.companyId,
      paymentDate: paidAtCheckout ? at : iso(draft.at + 5 * 60 * 60 * 1000),
      paymentMethod: paidAtCheckout ? draft.paymentMethod : 'Cash',
      paymentStatus: 'Paid',
      amountPaid: total,
      collectedBy: paidAtCheckout ? staff.username : 'deliveryops',
    });
  }

  if (isDelivery) buildDelivery(order, draft);
  return order;
}

function buildDelivery(order: Order, draft: DraftOrder): void {
  const state = draft.cancelled ? 'Cancelled' : draft.deliveryState ?? 'Delivered';
  const partner = DELIVERY_PARTNERS[(draft.partnerIndex ?? 0) % DELIVERY_PARTNERS.length];
  const at = draft.at;
  const history: DeliveryEvent[] = [{ status: 'Pending', at: iso(at), by: 'cashier', note: 'Created at checkout' }];
  const step = (status: string, minutes: number, by = 'deliveryops', note?: string): void => {
    history.push({ status, at: iso(at + minutes * 60 * 1000), by, note });
  };
  const assigned = state !== 'Pending' && state !== 'Cancelled';
  if (assigned) step('Assigned', 10);
  if (['Dispatched', 'Out for Delivery', 'Delivered', 'Returned to Store'].includes(state)) step('Dispatched', 25);
  if (['Out for Delivery', 'Delivered', 'Returned to Store'].includes(state)) step('Out for Delivery', 40);
  if (state === 'Delivered') step('Delivered', 75, 'deliveryops', `Received by ${order.customerName}`);
  if (state === 'Returned to Store') {
    step('Failed Attempt', 80, 'deliveryops', 'Customer not reachable');
    step('Returned to Store', 180, 'deliveryops', 'Stock put back');
  }
  if (state === 'Cancelled') step('Cancelled', 60, 'admin', order.cancelReason);
  const last = history[history.length - 1];
  seedDeliveries.push({
    id: draft.id === 'ORD-4829' ? 'DEL-901' : draft.id === 'ORD-4828' ? 'DEL-900' : `DEL-${delSeq++}`,
    companyId: order.companyId,
    orderId: order.id,
    customerName: order.customerName ?? '',
    customerPhone: order.customerPhone,
    address: order.customerAddress ?? '',
    partnerName: assigned ? partner.name : '',
    partnerPhone: assigned ? partner.phone : '',
    partnerAgency: assigned ? partner.agency : '',
    partnerVehicle: assigned ? partner.vehicle : '',
    etaMinutes: assigned ? 45 : undefined,
    dispatchDate: iso(at + 25 * 60 * 1000).slice(0, 10),
    deliveryDate: state === 'Delivered' ? iso(at + 75 * 60 * 1000) : null,
    status: state,
    codAmount: order.checkoutMode === 'cod_delivery' ? order.total : 0,
    cashCollected: state === 'Delivered' && order.checkoutMode === 'cod_delivery' ? order.total : 0,
    attempts: state === 'Returned to Store' ? 1 : 0,
    failureReason: state === 'Returned to Store' ? 'Customer not reachable' : undefined,
    receiverName: state === 'Delivered' ? order.customerName : undefined,
    history,
    version: history.length,
    createdAt: iso(at),
    updatedAt: last.at,
    updatedBy: last.by,
  });
}

function addReturn(
  order: Order,
  productId: string,
  qty: number,
  reason: string,
  status: 'Pending' | 'Approved' | 'Refunded' | 'Rejected' | 'Exchanged',
  daysAfter: number,
  options: { id?: string; restock?: boolean; rejectReason?: string; refundMethod?: string; returnType?: string } = {},
): void {
  const line = seedOrderItems.find((i) => i.orderId === order.id && i.productId === productId)!;
  const unit = netUnitPrice(line.itemPrice, order.subtotal ?? 0, order.discountAmount);
  const returnType = options.returnType ?? 'refund';
  const amount = returnType === 'exchange' ? 0 : round2(unit * qty);
  const raisedAt = new Date(order.orderDate).getTime() + daysAfter * DAY;
  const resolved = status !== 'Pending' && status !== 'Approved';
  const id = options.id ?? `RET-${retSeq++}`;
  const restock = options.restock ?? true;
  seedReturns.push({
    id,
    companyId: order.companyId,
    orderId: order.id,
    staffId: 'USR-005',
    returnDate: iso(raisedAt).slice(0, 10),
    reason,
    refundAmount: amount,
    status,
    returnType,
    product: `${line.productName} ×${qty}`,
    qty,
    items: [{ productId, productName: line.productName ?? productId, qty, unitPrice: unit, amount }],
    requestedBy: order.customerName ?? 'Customer',
    refundMethod: status === 'Refunded' ? options.refundMethod ?? 'Cash' : undefined,
    restock: resolved && status !== 'Rejected' ? restock : undefined,
    rejectReason: options.rejectReason,
    resolvedAt: resolved ? iso(raisedAt + 2 * 60 * 60 * 1000) : undefined,
    resolvedBy: resolved ? 'returnhandler' : undefined,
    version: resolved ? 3 : status === 'Approved' ? 2 : 1,
    createdAt: iso(raisedAt),
    updatedAt: iso(raisedAt + (resolved ? 2 : 0) * 60 * 60 * 1000),
    updatedBy: 'returnhandler',
  });
  if ((status === 'Refunded' || status === 'Exchanged') && restock) {
    unitsOut.set(productId, (unitsOut.get(productId) ?? 0) - qty);
    pendingMoves.push({
      companyId: order.companyId,
      productId,
      type: 'return',
      quantity: qty,
      reason: `Returned on ${id}`,
      refType: 'return',
      refId: id,
      by: 'returnhandler',
      at: iso(raisedAt + 2 * 60 * 60 * 1000),
    });
  }
  if (status === 'Exchanged') {
    unitsOut.set(productId, (unitsOut.get(productId) ?? 0) + qty);
    pendingMoves.push({
      companyId: order.companyId,
      productId,
      type: 'exchange',
      quantity: -qty,
      reason: `Replacement handed over on ${id}`,
      refType: 'return',
      refId: id,
      by: 'returnhandler',
      at: iso(raisedAt + 2 * 60 * 60 * 1000),
    });
  }
  if (status === 'Refunded') {
    order.refundedAmount = round2((order.refundedAmount ?? 0) + amount);
    const soldQty = seedOrderItems
      .filter((i) => i.orderId === order.id)
      .reduce((sum, i) => sum + i.quantity, 0);
    const returnedQty = seedReturns
      .filter((r) => r.orderId === order.id && r.status === 'Refunded')
      .reduce((sum, r) => sum + r.qty, 0);
    order.status = returnedQty >= soldQty ? 'Returned' : 'Partially Returned';
    order.paymentStatus = returnedQty >= soldQty ? 'Refunded' : 'Partially Refunded';
  }
}

function generateHistory(): void {
  const rand = mulberry32(4410);
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const companies: Array<{ id: string; perDay: [number, number]; staff: string[]; coupons: string[] }> = [
    { id: 'BIZ-101', perDay: [2, 5], staff: ['USR-002', 'USR-002', 'USR-002', 'USR-001'], coupons: ['WELCOME10', 'FLAT50', 'DIWALI15'] },
    { id: 'BIZ-102', perDay: [0, 2], staff: ['USR-009', 'USR-009', 'USR-008'], coupons: ['WELCOME10', 'PUJA100'] },
  ];

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 0; daysAgo -= 1) {
    companies.forEach((company) => {
      const catalogue = CATALOGUE.filter((row) => row.companyId === company.id);
      const weighted: string[] = [];
      catalogue.forEach((row) => {
        for (let i = 0; i < row.weight; i += 1) weighted.push(row.id);
      });
      const customers = seedCustomers.filter((c) => c.companyId === company.id && c.mobileNo);
      const walkIn = WALK_IN_CUSTOMER_IDS[company.id];
      const count = company.perDay[0] + Math.floor(rand() * (company.perDay[1] - company.perDay[0] + 1));
      const times: number[] = [];
      for (let i = 0; i < count; i += 1) {
        times.push(istMoment(daysAgo, 9 + Math.floor(rand() * 12), Math.floor(rand() * 60)));
      }
      times.sort((a, b) => a - b);
      times.forEach((at) => {
        if (at >= SEED_NOW - 20 * 60 * 1000) return;
        const roll = rand();
        const mode: DraftOrder['mode'] =
          roll < 0.62 ? 'takeaway_now' : roll < 0.82 ? 'prepaid_delivery' : 'cod_delivery';
        const isDelivery = mode !== 'takeaway_now';
        const customerId = isDelivery || rand() < 0.55 ? pick(customers).id : walkIn;
        const lineCount = 1 + Math.floor(rand() * 4);
        const lines: DraftLine[] = [];
        for (let i = 0; i < lineCount; i += 1) {
          const productId = pick(weighted);
          if (lines.some((line) => line.productId === productId)) continue;
          lines.push({ productId, quantity: 1 + Math.floor(rand() * 3) });
        }
        const paymentMethod = mode === 'cod_delivery' ? 'COD' : pick(['Cash', 'UPI', 'UPI', 'Card']);
        let couponCode: string | undefined;
        if (rand() < 0.24) {
          const code = pick(company.coupons);
          const coupon = seedCoupons.find((c) => c.companyId === company.id && c.code === code)!;
          const day = new Date(at).toISOString().slice(0, 10);
          const subtotal = lines.reduce(
            (sum, line) => sum + productById.get(line.productId)!.price * line.quantity,
            0,
          );
          if (day >= coupon.validFrom && day <= coupon.validTo && subtotal >= coupon.minOrder) {
            couponCode = code;
          }
        }
        const ageHours = (SEED_NOW - at) / (60 * 60 * 1000);
        let deliveryState: DraftOrder['deliveryState'] = 'Delivered';
        if (isDelivery && ageHours < 3) deliveryState = pick(['Pending', 'Assigned', 'Dispatched']);
        else if (isDelivery && ageHours < 8) deliveryState = pick(['Dispatched', 'Out for Delivery', 'Delivered']);
        else if (isDelivery && rand() < 0.04) deliveryState = 'Returned to Store';
        const cancelled = !isDelivery && ageHours > 24 && rand() < 0.03 ? 'Customer changed mind at counter' : undefined;
        buildOrder({
          companyId: company.id,
          at,
          customerId,
          staffId: pick(company.staff),
          mode,
          paymentMethod,
          lines,
          couponCode,
          deliveryState: isDelivery ? deliveryState : undefined,
          cancelled,
          partnerIndex: Math.floor(rand() * DELIVERY_PARTNERS.length),
        });
      });
    });
  }

  // Returns on older, completed orders.
  const completed = seedOrders.filter(
    (o) =>
      o.status === 'Delivered' &&
      SEED_NOW - new Date(o.orderDate).getTime() > 3 * DAY &&
      o.paymentStatus === 'Paid',
  );
  const reasons = ['Damaged', 'Expired', 'Wrong Item', 'Stale', 'Not as described'];
  for (let i = 0; i < 10 && completed.length; i += 1) {
    const order = completed.splice(Math.floor(rand() * completed.length), 1)[0];
    const lines = seedOrderItems.filter((item) => item.orderId === order.id);
    const line = pick(lines);
    const qty = 1 + Math.floor(rand() * line.quantity);
    const status = (['Refunded', 'Refunded', 'Refunded', 'Rejected', 'Exchanged', 'Approved'] as const)[i % 6];
    addReturn(order, line.productId, Math.min(qty, line.quantity), pick(reasons), status, 1 + Math.floor(rand() * 2), {
      restock: status === 'Refunded' ? rand() < 0.6 : true,
      rejectReason: status === 'Rejected' ? 'Seal broken by customer; not eligible' : undefined,
      refundMethod: pick(['Cash', 'UPI', 'Original payment']),
      returnType: status === 'Exchanged' ? 'exchange' : 'refund',
    });
  }
}

function buildFixedRecords(): void {
  // ORD-4827: a paid counter sale from yesterday with two open returns on it.
  orderSeq = 4827;
  const ord4827 = buildOrder({
    id: 'ORD-4827',
    companyId: 'BIZ-101',
    at: istMoment(1, 18, 20),
    customerId: 'CUS-003',
    staffId: 'USR-002',
    mode: 'takeaway_now',
    paymentMethod: 'Cash',
    lines: [
      { productId: 'P005', quantity: 2 },
      { productId: 'P006', quantity: 1 },
      { productId: 'P001', quantity: 1 },
    ],
  });
  addReturn(ord4827, 'P006', 1, 'Damaged', 'Refunded', 0.2, { id: 'RET-220', restock: false, refundMethod: 'Cash' });
  addReturn(ord4827, 'P005', 1, 'Expired', 'Pending', 0.25, { id: 'RET-221' });

  // ORD-4828: COD order out for delivery right now.
  buildOrder({
    id: 'ORD-4828',
    companyId: 'BIZ-101',
    at: SEED_NOW - 95 * 60 * 1000,
    customerId: 'CUS-002',
    staffId: 'USR-002',
    mode: 'cod_delivery',
    paymentMethod: 'COD',
    lines: [
      { productId: 'P003', quantity: 1 },
      { productId: 'P005', quantity: 2 },
    ],
    deliveryState: 'Out for Delivery',
    partnerIndex: 1,
  });

  // ORD-4829: prepaid delivery waiting to be dispatched.
  buildOrder({
    id: 'ORD-4829',
    companyId: 'BIZ-101',
    at: SEED_NOW - 40 * 60 * 1000,
    customerId: 'CUS-001',
    staffId: 'USR-002',
    mode: 'prepaid_delivery',
    paymentMethod: 'UPI',
    lines: [
      { productId: 'P001', quantity: 1 },
      { productId: 'P002', quantity: 2 },
      { productId: 'P003', quantity: 1 },
    ],
    deliveryState: 'Assigned',
    partnerIndex: 0,
  });
  orderSeq = 4830;
}

generateHistory();
buildFixedRecords();

seedOrders.sort((a, b) => b.orderDate.localeCompare(a.orderDate));
seedDeliveries.sort((a, b) => b.createdAt!.localeCompare(a.createdAt!));
seedReturns.sort((a, b) => b.createdAt!.localeCompare(a.createdAt!));

/* ------------------------------------------------------------------ */
/* Inventory and the stock ledger                                      */
/* ------------------------------------------------------------------ */

export const seedInventory: InventoryItem[] = CATALOGUE.map((row, index) => ({
  id: `INV-${String(index + 1).padStart(3, '0')}`,
  companyId: row.companyId,
  productId: row.id,
  stockAvailable: row.stockNow,
  reorderLevel: row.reorderLevel,
  location: row.location,
  lastUpdated: iso(SEED_NOW - 30 * 60 * 1000),
  status: stockStatus(row.stockNow, row.reorderLevel),
  ...stamp(),
}));

export function stockStatus(stock: number, reorderLevel: number): string {
  if (stock <= 0) return 'Out of Stock';
  if (stock <= reorderLevel * 0.5) return 'Critical';
  if (stock <= reorderLevel) return 'Low Stock';
  return 'In Stock';
}

(function buildLedger(): void {
  const running = new Map<string, number>();
  let seq = 1;
  const push = (move: Omit<StockMovement, 'id' | 'balanceAfter'>): void => {
    const balance = (running.get(move.productId) ?? 0) + move.quantity;
    running.set(move.productId, balance);
    seedStockMovements.push({ ...move, id: `MOV-${String(seq++).padStart(5, '0')}`, balanceAfter: balance });
  };
  // Opening stock is what today's shelf count plus everything that left adds
  // up to, delivered in one restock at the start of the history and topped up
  // with a supplier delivery half way through when it would have run dry.
  CATALOGUE.forEach((row) => {
    const out = unitsOut.get(row.id) ?? 0;
    const needed = row.stockNow + out;
    const receivedMid = Math.max(0, Math.round(needed * 0.4));
    push({
      companyId: row.companyId,
      productId: row.id,
      type: 'opening',
      quantity: needed - receivedMid,
      reason: 'Opening stock count',
      by: 'inventorymanager',
      at: HISTORY_START,
    });
    pendingMoves.push({
      companyId: row.companyId,
      productId: row.id,
      type: 'receive',
      quantity: receivedMid,
      reason: `Delivery from supplier ${row.supplierId}`,
      refType: 'supplier',
      refId: row.supplierId,
      by: 'inventorymanager',
      at: iso(SEED_NOW - 22 * DAY),
    });
  });
  pendingMoves
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at))
    .forEach((move) => push(move));
})();

/* ------------------------------------------------------------------ */
/* Profit on the company record comes from the sales above.            */
/* ------------------------------------------------------------------ */

seedCompanies.forEach((company) => {
  const revenue = seedOrders
    .filter((o) => o.companyId === company.id && o.status !== 'Cancelled')
    .reduce((sum, o) => sum + o.total - (o.refundedAmount ?? 0), 0);
  company.profit = round2(revenue * 0.18);
});
