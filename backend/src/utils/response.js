import { serializeResponse } from './serialize.js';

/**
 * Sends a standardized JSON success response.
 * @param {import('express').Response} res - Express response object
 * @param {any} data - Data payload to return
 * @param {number} [statusCode=200] - HTTP status code
 * @param {any} [meta] - Optional metadata (e.g. pagination)
 * @returns {import('express').Response}
 */
export function sendSuccess(res, data, statusCode = 200, meta) {
  const serializedData = serializeResponse(data);
  const payload = {
    success: true,
    data: serializedData,
  };
  if (meta !== undefined) {
    payload.meta = serializeResponse(meta);
  }
  return res.status(statusCode).json(payload);
}

/**
 * Sends a standardized JSON error response.
 * @param {import('express').Response} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable error message
 * @param {any} [details] - Optional extra details
 * @returns {import('express').Response}
 */
export function sendError(res, statusCode, code, message, details) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}
