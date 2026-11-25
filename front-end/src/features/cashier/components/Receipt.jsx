import { formatRupees } from '../lib/posHelpers.js';

/**
 * Printed bill (80mm). Hidden on screen; the print stylesheet shows only this
 * block on paper. Every figure comes from the saved order on the server.
 */
export default function Receipt({ receipt }) {
  if (!receipt) return null;
  const r = receipt;
  return (
    <div className="receipt" id="printReceipt">
      <h2>{r.shopName}</h2>
      {r.address && <p className="receipt-meta">{r.address}</p>}
      {r.gstNo && <p className="receipt-meta">GSTIN: {r.gstNo}</p>}
      <p className="receipt-row">
        <span>Bill {r.billNo || r.orderId}</span>
        <span>{r.orderId}</span>
      </p>
      <p>{r.date}</p>
      <p>Cashier: {r.cashier}</p>
      <p>
        Customer: {r.customer}
        {r.phone ? ` (${r.phone})` : ''}
      </p>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {r.items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td>{item.name}</td>
              <td>{item.qty}</td>
              <td>{formatRupees(item.price)}</td>
              <td>{formatRupees(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="receipt-row">
        <span>Subtotal</span>
        <span>{formatRupees(r.subtotal)}</span>
      </p>
      {r.discount > 0 && (
        <p className="receipt-row">
          <span>Coupon {r.promoCode}</span>
          <span>- {formatRupees(r.discount)}</span>
        </p>
      )}
      {r.deliveryCharge > 0 && (
        <p className="receipt-row">
          <span>Delivery</span>
          <span>{formatRupees(r.deliveryCharge)}</span>
        </p>
      )}
      <p className="receipt-row receipt-total">
        <span>Total</span>
        <span>{formatRupees(r.total)}</span>
      </p>
      <p className="receipt-row">
        <span>GST included</span>
        <span>{formatRupees(r.tax)}</span>
      </p>
      <p className="receipt-row">
        <span>Paid by</span>
        <span>{r.payment}{r.paymentStatus === 'Pending' ? ' (due on delivery)' : ''}</span>
      </p>
      {r.tendered !== undefined && (
        <>
          <p className="receipt-row">
            <span>Cash received</span>
            <span>{formatRupees(r.tendered)}</span>
          </p>
          <p className="receipt-row">
            <span>Change</span>
            <span>{formatRupees(r.change)}</span>
          </p>
        </>
      )}
      <p className="receipt-foot">Prices include GST. Returns within 30 days with this bill. Thank you!</p>
    </div>
  );
}

/** Builds the receipt from a saved order (POST /orders or GET /orders/:id). */
export function receiptFromOrder(order, business, extras = {}) {
  const lines = Array.isArray(order.items) ? order.items : order.lines || [];
  return {
    shopName: (business && business.name) || localStorage.getItem('activeBusinessName') || 'BillBhai Store',
    address: business && business.address,
    gstNo: business && business.gstNo,
    billNo: order.bill ? order.bill.billNo : order.billNo,
    orderId: order.id,
    date: new Date(order.orderDate || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    cashier: order.staffName || order.staffId || '',
    customer: order.customerName || order.customer || 'Walk-in Customer',
    phone: order.customerPhone || '',
    items: lines.map((l) => ({
      name: l.productName || l.productId,
      qty: l.quantity,
      price: l.itemPrice,
      amount: l.itemPrice * l.quantity,
    })),
    subtotal: Number(order.subtotal) || 0,
    discount: Number(order.discountAmount ?? order.discount) || 0,
    promoCode: order.promoCode || '',
    deliveryCharge: Number(order.deliveryCharge) || 0,
    total: Number(order.total) || 0,
    tax: Number(order.taxAmount ?? order.tax) || 0,
    payment: order.paymentMethod || order.payment || '',
    paymentStatus: order.paymentStatus || '',
    tendered: extras.tendered,
    change: extras.change,
  };
}
