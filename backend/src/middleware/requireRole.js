import { AppError } from '../utils/AppError.js';

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(`Access denied: required role ${allowedRoles.join(' or ')}`)
      );
    }

    next();
  };
}
