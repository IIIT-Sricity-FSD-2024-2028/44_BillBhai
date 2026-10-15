import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import Receipt from '../cashier/Receipt.jsx';
import printReceipt from '../../lib/printReceipt.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { apiRequest } from '../../lib/dashboard/api.js';

export default function OrderBillModal({ orderId, onClose }) {
  const { scopedBusinessName } = useDashboard();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return undefined;
    let cancelled = false;
    setReceipt(null);
    setError('');
    Promise.all([
      apiRequest(`/orders/${encodeURIComponent(orderId)}`),
      apiRequest('/products').catch(() => []),
    ])
      .then(([order, products]) => {
        if (cancelled) return;
        const nameById = new Map((products || []).map((p) => [p.id, p.name]));
        const items = (order.items || []).map((item) => ({
          name: nameById.get(item.productId) || item.productId,
          qty: item.quantity,
          amount: item.itemPrice * item.quantity,
        }));
        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
        setReceipt({
          shopName:
            scopedBusinessName || localStorage.getItem('activeBusinessName') || 'BillBhai Store',
          orderId: order.id,
          date: new Date(order.orderDate).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          customer: order.customerName || order.customerId,
          items,
          totals: {
            subtotal,
            discount: Number(order.discountAmount) || 0,
            deliveryCharge: 0,
            payableTotal: Number(order.total) || 0,
          },
          payment: order.paymentMethod,
        });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this bill. Check the connection and try again.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!orderId) return null;
  const noItems = receipt && receipt.items.length === 0;

  return (
    <Modal title={`Bill ${orderId}`} onClose={onClose} maxWidth="420px">
      <div className="modal-body">
        {error && <p className="text-muted">{error}</p>}
        {!receipt && !error && <p className="text-muted">Loading bill…</p>}
        {noItems && (
          <p className="text-muted">This order was entered by hand, so it has no item list.</p>
        )}
        {receipt && !noItems && (
          <div className="receipt-preview">
            <Receipt receipt={receipt} />
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        {receipt && !noItems && (
          <button type="button" className="btn btn-primary" onClick={printReceipt}>
            Print Bill
          </button>
        )}
      </div>
    </Modal>
  );
}
