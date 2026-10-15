import { formatRupees } from '../../lib/cashier/posHelpers.js';

// Hidden on screen; the print stylesheet shows only this block on paper.
export default function Receipt({ receipt }) {
  if (!receipt) return null;
  const { shopName, orderId, date, customer, items, totals, payment } = receipt;

  return (
    <div className="receipt" id="printReceipt">
      <h2>{shopName}</h2>
      <p>Bill: {orderId}</p>
      <p>{date}</p>
      <p>Customer: {customer}</p>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td>{item.name}</td>
              <td>{item.qty}</td>
              <td>{formatRupees(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="receipt-row">
        <span>Subtotal</span>
        <span>{formatRupees(totals.subtotal)}</span>
      </p>
      {totals.discount > 0 && (
        <p className="receipt-row">
          <span>Discount</span>
          <span>- {formatRupees(totals.discount)}</span>
        </p>
      )}
      {totals.deliveryCharge > 0 && (
        <p className="receipt-row">
          <span>Delivery</span>
          <span>{formatRupees(totals.deliveryCharge)}</span>
        </p>
      )}
      <p className="receipt-row receipt-total">
        <span>Total</span>
        <span>{formatRupees(totals.payableTotal)}</span>
      </p>
      <p>Paid by: {payment}</p>
      <p className="receipt-foot">Prices inclusive of GST. Thank you, visit again!</p>
    </div>
  );
}
