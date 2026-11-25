import assert from 'node:assert/strict';
import {
  formatCurrency,
  currencySymbol,
  getActiveCurrency,
  setActiveCurrency,
  convertInrToActiveCurrency,
  USD_TO_INR_RATE,
} from '../currency.js';

// Setup mock localStorage in Node if not available
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

console.log('🧪 Starting currency conversion & preference test suite...\n');

// 1. Default to INR
setActiveCurrency('INR');
assert.equal(getActiveCurrency(), 'INR');
assert.equal(currencySymbol(), '₹');
assert.equal(formatCurrency(485), '₹485');
assert.equal(formatCurrency(982), '₹982');
assert.equal(formatCurrency(0), '₹0');
assert.equal(formatCurrency(-50), '-₹50');
assert.equal(convertInrToActiveCurrency(485), 485);
console.log('✓ Test 1: INR default formatting and numeric pass-through OK');

// 2. Switch to USD
setActiveCurrency('USD');
assert.equal(getActiveCurrency(), 'USD');
assert.equal(currencySymbol(), '$');

// 485 INR at 86.5 rate = 5.6069... => $5.61
assert.equal(formatCurrency(485), '$5.61');

// 865 INR at 86.5 rate = $10.00
assert.equal(formatCurrency(865), '$10.00');

// 0 INR = $0.00
assert.equal(formatCurrency(0), '$0.00');

// -86.5 INR = -$1.00
assert.equal(formatCurrency(-86.5), '-$1.00');

// Converted numeric value
assert.equal(convertInrToActiveCurrency(865), 10);
assert.equal(convertInrToActiveCurrency(485), 5.61);
console.log('✓ Test 2: USD conversion, rate calculation (86.5), and symbol change OK');

// 3. Switch back to INR
setActiveCurrency('INR');
assert.equal(getActiveCurrency(), 'INR');
assert.equal(currencySymbol(), '₹');
assert.equal(formatCurrency(485), '₹485');
console.log('✓ Test 3: Restoring INR preference restores full rupee values and symbol OK');

console.log('\n========================================================================');
console.log('🎉 ALL CURRENCY CONVERSION & FORMATTING TESTS PASSED FLAWLESSLY!');
console.log('========================================================================\n');
