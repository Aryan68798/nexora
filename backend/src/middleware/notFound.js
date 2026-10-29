import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(AppError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
}
