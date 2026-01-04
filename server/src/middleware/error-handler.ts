import type { NextFunction, Request, Response } from 'express';

interface ApiError extends Error {
  status?: number;
  details?: unknown;
}

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction): void {
  const status = err.status ?? 500;
  const response = {
    error: {
      message: err.message || 'Internal server error',
      details: err.details ?? undefined
    }
  };
  if (process.env.NODE_ENV !== 'production') {
    Object.assign(response.error, { stack: err.stack });
  }
  res.status(status).json(response);
}
