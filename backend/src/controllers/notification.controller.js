import { sendSuccess } from '../utils/response.js';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notification.service.js';

export async function getNotificationsHandler(req, res) {
  const query = req.query;
  const result = await getUserNotifications(req.user.id, {
    page: query.page,
    pageSize: query.pageSize,
    unreadOnly: query.unread,
  });

  const data = result.items.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    readAt: n.read_at,
    linkUrl: n.link_url,
    createdAt: n.created_at,
  }));

  sendSuccess(res, data, 200, result.meta);
}

export async function getUnreadCountHandler(req, res) {
  const count = await getUnreadNotificationCount(req.user.id);
  sendSuccess(res, { count });
}

export async function markAsReadHandler(req, res) {
  const { id } = req.params;
  const updated = await markNotificationAsRead(req.user.id, id);

  sendSuccess(res, {
    id: updated.id,
    readAt: updated.read_at,
  });
}

export async function markAllAsReadHandler(req, res) {
  const result = await markAllNotificationsAsRead(req.user.id);
  sendSuccess(res, { count: result.count });
}
