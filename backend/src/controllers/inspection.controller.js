import { sendSuccess } from '../utils/response.js';
import * as inspectionService from '../services/inspection.service.js';

export async function createInspectionHandler(req, res) {
  const result = await inspectionService.createInspection(
    req.params.propertyId,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 201);
}

export async function listPropertyInspectionsHandler(req, res) {
  const result = await inspectionService.listPropertyInspections(
    req.params.propertyId,
    req.user,
    req.query
  );
  return sendSuccess(res, result.items, 200, result.meta);
}

export async function getInspectionByIdHandler(req, res) {
  const result = await inspectionService.getInspectionById(
    req.params.id,
    req.user
  );
  return sendSuccess(res, result, 200);
}

export async function updateInspectionHandler(req, res) {
  const result = await inspectionService.updateInspection(
    req.params.id,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 200);
}

export async function updateInspectionItemsHandler(req, res) {
  const result = await inspectionService.updateInspectionItems(
    req.params.id,
    req.user,
    req.body.items
  );
  return sendSuccess(res, result, 200);
}

export async function completeInspectionHandler(req, res) {
  const result = await inspectionService.completeInspection(
    req.params.id,
    req.user
  );
  return sendSuccess(res, result, 200);
}

export async function cancelInspectionHandler(req, res) {
  const result = await inspectionService.cancelInspection(
    req.params.id,
    req.user
  );
  return sendSuccess(res, result, 200);
}

export async function getInspectionTemplatesHandler(_req, res) {
  return sendSuccess(res, inspectionService.DEFAULT_INSPECTION_TEMPLATES, 200);
}

export async function uploadInspectionMediaHandler(req, res) {
  const result = await inspectionService.uploadInspectionMedia(
    req.params.id,
    req.user,
    req.file,
    req.detectedFile,
    req.body.caption
  );
  return sendSuccess(res, result, 201);
}

export async function deleteInspectionMediaHandler(req, res) {
  await inspectionService.deleteInspectionMedia(
    req.params.id,
    req.user
  );
  return sendSuccess(res, { message: 'Inspection media deleted' }, 200);
}

export async function getPropertyHealthHandler(req, res) {
  const result = await inspectionService.getPropertyHealth(
    req.params.propertyId,
    req.user
  );
  return sendSuccess(res, result, 200);
}

export async function getOwnerHealthOverviewHandler(req, res) {
  const result = await inspectionService.getOwnerHealthOverview(req.user.id);
  return sendSuccess(res, result, 200);
}
