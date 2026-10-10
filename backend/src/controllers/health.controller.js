import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';

export async function getHealth(_req, res) {
  sendSuccess(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

export async function getDbHealth(_req, res) {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    sendSuccess(res, {
      status: 'ok',
      db: 'connected',
    });
  } catch {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database connection failed',
      },
    });
  }
}
