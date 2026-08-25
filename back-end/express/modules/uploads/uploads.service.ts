import fs from 'fs';
import path from 'path';
import { config } from '../../config/index';
import { BadRequestError, NotFoundError } from '../../errors/http-error';
import { productsService, ProductsService } from '../products/products.service';
import {
  CsvImportSummary,
  DeleteUploadResult,
  UploadRecord,
  UploadedFileMeta,
} from './uploads.schema';

/**
 * Uploads Module Service
 *
 * Keeps a register of every file accepted by the multer middleware and turns a
 * bulk product CSV into real catalogue entries.
 *
 * Framework agnostic: it receives a plain UploadedFileMeta object, never a
 * multer or Express type.
 */

const REQUIRED_COLUMNS = ['name', 'category', 'price', 'supplierId'] as const;

export class UploadsService {
  private uploads: UploadRecord[] = [];
  private counter = 1;

  constructor(private readonly products: ProductsService = productsService) {}

  private toUrl(meta: UploadedFileMeta): string {
    const folder = meta.kind === 'image' ? 'images' : 'imports';
    return `/uploads/${folder}/${meta.storedName}`;
  }

  public register(meta: UploadedFileMeta, uploadedBy: string): UploadRecord {
    const record: UploadRecord = {
      id: `UPL-${String(this.counter++).padStart(3, '0')}`,
      originalName: meta.originalName,
      storedName: meta.storedName,
      url: this.toUrl(meta),
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
      kind: meta.kind,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
    };

    this.uploads.push(record);
    return { ...record };
  }

  public findAll(kind?: 'image' | 'import'): UploadRecord[] {
    return this.uploads
      .filter((upload) => (kind ? upload.kind === kind : true))
      .map((upload) => ({ ...upload }));
  }

  public findOne(id: string): UploadRecord {
    const upload = this.uploads.find((entry) => entry.id === id);
    if (!upload) {
      throw new NotFoundError(`Upload ${id} not found`);
    }
    return { ...upload };
  }

  /** Attaches an already-stored image to a product and returns the product. */
  public attachImageToProduct(productId: string, record: UploadRecord) {
    this.products.findOne(productId);
    return this.products.update(productId, { imageUrl: record.url });
  }

  public remove(id: string): DeleteUploadResult {
    const index = this.uploads.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new NotFoundError(`Upload ${id} not found`);
    }

    const [removed] = this.uploads.splice(index, 1);

    // Remove the file from disk as well, so the register and the upload
    // directory cannot drift apart.
    const storedPath = this.resolveStoredPath(removed);
    if (fs.existsSync(storedPath)) {
      fs.unlinkSync(storedPath);
    }

    return { message: `Upload ${id} deleted`, upload: removed };
  }

  /**
   * Parses a comma separated product file and creates a catalogue entry per
   * row. A bad row is reported and skipped rather than aborting the import.
   *
   * Expected header: name,category,price,supplierId[,barcode,size,description]
   */
  public importProductsFromCsv(
    meta: UploadedFileMeta,
    uploadedBy: string,
  ): CsvImportSummary {
    const raw = fs.readFileSync(meta.absolutePath, 'utf-8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestError(
        'CSV must contain a header row and at least one data row',
      );
    }

    const header = lines[0].split(',').map((column) => column.trim());
    const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
    if (missing.length > 0) {
      throw new BadRequestError(
        `CSV is missing required column(s): ${missing.join(', ')}. Expected header: ${REQUIRED_COLUMNS.join(',')}`,
      );
    }

    const record = this.register(meta, uploadedBy);
    const errors: Array<{ row: number; reason: string }> = [];
    const createdProductIds: string[] = [];

    lines.slice(1).forEach((line, offset) => {
      const rowNumber = offset + 2;
      const cells = line.split(',').map((cell) => cell.trim());
      const row: Record<string, string> = {};
      header.forEach((column, index) => {
        row[column] = cells[index] ?? '';
      });

      const price = Number(row.price);
      if (!row.name || !row.category || !row.supplierId) {
        errors.push({ row: rowNumber, reason: 'name, category and supplierId are required' });
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        errors.push({ row: rowNumber, reason: `price "${row.price}" is not a non-negative number` });
        return;
      }

      try {
        const created = this.products.create({
          name: row.name,
          category: row.category,
          price,
          supplierId: row.supplierId,
          barcode: row.barcode || undefined,
          size: row.size || undefined,
          description: row.description || undefined,
        });
        createdProductIds.push(created.id);
      } catch (error) {
        errors.push({
          row: rowNumber,
          reason: error instanceof Error ? error.message : 'Unknown import failure',
        });
      }
    });

    return {
      file: record,
      totalRows: lines.length - 1,
      imported: createdProductIds.length,
      failed: errors.length,
      createdProductIds,
      errors,
    };
  }

  /** Resolves where a registered upload actually lives on disk. */
  public resolveStoredPath(record: UploadRecord): string {
    const root = path.isAbsolute(config.uploads.dir)
      ? config.uploads.dir
      : path.resolve(process.cwd(), config.uploads.dir);
    const folder = record.kind === 'image' ? 'images' : 'imports';
    return path.join(root, folder, record.storedName);
  }
}

export const uploadsService = new UploadsService();
