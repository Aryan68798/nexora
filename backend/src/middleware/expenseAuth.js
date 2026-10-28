import { AppError } from '../utils/AppError.js';

/**
 * Middleware that ensures the caller has OWNER or ADMIN role.
 * If the user is unauthenticated, yields 401 UNAUTHORIZED.
 * If the user has any other role (e.g. CUSTOMER, PROVIDER), yields 404 NOT_FOUND
 * so that expenses are completely hidden from non-eligible roles.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export function requireExpenseAccess(req, _res, next) {
  if (!req.user) {
    return next(AppError.unauthorized('Authentication required'));
  }

  if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
    return next(AppError.notFound('Resource not found'));
  }

  next();
}
