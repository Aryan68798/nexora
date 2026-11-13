import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';

export async function getMe(req, res) {
  const profile = await prisma.profiles.findUnique({
    where: { id: req.user.id },
    include: {
      service_providers: true,
    },
  });

  if (!profile) {
    throw AppError.notFound('Profile not found');
  }

  const { service_providers, ...profileData } = profile;
  sendSuccess(res, {
    ...profileData,
    serviceProvider: service_providers || null,
  });
}

export async function updateMe(req, res) {
  const input = req.body;

  const dataToUpdate = {};

  if (input.name !== undefined) dataToUpdate.name = input.name;
  if (input.phone !== undefined) dataToUpdate.phone = input.phone;
  if (input.avatarUrl !== undefined) dataToUpdate.avatar_url = input.avatarUrl;

  const updated = await prisma.profiles.update({
    where: { id: req.user.id },
    data: dataToUpdate,
    include: {
      service_providers: true,
    },
  });

  const { service_providers, ...profileData } = updated;
  sendSuccess(res, {
    ...profileData,
    serviceProvider: service_providers || null,
  });
}

export async function changeRole(req, res) {
  const { role } = req.body;

  const currentProfile = await prisma.profiles.findUnique({
    where: { id: req.user.id },
    select: { id: true, role: true },
  });

  if (!currentProfile) {
    throw AppError.notFound('Profile not found');
  }

  // Allowed ONLY when current role is CUSTOMER
  if (currentProfile.role !== 'CUSTOMER') {
    throw new AppError(
      409,
      'ROLE_CHANGE_NOT_ALLOWED',
      'Role change is only allowed for users with role CUSTOMER'
    );
  }

  // User must have zero bookings, zero payments, and zero favorites
  const [bookingCount, paymentCount, favoriteCount] = await Promise.all([
    prisma.bookings.count({ where: { customer_id: req.user.id } }),
    prisma.payments.count({ where: { payer_id: req.user.id } }),
    prisma.favorites.count({ where: { customer_id: req.user.id } }),
  ]);

  if (bookingCount > 0 || paymentCount > 0 || favoriteCount > 0) {
    throw new AppError(
      409,
      'ROLE_CHANGE_NOT_ALLOWED',
      'Role change is not allowed once bookings, payments, or favorites exist'
    );
  }

  const updated = await prisma.profiles.update({
    where: { id: req.user.id },
    data: { role },
    include: {
      service_providers: true,
    },
  });

  // Log role transition with pino (user id, old, new; strictly NO email)
  logger.info(
    { userId: req.user.id, oldRole: currentProfile.role, newRole: role },
    'User changed profile role'
  );

  const { service_providers, ...profileData } = updated;
  sendSuccess(res, {
    ...profileData,
    serviceProvider: service_providers || null,
  });
}
