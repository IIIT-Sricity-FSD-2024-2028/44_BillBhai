import request from 'supertest';
import { app } from '../../app';

describe('Payments Module (Razorpay Revenue & POS Integration)', () => {
  const cashierAuth = { 'x-role': 'cashier' };
  const adminAuth = { 'x-role': 'admin' };

  describe('POST /api/payments/razorpay/create-order', () => {
    it('creates a POS Razorpay order successfully', async () => {
      const response = await request(app)
        .post('/api/payments/razorpay/create-order')
        .set(cashierAuth)
        .send({
          amount: 500,
          currency: 'INR',
          billNo: 'BILL-001',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe(50000); // 500 INR in paise
      expect(response.body.currency).toBe('INR');
      expect(response.body).toHaveProperty('keyId');
    });

    it('rejects order creation with negative or zero amount', async () => {
      const response = await request(app)
        .post('/api/payments/razorpay/create-order')
        .set(cashierAuth)
        .send({
          amount: 0,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/payments/razorpay/verify', () => {
    it('verifies POS razorpay payment in mock mode successfully', async () => {
      const createRes = await request(app)
        .post('/api/payments/razorpay/create-order')
        .set(cashierAuth)
        .send({ amount: 100, billNo: 'BILL-001' });

      const razorpayOrderId = createRes.body.id;

      const verifyRes = await request(app)
        .post('/api/payments/razorpay/verify')
        .set(cashierAuth)
        .send({
          razorpayOrderId,
          razorpayPaymentId: 'pay_Mock123456',
          razorpaySignature: 'mock_signature',
          billNo: 'BILL-001',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.paymentId).toBe('pay_Mock123456');
    });
  });

  describe('POST /api/payments/razorpay/subscription/create-order', () => {
    it('creates a Subscription Razorpay order for Growth / Pro tier', async () => {
      const response = await request(app)
        .post('/api/payments/razorpay/subscription/create-order')
        .set(adminAuth)
        .send({
          companyId: 'BIZ-101',
          plan: 'pro',
          billingCycle: 'monthly',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe(199900); // ₹1,999 in paise
      expect(response.body.plan).toBe('pro');
    });

    it('creates a Subscription Razorpay order for Enterprise yearly plan', async () => {
      const response = await request(app)
        .post('/api/payments/razorpay/subscription/create-order')
        .set(adminAuth)
        .send({
          companyId: 'BIZ-101',
          plan: 'enterprise',
          billingCycle: 'yearly',
        });

      expect(response.status).toBe(201);
      expect(response.body.amount).toBe(4999000); // ₹49,990 in paise
    });
  });

  describe('POST /api/payments/razorpay/subscription/verify', () => {
    it('verifies subscription payment and activates company plan', async () => {
      const createRes = await request(app)
        .post('/api/payments/razorpay/subscription/create-order')
        .set(adminAuth)
        .send({
          companyId: 'BIZ-101',
          plan: 'pro',
          billingCycle: 'monthly',
        });

      const verifyRes = await request(app)
        .post('/api/payments/razorpay/subscription/verify')
        .set(adminAuth)
        .send({
          companyId: 'BIZ-101',
          plan: 'pro',
          billingCycle: 'monthly',
          razorpayOrderId: createRes.body.id,
          razorpayPaymentId: 'pay_SubSuccess987',
          razorpaySignature: 'mock_signature',
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.status).toBe('Active');
    });
  });

  describe('POST /api/payments/razorpay/webhook', () => {
    it('handles razorpay webhook payload', async () => {
      const response = await request(app)
        .post('/api/payments/razorpay/webhook')
        .send({
          event: 'payment.captured',
          payload: { payment: { entity: { id: 'pay_123' } } },
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('processed');
    });
  });
});
