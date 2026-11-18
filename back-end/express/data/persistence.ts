import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { activityService } from '../modules/activity/activity.service';
import { companiesService } from '../modules/companies/companies.service';
import { couponsService } from '../modules/coupons/coupons.service';
import { customersService } from '../modules/customers/customers.service';
import { deliveriesService } from '../modules/deliveries/deliveries.service';
import { inventoryService } from '../modules/inventory/inventory.service';
import { ordersService } from '../modules/orders/orders.service';
import { productsService } from '../modules/products/products.service';
import { returnsService } from '../modules/returns/returns.service';
import { suppliersService } from '../modules/suppliers/suppliers.service';
import { usersService } from '../modules/users/users.service';

/**
 * File persistence for the data store.
 *
 * Every service keeps its records in memory and can dump() and load() them.
 * After any request that changes data, the whole store is written to one JSON
 * file (debounced, written to a temp file and renamed so a crash mid-write
 * never leaves a half file). On start-up the file is loaded back, so a
 * restart keeps every sale, product and user.
 *
 * Delete the file (or call POST /api/admin/reset-demo as the super user) to
 * go back to the seed data.
 */

interface Persistent {
  dump(): unknown;
  load(state: never): void;
}

const STORES: Record<string, Persistent> = {
  activity: activityService,
  companies: companiesService,
  users: usersService,
  customers: customersService,
  suppliers: suppliersService,
  products: productsService,
  inventory: inventoryService,
  coupons: couponsService,
  orders: ordersService,
  deliveries: deliveriesService,
  returns: returnsService,
};

const FORMAT_VERSION = 2;

export const DATA_FILE = path.resolve(
  process.env.DATA_FILE || path.join(__dirname, '..', '..', 'data-store', 'billbhai-data.json'),
);

/** Seed state captured before any load, for "reset demo data". */
const seedSnapshot = JSON.stringify(
  Object.fromEntries(Object.entries(STORES).map(([name, store]) => [name, store.dump()])),
);

let enabled = false;
let timer: NodeJS.Timeout | null = null;

function applySnapshot(snapshot: Record<string, unknown>): void {
  Object.entries(STORES).forEach(([name, store]) => {
    if (snapshot[name]) store.load(snapshot[name] as never);
  });
}

export function initPersistence(): void {
  enabled = process.env.PERSIST !== 'false';
  if (!enabled) return;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (raw && raw.formatVersion === FORMAT_VERSION && raw.stores) {
        applySnapshot(raw.stores);
        logger.info(`Loaded saved data from ${DATA_FILE} (saved ${raw.savedAt})`);
      } else {
        logger.warn(`Ignoring ${DATA_FILE}: it was written by an older version. Starting from seed data.`);
      }
    } else {
      logger.info(`No saved data yet; starting from seed data. Changes will be saved to ${DATA_FILE}`);
    }
  } catch (error) {
    logger.error(`Could not read ${DATA_FILE}; starting from seed data`, { error: String(error) });
  }
}

export function saveNow(): void {
  if (!enabled) return;
  const payload = {
    formatVersion: FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    stores: Object.fromEntries(Object.entries(STORES).map(([name, store]) => [name, store.dump()])),
  };
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload));
    fs.renameSync(tmp, DATA_FILE);
  } catch (error) {
    logger.error('Could not save data', { error: String(error) });
  }
}

export function scheduleSave(): void {
  if (!enabled) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    saveNow();
  }, 300);
  timer.unref?.();
}

/** Puts every store back to the seed data and saves that. */
export function resetToSeed(): void {
  applySnapshot(JSON.parse(seedSnapshot));
  saveNow();
}

/** Saves after every successful request that could have changed data. */
export function persistAfterWrites(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.on('finish', () => {
      if (res.statusCode < 400) scheduleSave();
    });
  }
  next();
}
