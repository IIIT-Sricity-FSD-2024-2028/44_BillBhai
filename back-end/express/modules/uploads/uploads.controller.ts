import { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../../errors/http-error';
import { logger } from '../../utils/logger';
import { uploadsService, UploadsService } from './uploads.service';
import { UploadedFileMeta } from './uploads.schema';

/**
 * Uploads Module Controller
 *
 * Converts multer's file object into the framework-neutral UploadedFileMeta
 * the service expects, so the service stays free of Express and multer types.
 */
export class UploadsController {
  constructor(private readonly service: UploadsService = uploadsService) {}

  private toMeta(req: Request, kind: 'image' | 'import'): UploadedFileMeta {
    const file = req.file;
    if (!file) {
      throw new BadRequestError(
        kind === 'image'
          ? 'No file received. Send a multipart/form-data request with an "image" field.'
          : 'No file received. Send a multipart/form-data request with a "file" field.',
      );
    }

    return {
      originalName: file.originalname,
      storedName: file.filename,
      absolutePath: file.path,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      kind,
    };
  }

  private actor(req: Request): string {
    return req.auth?.username || req.auth?.role || 'unknown';
  }

  public uploadImage = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const meta = this.toMeta(req, 'image');
      const record = this.service.register(meta, this.actor(req));

      logger.info('Image uploaded', {
        requestId: req.requestId,
        uploadId: record.id,
        sizeBytes: record.sizeBytes,
      });

      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  };

  public attachToProduct = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      const meta = this.toMeta(req, 'image');
      const record = this.service.register(meta, this.actor(req));
      const product = this.service.attachImageToProduct(
        String(req.params.id),
        record,
      );

      logger.info('Product image attached', {
        requestId: req.requestId,
        productId: product.id,
        uploadId: record.id,
      });

      res.status(201).json({ product, upload: record });
    } catch (error) {
      next(error);
    }
  };

  public importCsv = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const meta = this.toMeta(req, 'import');
      const summary = this.service.importProductsFromCsv(meta, this.actor(req));

      logger.info('Product CSV imported', {
        requestId: req.requestId,
        imported: summary.imported,
        failed: summary.failed,
      });

      res.status(201).json(summary);
    } catch (error) {
      next(error);
    }
  };

  public findAll = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const kind =
        req.query.kind === 'image' || req.query.kind === 'import'
          ? req.query.kind
          : undefined;
      res.status(200).json(this.service.findAll(kind));
    } catch (error) {
      next(error);
    }
  };

  public findOne = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json(this.service.findOne(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  };

  public remove = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json(this.service.remove(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  };
}

export const uploadsController = new UploadsController();
