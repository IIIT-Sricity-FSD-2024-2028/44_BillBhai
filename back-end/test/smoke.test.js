/* eslint-disable no-console */

const BASE_URL = process.env.BB_BASE_URL || 'http://127.0.0.1:3000/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  console.log(`Running smoke tests against ${BASE_URL}`);

  const login = await request('/auth/login', {
    method: 'POST',
    body: {
      username: 'admin',
      password: 'admin123',
    },
  });
  assert(login && login.id, 'Login response missing id');
  assert(login && login.role, 'Login response missing role');
  assert(login && login.companyId, 'Login response missing companyId');
  console.log('Login check passed.');

  const products = await request('/products', {
    headers: { 'x-role': 'cashier' },
  });
  assert(Array.isArray(products), 'Products response is not an array');
  assert(products.length > 0, 'Products array is empty');
  assert(products[0].id, 'First product missing id');
  console.log('Products check passed.');

  const createOrderPayload = {
    customerId: 'CUS-001',
    staffId: login.id,
    companyId: login.companyId,
    orderType: 'pickup',
    checkoutMode: 'takeaway_now',
    discountAmount: 0,
    paymentMethod: 'Cash',
    items: [
      {
        productId: products[0].id,
        quantity: 1,
        itemPrice: Number(products[0].price || 0),
      },
    ],
  };

  const createdOrder = await request('/orders', {
    method: 'POST',
    headers: { 'x-role': 'cashier' },
    body: createOrderPayload,
  });
  assert(createdOrder && createdOrder.id, 'Created order missing id');
  console.log(`Order create check passed (${createdOrder.id}).`);

  const orderList = await request('/orders', {
    headers: { 'x-role': 'cashier' },
  });
  assert(Array.isArray(orderList), 'Orders list response is not an array');
  assert(orderList.some((o) => o.id === createdOrder.id), 'Created order not found in GET /orders');
  console.log('Order list check passed.');

  const fetchedOrder = await request(`/orders/${encodeURIComponent(createdOrder.id)}`, {
    headers: { 'x-role': 'cashier' },
  });
  assert(fetchedOrder && fetchedOrder.id === createdOrder.id, 'GET /orders/:id did not return the created order');
  console.log('Order detail check passed.');

  console.log('Smoke tests passed.');
}

run().catch((error) => {
  console.error('Smoke tests failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
