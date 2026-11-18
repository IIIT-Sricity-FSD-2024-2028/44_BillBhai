/**
 * Money helpers shared by the order flow, returns and the seed generator, so
 * every place that works out a bill gets the same answer.
 *
 * Prices are GST inclusive (the Indian retail norm): the tax is the part of
 * the price that belongs to the government, not something added on top.
 */

export function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export interface PricedLine {
  quantity: number;
  itemPrice: number;
  gstRate?: number;
}

export function linesSubtotal(lines: PricedLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.itemPrice * line.quantity, 0));
}

/**
 * GST contained in the lines after the discount is shared out across them in
 * proportion to their value.
 */
export function inclusiveTax(lines: PricedLine[], discount: number): number {
  const subtotal = linesSubtotal(lines);
  if (subtotal <= 0) return 0;
  const keep = Math.max(0, subtotal - Math.max(0, discount)) / subtotal;
  const tax = lines.reduce((sum, line) => {
    const rate = Math.max(0, Number(line.gstRate) || 0);
    const net = line.itemPrice * line.quantity * keep;
    return sum + (net * rate) / (100 + rate);
  }, 0);
  return round2(tax);
}

/** Price actually paid per unit once the order discount is shared out. */
export function netUnitPrice(itemPrice: number, subtotal: number, discount: number): number {
  if (subtotal <= 0) return 0;
  const keep = Math.max(0, subtotal - Math.max(0, discount)) / subtotal;
  return round2(itemPrice * keep);
}

/** A 10-digit Indian mobile number, digits only, or '' when it is not one. */
export function normalisePhone(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  const tail = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(tail) ? tail : '';
}
