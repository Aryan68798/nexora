import { sendSuccess } from '../utils/response.js';
import * as maintenanceService from '../services/maintenance.service.js';

export async function createMaintenanceRequestHandler(req, res) {
  const result = await maintenanceService.createMaintenanceRequest(req.user, req.body);
  return sendSuccess(res, result, 201);
}

export async function listMaintenanceRequestsHandler(req, res) {
  const result = await maintenanceService.listMaintenanceRequests(req.user, req.query);
  return sendSuccess(res, result.items, 200, result.meta);
}

export async function getMaintenanceRequestByIdHandler(req, res) {
  const result = await maintenanceService.getMaintenanceRequestById(req.params.id, req.user);
  return sendSuccess(res, result, 200);
}

export async function updateMaintenanceRequestHandler(req, res) {
  const result = await maintenanceService.updateMaintenanceRequest(
    req.params.id,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 200);
}

export async function assignProviderHandler(req, res) {
  const result = await maintenanceService.assignProvider(
    req.params.id,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 200);
}

export async function unassignProviderHandler(req, res) {
  const result = await maintenanceService.unassignProvider(req.params.id, req.user);
  return sendSuccess(res, result, 200);
}

export async function declineJobHandler(req, res) {
  const result = await maintenanceService.declineJob(req.params.id, req.user, req.body);
  return sendSuccess(res, result, 200);
}

export async function startJobHandler(req, res) {
  const result = await maintenanceService.startJob(req.params.id, req.user);
  return sendSuccess(res, result, 200);
}

export async function completeJobHandler(req, res) {
  const result = await maintenanceService.completeJob(req.params.id, req.user, req.body);
  return sendSuccess(res, result, 200);
}

export async function cancelJobHandler(req, res) {
  const result = await maintenanceService.cancelJob(req.params.id, req.user, req.body);
  return sendSuccess(res, result, 200);
}

export async function addUpdateRequestHandler(req, res) {
  const result = await maintenanceService.addUpdateRequest(
    req.params.id,
    req.user,
    req.body.note,
    req.file,
    req.detectedFile
  );
  return sendSuccess(res, result, 201);
}

export async function createProviderReviewHandler(req, res) {
  const result = await maintenanceService.createProviderReview(
    req.params.id,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 201);
}
