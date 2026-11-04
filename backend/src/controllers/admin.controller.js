import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { getPagination, buildPaginationMeta } from '../utils/pagination.js';
import { logger } from '../lib/logger.js';

export async function getAdminUsers(req, res) {
  const query = req.query;
  const { page, pageSize, skip, take } = getPagination(query);

  const where = {};

  if (query.role) {
    where.role = query.role;
  }

  if (query.isActive !== undefined) {
    where.is_active = query.isActive;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.profiles.count({ where }),
    prisma.profiles.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        service_providers: {
          select: {
            id: true,
            business_name: true,
            verification_status: true,
          },
        },
      },
    }),
  ]);

  sendSuccess(res, users, 200, buildPaginationMeta(page, pageSize, total));
}

export async function updateAdminUser(req, res) {
  const { id } = req.params;
  const currentAdminId = req.user.id;
  const input = req.body;

  if (id === currentAdminId) {
    if (input.role && input.role !== 'ADMIN') {
      throw AppError.badRequest('Admins cannot demote their own account role');
    }
    if (input.isActive === false) {
      throw AppError.badRequest('Admins cannot deactivate their own account');
    }
  }

  const targetUser = await prisma.profiles.findUnique({
    where: { id },
  });

  if (!targetUser) {
    throw AppError.notFound('User profile not found');
  }

  const dataToUpdate = {};

  if (input.role !== undefined) dataToUpdate.role = input.role;
  if (input.isActive !== undefined) dataToUpdate.is_active = input.isActive;

  const updatedUser = await prisma.profiles.update({
    where: { id },
    data: dataToUpdate,
  });

  logger.info(
    {
      adminId: currentAdminId,
      targetUserId: id,
      oldRole: targetUser.role,
      newRole: updatedUser.role,
      oldIsActive: targetUser.is_active,
      newIsActive: updatedUser.is_active,
    },
    'Admin updated user account state'
  );

  sendSuccess(res, updatedUser);
}

export async function getAdminStats(_req, res) {
  const [userCounts, propertyCounts, bookingCounts] = await Promise.all([
    prisma.profiles.groupBy({
      by: ['role'],
      _count: { id: true },
    }),
    prisma.properties.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.bookings.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ]);

  const usersByRole = {};
  for (const item of userCounts) {
    usersByRole[item.role] = item._count.id;
  }

  const propertiesByStatus = {};
  for (const item of propertyCounts) {
    propertiesByStatus[item.status] = item._count.id;
  }

  const bookingsByStatus = {};
  for (const item of bookingCounts) {
    bookingsByStatus[item.status] = item._count.id;
  }

  sendSuccess(res, {
    usersByRole,
    propertiesByStatus,
    bookingsByStatus,
  });
}
