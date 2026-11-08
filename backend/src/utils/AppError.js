/**
 * Operational application error with HTTP status code and standardized machine-readable error code.
 */
export class AppError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Machine-readable error code
   * @param {string} message - Human-readable error message
   * @param {any} [details] - Optional extra error details
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * @param {string} message
   * @param {any} [details]
   * @returns {AppError}
   */
  static badRequest(message, details) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  /**
   * @param {string} [message]
   * @returns {AppError}
   */
  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  /**
   * @param {string} [message]
   * @returns {AppError}
   */
  static forbidden(message = 'Forbidden') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  /**
   * @param {string} [message]
   * @returns {AppError}
   */
  static notFound(message = 'Not Found') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  /**
   * @param {string} message
   * @param {any} [details]
   * @returns {AppError}
   */
  static conflict(message, details) {
    return new AppError(409, 'CONFLICT', message, details);
  }

  /**
   * @param {string} [message]
   * @returns {AppError}
   */
  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new AppError(429, 'TOO_MANY_REQUESTS', message);
  }

  /**
   * @param {string} [message]
   * @returns {AppError}
   */
  static internal(message = 'Internal server error') {
    return new AppError(500, 'INTERNAL_ERROR', message);
  }
}
