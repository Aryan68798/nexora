import crypto from 'node:crypto';
import { supabase } from '../lib/supabase.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';

const tokenCache = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
const MAX_CACHE_SIZE = 500;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getFromCache(tokenHash) {
  const entry = tokenCache.get(tokenHash);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenCache.delete(tokenHash);
    return null;
  }
  return entry.user;
}

function setInCache(tokenHash, user) {
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = tokenCache.keys().next().value;
    if (oldestKey) tokenCache.delete(oldestKey);
  }
  tokenCache.set(tokenHash, {
    user,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export async function resolveUserFromToken(token) {
  const tokenHash = hashToken(token);
  const cached = getFromCache(tokenHash);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw AppError.unauthorized('Invalid or expired authentication token');
  }

  const authUser = data.user;
  if (!authUser.email) {
    throw AppError.unauthorized('User email is missing from auth token');
  }

  // Load profile from database via Prisma
  let profile = await prisma.profiles.findUnique({
    where: { id: authUser.id },
  });

  // Profile missing (e.g. trigger delayed or custom signup) -> create it once with role CUSTOMER
  if (!profile) {
    const fallbackName =
      authUser.user_metadata?.name ||
      authUser.user_metadata?.full_name ||
      authUser.email.split('@')[0] ||
      'User';

    profile = await prisma.profiles.create({
      data: {
        id: authUser.id,
        email: authUser.email,
        name: fallbackName,
        role: 'CUSTOMER',
        is_active: true,
      },
    });
  }

  if (profile.is_active === false) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled. Please contact support.');
  }

  const resolvedUser = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    name: profile.name,
  };

  setInCache(tokenHash, resolvedUser);
  return resolvedUser;
}

export async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication token is required');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw AppError.unauthorized('Authentication token is required');
    }

    req.user = await resolveUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next();
    }

    req.user = await resolveUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
