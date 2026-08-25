import { z } from 'zod';

/**
 * Uploads Module Schemas
 *
 * `UploadedFileMeta` is a deliberately framework-neutral description of a
 * stored file. The controller maps multer's own file object into this shape so
 * the service never has to know that multer or Express exist.
 */

export const uploadIdParamsSchema = z.object({
  id: z.string().regex(/^UPL-\d+$/i, 'Upload id must look like UPL-001'),
});

export const attachImageParamsSchema = z.object({
  id: z.string().min(1, 'Product id is required'),
});

export const listUploadsQuerySchema = z.object({
  kind: z.enum(['image', 'import']).optional(),
});

export type ListUploadsQuery = z.infer<typeof listUploadsQuerySchema>;

export interface UploadedFileMeta {
  originalName: string;
  storedName: string;
  absolutePath: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'import';
}

export interface UploadRecord {
  id: string;
  originalName: string;
  storedName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'import';
  uploadedAt: string;
  uploadedBy: string;
}

export interface CsvImportSummary {
  file: UploadRecord;
  totalRows: number;
  imported: number;
  failed: number;
  createdProductIds: string[];
  errors: Array<{ row: number; reason: string }>;
}

export interface DeleteUploadResult {
  message: string;
  upload: UploadRecord;
}
