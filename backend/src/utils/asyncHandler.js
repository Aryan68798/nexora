/**
 * Wraps an async Express route handler or middleware to catch errors and forward to next().
 * @param {Function} fn - Async route handler function (req, res, next) => Promise<any>
 * @returns {Function} Express middleware handler
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
