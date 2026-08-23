import { ZodIssue } from 'zod';

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly error: string;
  public readonly details?: string | ZodIssue[] | Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    error: string,
    details?: string | ZodIssue[] | Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', details?: string | ZodIssue[] | Record<string, unknown>) {
    super(400, message, 'Bad Request', details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', details?: string | Record<string, unknown>) {
    super(401, message, 'Unauthorized', details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden Resource', details?: string | Record<string, unknown>) {
    super(403, message, 'Forbidden', details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource Not Found', details?: string | Record<string, unknown>) {
    super(404, message, 'Not Found', details);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Resource Conflict', details?: string | Record<string, unknown>) {
    super(409, message, 'Conflict', details);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error', details?: string | Record<string, unknown>) {
    super(500, message, 'Internal Server Error', details);
  }
}
