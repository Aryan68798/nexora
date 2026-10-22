import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../lib/logger.js';

export function errorHandler(err, req, res, _next) {
  // 1. AppError (our known operational domain errors)
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.id, method: req.method, url: req.originalUrl }, err.message);
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // 2. Zod validation errors
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      },
    });
    return;
  }

  // 3. Prisma Known Request Errors
  if (err && typeof err === 'object' && err.code) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A record with this value already exists',
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Record not found',
        },
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Referenced record does not exist',
        },
      });
      return;
    }
  }

  // 4. Default: Unhandled internal error
  // Never leak internal error message, stack traces or SQL to the client
  logger.error(
    {
      err: {
        message: err?.message,
        stack: err?.stack,
        code: err?.code,
      },
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
    },
    'Unhandled server error'
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
