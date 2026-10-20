import crypto from 'node:crypto';

export function requestId(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const id = typeof incomingId === 'string' && incomingId.length > 0 ? incomingId : crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
