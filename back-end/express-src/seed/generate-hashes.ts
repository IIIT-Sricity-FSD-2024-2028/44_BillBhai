'use strict';
/**
 * generate-hashes.js
 * Run once to generate bcrypt hashes for all seed user passwords.
 * Output: copy the hashes into seed-data.js
 *
 * Usage: node express-src/seed/generate-hashes.js
 */
const bcrypt = require('bcrypt');

const passwords = [
  { username: 'admin',          password: 'admin123' },
  { username: 'cashier',        password: 'cashier123' },
  { username: 'inventorymanager', password: 'inventory123' },
  { username: 'deliveryops',    password: 'delivery123' },
  { username: 'returnhandler',  password: 'return123' },
  { username: 'chirag',         password: 'chirag1234' },
  { username: 'customer',       password: 'customer123' },
];

(async () => {
  console.log('Generating bcrypt hashes (rounds=12)...\n');
  for (const { username, password } of passwords) {
    const hash = await bcrypt.hash(password, 12);
    console.log(`${username}: '${hash}',`);
  }
  console.log('\nCopy the above hashes into express-src/seed/seed-data.js');
})();
