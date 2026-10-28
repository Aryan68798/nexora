import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/AppError.js';

/**
 * @typedef {'BOOKING_REQUESTED' | 'BOOKING_CONFIRMED' | 'BOOKING_REJECTED' | 'BOOKING_CANCELLED' | 'BOOKING_COMPLETED' | 'PAYMENT_RECEIVED' | 'PAYMENT_REFUNDED' | 'REVIEW_RECEIVED' | 'INSPECTION_ASSIGNED' | 'INSPECTION_COMPLETED' | 'INSPECTION_CANCELLED' | 'MAINTENANCE_ASSIGNED' | 'MAINTENANCE_UNASSIGNED' | 'MAINTENANCE_DECLINED' | 'MAINTENANCE_STARTED' | 'MAINTENANCE_COMPLETED' | 'MAINTENANCE_CANCELLED' | 'MAINTENANCE_UPDATE' | 'PROVIDER_VERIFIED' | 'PROVIDER_REJECTED' | 'PROVIDER_REVIEWED'} NotificationType
 */

/**
 * @typedef {Object} CreateNotificationParams
 * @property {string} userId - Recipient user UUID
 * @property {NotificationType} type - Notification category
 * @property {string} title - Short notification heading
 * @property {string} message - Notification body text
 * @property {string} [linkUrl] - Optional in-app navigation URL
 */

/**
 * Creates a notification for a user.
 * Called AFTER the main transaction commits.
 * Must never throw an error that interrupts the caller's main workflow.
 * @param {CreateNotificationParams} params - Notification parameters
 * @returns {Promise<void>}
 */
export async function createNotification(params) {
  try {
    await prisma.notifications.create({
      data: {
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link_url: params.linkUrl ?? null,
      },
    });
  } catch (err) {
    logger.error(
      { err: err.message, userId: params.userId, type: params.type },
      'Failed to create notification (non-fatal)'
    );
  }
}

/**
 * Retrieves paginated notifications for a user.
 * @param {string} userId - User UUID
 * @param {{ page?: number, pageSize?: number, unreadOnly?: boolean }} options - Query options
 * @returns {Promise<{ items: any[], meta: { page: number, pageSize: number, total: number, totalPages: number } }>}
 */
export async function getUserNotifications(userId, options) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = { user_id: userId };
  if (options.unreadOnly) {
    where.read_at = null;
  }

  const [items, total] = await Promise.all([
    prisma.notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.notifications.count({ where }),
  ]);

  return {
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Gets the number of unread notifications for a user.
 * @param {string} userId - User UUID
 * @returns {Promise<number>} Unread notification count
 */
export async function getUnreadNotificationCount(userId) {
  return prisma.notifications.count({
    where: {
      user_id: userId,
      read_at: null,
    },
  });
}

/**
 * Marks a specific notification as read.
 * @param {string} userId - Authenticated user UUID
 * @param {string} notificationId - Notification UUID
 * @returns {Promise<any>} Updated notification record
 */
export async function markNotificationAsRead(userId, notificationId) {
  const notification = await prisma.notifications.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.user_id !== userId) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  }

  if (notification.read_at) {
    return notification;
  }

  return prisma.notifications.update({
    where: { id: notificationId },
    data: { read_at: new Date() },
  });
}

/**
 * Marks all notifications for a user as read.
 * @param {string} userId - User UUID
 * @returns {Promise<{ count: number }>} Number of marked notifications
 */
export async function markAllNotificationsAsRead(userId) {
  const result = await prisma.notifications.updateMany({
    where: {
      user_id: userId,
      read_at: null,
    },
    data: {
      read_at: new Date(),
    },
  });

  return { count: result.count };
}
