import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../middleware/async-handler.middleware';
import { NotFoundError, ConflictError } from '../errors/http-error';


// 1. Define Zod Schemas
const CreateProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  price: z.number().positive('Price must be greater than 0'),
  sku: z.string().toUpperCase(),
  stock: z.number().int().nonnegative().optional().default(0),
});

const ProductParamsSchema = z.object({
  id: z.string().regex(/^PRD-\d+$/, 'Invalid Product ID format'),
});

const router = Router();

// 2. Attach Validation & Async Handler to Express Routes
router.post(
  '/products',
  validate({ body: CreateProductSchema }),
  asyncHandler(async (req, res) => {
    const { name, sku } = req.body;

    if (sku === 'PRD-EXISTS') {
      throw new ConflictError(`Product with SKU ${sku} already exists`);
    }

    res.status(201).json({ id: 'PRD-001', name });
  })
);

router.get(
  '/products/:id',
  validate({ params: ProductParamsSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (id !== 'PRD-001') {
      throw new NotFoundError(`Product ${id} not found`);
    }

    res.status(200).json({ id, name: 'Sample Product' });
  })
);

export default router;
