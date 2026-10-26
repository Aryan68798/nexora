import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/middleware/errorHandler.js';

describe('Error Handler Security & Masking', () => {
  it('never exposes stack traces or raw SQL to clients on 500 errors', async () => {
    const testApp = express();

    testApp.get('/throw-error', (_req, _res, _next) => {
      const err = new Error('FATAL: relation "auth.internal_secrets" does not exist at /src/secret.ts:42');
      err.stack = 'Error: FATAL at /secret/path/to/db.ts:123';
      throw err;
    });

    testApp.use(errorHandler);

    const res = await request(testApp).get('/throw-error');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('Internal server error');
    // Ensure stack trace and internal message are completely masked
    expect(res.body.error.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('internal_secrets');
    expect(JSON.stringify(res.body)).not.toContain('/secret/path');
  });
});
