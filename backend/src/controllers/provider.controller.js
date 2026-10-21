import { sendSuccess } from '../utils/response.js';
import * as providerService from '../services/provider.service.js';

export async function createProviderProfileHandler(req, res) {
  const result = await providerService.createProviderProfile(req.user.id, req.body);
  return sendSuccess(res, result, 201);
}

export async function getMyProviderProfileHandler(req, res) {
  const result = await providerService.getMyProviderProfile(req.user.id);
  return sendSuccess(res, result, 200);
}

export async function updateMyProviderProfileHandler(req, res) {
  const result = await providerService.updateMyProviderProfile(req.user.id, req.body);
  return sendSuccess(res, result, 200);
}

export async function listProvidersHandler(req, res) {
  const result = await providerService.listProviders(req.user, req.query);
  return sendSuccess(res, result.items, 200, result.meta);
}

export async function getProviderByIdHandler(req, res) {
  const result = await providerService.getProviderById(req.params.id, req.user);
  return sendSuccess(res, result, 200);
}

export async function getProviderReviewsHandler(req, res) {
  const result = await providerService.getProviderReviews(req.params.id, req.query);
  return sendSuccess(res, result.items, 200, result.meta);
}

export async function adminListProvidersHandler(req, res) {
  const result = await providerService.adminListProviders(req.query);
  return sendSuccess(res, result.items, 200, result.meta);
}

export async function adminUpdateVerificationHandler(req, res) {
  const result = await providerService.adminUpdateVerification(
    req.params.id,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 200);
}
