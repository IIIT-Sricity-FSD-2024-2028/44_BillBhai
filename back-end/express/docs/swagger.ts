import fs from 'fs';
import path from 'path';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from '../config/index';
import { swaggerCspOverride } from '../middleware/security.middleware';
import { logger } from '../utils/logger';

/**
 * Swagger UI
 *
 * The base document is `docs/openapi.json`, exported from the original NestJS
 * application, so the documented contract is provably the same one the legacy
 * API published. The Express runtime then layers on the endpoints that NestJS
 * did not have (file uploads, the JWT profile probe, and the health check).
 *
 * Served at /api/docs. Helmet's strict CSP is relaxed only on that path,
 * because Swagger UI ships inline scripts and styles.
 */

interface OpenApiDocument {
  openapi: string;
  info: Record<string, unknown>;
  paths: Record<string, unknown>;
  components?: Record<string, unknown>;
  tags?: unknown[];
  [key: string]: unknown;
}

function roleParameter(description: string) {
  return {
    name: 'x-role',
    in: 'header',
    required: true,
    schema: { type: 'string' },
    description,
  };
}

/** Endpoints that exist in the Express runtime but not in the NestJS export. */
const ADDITIONAL_PATHS: Record<string, unknown> = {
  '/health': {
    get: {
      tags: ['System'],
      summary: 'Liveness probe',
      responses: { '200': { description: 'Service is up' } },
    },
  },
  '/api/auth/profile': {
    get: {
      tags: ['Auth'],
      summary: 'Return the caller identity resolved from the credential',
      responses: {
        '200': { description: 'Current actor' },
        '401': { description: 'No or invalid credential' },
      },
    },
  },
  '/api/orders/promotions/validate': {
    post: {
      tags: ['Orders'],
      summary: 'Validate a promo code against a subtotal',
      parameters: [roleParameter('superuser, admin, cashier or customer')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code', 'subtotal'],
              properties: {
                code: { type: 'string', example: 'WELCOME10' },
                subtotal: { type: 'number', example: 1000 },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Discount breakdown' },
        '400': { description: 'Invalid promo code' },
      },
    },
  },
  '/api/uploads/image': {
    post: {
      tags: ['Uploads'],
      summary: 'Upload a product image (multer, max 5MB, PNG/JPEG/WebP)',
      parameters: [roleParameter('superuser, admin or inventorymanager')],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { image: { type: 'string', format: 'binary' } },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Stored file record' },
        '400': { description: 'Missing file, wrong MIME type, or too large' },
      },
    },
  },
  '/api/uploads/products/csv': {
    post: {
      tags: ['Uploads'],
      summary: 'Bulk import products from a CSV file',
      parameters: [roleParameter('superuser, admin or inventorymanager')],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Import summary with per-row errors' },
        '400': { description: 'Malformed CSV or missing required columns' },
      },
    },
  },
  '/api/uploads/products/{id}/image': {
    post: {
      tags: ['Uploads'],
      summary: 'Upload an image and attach it to a product',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        roleParameter('superuser, admin or inventorymanager'),
      ],
      responses: {
        '201': { description: 'Updated product and upload record' },
        '404': { description: 'Product not found' },
      },
    },
  },
  '/api/uploads': {
    get: {
      tags: ['Uploads'],
      summary: 'List uploaded files',
      parameters: [roleParameter('superuser or admin')],
      responses: { '200': { description: 'Upload register' } },
    },
  },
  '/api/uploads/{id}': {
    get: {
      tags: ['Uploads'],
      summary: 'Fetch one upload record',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        roleParameter('superuser or admin'),
      ],
      responses: { '200': { description: 'Upload record' } },
    },
    delete: {
      tags: ['Uploads'],
      summary: 'Delete an upload and remove the file from disk',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        roleParameter('superuser or admin'),
      ],
      responses: { '200': { description: 'Deleted' } },
    },
  },
};

export function buildOpenApiDocument(): OpenApiDocument {
  const raw = fs.readFileSync(path.join(__dirname, 'openapi.json'), 'utf-8');
  const document = JSON.parse(raw) as OpenApiDocument;

  document.info = {
    ...document.info,
    title: 'BillBhai API',
    version: '1.0.0',
    description:
      'BillBhai Retail Order Processing and Billing System, Express.js runtime. ' +
      'Authenticate with POST /api/auth/login and send the returned token as ' +
      '"Authorization: Bearer <token>", or send an "x-role" header directly.',
  };

  document.paths = { ...document.paths, ...ADDITIONAL_PATHS };

  document.components = {
    ...(document.components || {}),
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      roleHeader: { type: 'apiKey', in: 'header', name: 'x-role' },
    },
  };

  document.security = [{ bearerAuth: [] }, { roleHeader: [] }];
  document.servers = [{ url: `http://localhost:${config.port}` }];

  return document;
}

export function mountSwagger(app: Express): void {
  if (!config.swaggerEnabled) return;

  const docsPath = `${config.apiPrefix}/docs`;

  app.use(docsPath, swaggerCspOverride);
  app.use(
    docsPath,
    swaggerUi.serve,
    swaggerUi.setup(buildOpenApiDocument(), {
      customSiteTitle: 'BillBhai API Docs',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
    }),
  );

  logger.info(`Swagger UI mounted at ${docsPath}`);
}
