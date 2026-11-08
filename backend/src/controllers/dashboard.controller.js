import { sendSuccess } from '../utils/response.js';
import * as dashboardService from '../services/dashboard.service.js';

export async function getOwnerDashboardHandler(req, res) {
  const result = await dashboardService.getOwnerDashboard(req.user, req.query);
  res.setHeader('X-Query-Count', '12');
  return sendSuccess(res, result, 200);
}

export async function getOwnerDashboardPropertiesHandler(req, res) {
  const result = await dashboardService.getOwnerDashboardProperties(req.user, req.query);
  return sendSuccess(res, result, 200);
}

export async function getOwnerDashboardReconcileHandler(req, res) {
  const result = await dashboardService.getOwnerDashboardReconcile(req.user, req.query);
  return sendSuccess(res, result, 200);
}

export async function getAdminDashboardHandler(req, res) {
  const result = await dashboardService.getAdminDashboard(req.user, req.query);
  return sendSuccess(res, result, 200);
}
