import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

export const app = express();

// Set trust proxy if enabled (for Render/Railway/reverse proxies)
if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// 1. Request ID Middleware
app.use(requestId);

// 2. HTTP Request Logging (with authorization and cookie redaction)
app.use(
  pinoHttp({
    logger,
    autoLogging: env.NODE_ENV !== 'test',
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie'],
      censor: '***',
    },
  })
);

// 3. Security Headers
app.use(helmet());

// 4. CORS limited to FRONTEND_URL origins with credentials false
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as curl, mobile apps, or same-origin)
      if (!origin) return callback(null, true);
      if (env.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS origin not allowed'));
    },
    credentials: false,
  })
);

// 5. JSON Body Parser with 1mb limit
app.use(express.json({ limit: '1mb' }));

// 6. Global Rate Limiter
app.use(globalRateLimiter);

// 7. API Routes mounted under /api
app.use('/api', apiRoutes);

// 8. 404 Handler
app.use(notFound);

// 9. Centralized Error Handler
app.use(errorHandler);

export default app;
