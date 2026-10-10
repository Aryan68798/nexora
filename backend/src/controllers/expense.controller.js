import { sendSuccess } from '../utils/response.js';
import * as expenseService from '../services/expense.service.js';

export async function getExpenseCategoriesHandler(req, res) {
  const categories = expenseService.getExpenseCategories();
  return sendSuccess(res, categories, 200);
}

export async function createPropertyExpenseHandler(req, res) {
  const result = await expenseService.createPropertyExpense(
    req.params.propertyId,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 201);
}

export async function listPropertyExpensesHandler(req, res) {
  const result = await expenseService.listPropertyExpenses(
    req.params.propertyId,
    req.user,
    req.query
  );
  return sendSuccess(res, result.items, 200, result.meta);
}

export async function getPropertyExpensesSummaryHandler(req, res) {
  const result = await expenseService.getPropertyExpensesSummary(
    req.params.propertyId,
    req.user,
    req.query
  );
  return sendSuccess(res, result, 200);
}

export async function getExpenseByIdHandler(req, res) {
  const result = await expenseService.getExpenseById(req.params.id, req.user);
  return sendSuccess(res, result, 200);
}

export async function updateExpenseHandler(req, res) {
  const result = await expenseService.updateExpense(
    req.params.id,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 200);
}

export async function deleteExpenseHandler(req, res) {
  const result = await expenseService.deleteExpense(req.params.id, req.user);
  return sendSuccess(res, result, 200);
}

export async function uploadExpenseReceiptHandler(req, res) {
  const result = await expenseService.uploadExpenseReceipt(
    req.params.id,
    req.user,
    req.file,
    req.detectedFile
  );
  return sendSuccess(res, result, 200);
}

export async function deleteExpenseReceiptHandler(req, res) {
  const result = await expenseService.deleteExpenseReceipt(req.params.id, req.user);
  return sendSuccess(res, result, 200);
}

export async function recordExpenseFromJobHandler(req, res) {
  const result = await expenseService.recordExpenseFromMaintenanceJob(
    req.params.id,
    req.user,
    req.body
  );
  return sendSuccess(res, result, 201);
}
