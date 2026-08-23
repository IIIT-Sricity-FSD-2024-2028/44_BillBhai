import express, { ErrorRequestHandler, Response } from 'express';
import request from 'supertest';
import { HttpError } from '../../../src/errors/http-error';
import { productsRouter } from './products.routes';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/products', productsRouter);
  app.use(((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({
        statusCode: err.statusCode,
        message: err.message,
        error: err.error,
        ...(err.details ? { details: err.details } : {}),
      });
      return;
    }

    res.status(500).json({
      statusCode: 500,
      message: err instanceof Error ? err.message : 'Internal Server Error',
      error: 'Internal Server Error',
    });
  }) as ErrorRequestHandler);
  return app;
}

describe('ProductsModule - ProductsService', () => {
  let service: ProductsService;

  beforeEach(() => {
    service = new ProductsService();
  });

  it('returns all seeded products', () => {
    const products = service.findAll();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toHaveProperty('id');
  });

  it('filters products by category', () => {
    const products = service.findAll('Dairy');
    expect(products.every((product) => product.category === 'Dairy')).toBe(
      true,
    );
  });

  it('returns unique categories', () => {
    expect(service.getCategories()).toEqual(
      expect.arrayContaining(['Groceries', 'Dairy', 'Snacks', 'Beverages', 'Home Care']),
    );
  });

  it('creates a product and assigns the next ID', () => {
    const created = service.create({
      supplierId: 'SUP-999',
      name: 'Test Product',
      category: 'Test',
      barcode: 'BAR999',
      price: 99,
    });

    expect(created.id).toBe('P021');
    expect(service.findOne(created.id).name).toBe('Test Product');
  });

  it('throws when creating a duplicate barcode', () => {
    expect(() =>
      service.create({
        supplierId: 'SUP-998',
        name: 'Duplicate',
        category: 'Test',
        barcode: 'BAR001',
        price: 10,
      }),
    ).toThrow('Product with this barcode already exists');
  });

  it('finds products by barcode and id', () => {
    expect(service.findByBarcode('BAR001').id).toBe('P001');
    expect(service.findOne('P001').barcode).toBe('BAR001');
  });

  it('updates and removes products', () => {
    const updated = service.update('P001', { price: 999 });
    expect(updated.price).toBe(999);

    const removed = service.remove('P001');
    expect(removed.message).toBe('Product P001 deleted');
    expect(removed.product.id).toBe('P001');
  });

  it('throws not found errors for missing products', () => {
    expect(() => service.findOne('missing')).toThrow('Product missing not found');
    expect(() => service.findByBarcode('missing')).toThrow(
      'Product with barcode missing not found',
    );
  });
});

describe('ProductsModule - ProductsController', () => {
  it('returns 201 when creating a product', () => {
    const service = {
      create: jest.fn().mockReturnValue({ id: 'P999' }),
    } as unknown as ProductsService;
    const controller = new ProductsController(service);
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    controller.create(
      {
        body: {
          supplierId: 'SUP-999',
          name: 'Controller Product',
          category: 'Test',
          price: 12,
        },
      } as any,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'P999' });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards service errors to next()', () => {
    const service = {
      findOne: jest.fn(() => {
        throw new Error('boom');
      }),
    } as unknown as ProductsService;
    const controller = new ProductsController(service);
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    controller.findOne({ params: { id: 'P001' } } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('ProductsModule - ProductsRouter', () => {
  const app = createTestApp();

  it('serves the products collection with role protection', async () => {
    const response = await request(app)
      .get('/products')
      .set('x-role', 'cashier')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('keeps /categories ahead of /:id', async () => {
    const response = await request(app)
      .get('/products/categories')
      .set('x-role', 'customer')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toEqual(
      expect.arrayContaining(['Groceries', 'Dairy', 'Snacks', 'Beverages', 'Home Care']),
    );
  });

  it('looks up a product by barcode', async () => {
    const response = await request(app)
      .get('/products/barcode/BAR001')
      .set('x-role', 'inventorymanager')
      .expect(200);

    expect(response.body.id).toBe('P001');
  });

  it('returns 403 when the role header is missing', async () => {
    const response = await request(app).get('/products').expect(403);
    expect(response.body.message).toContain('Missing "x-role" header');
  });
});
