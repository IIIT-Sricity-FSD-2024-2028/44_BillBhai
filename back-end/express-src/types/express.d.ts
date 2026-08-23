import 'express';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userRole?: string;
      receivedAt?: Date;
    }
  }

  interface Error {
    status?: number;
    statusCode?: number;
  }
}

export {};
