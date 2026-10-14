import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { storageService } from './storage.service.js';
import { EXPENSE_CATEGORIES } from '../validators/expense.validator.js';

/**
 * Returns available expense categories.
 * @returns {string[]}
 */
export function getExpenseCategories() {
  return EXPENSE_CATEGORIES;
}

/**
 * Formats a raw Prisma property_expenses record for JSON responses.
 * @param {object} expense - Raw expense record
 * @param {string|null} [signedReceiptUrl=null] - Temporary signed URL for receipt
 * @returns {object}
 */
export function formatExpenseResponse(expense, signedReceiptUrl = null) {
  if (!expense) return null;

  let incurredOnStr = null;
  if (expense.incurred_on) {
    if (expense.incurred_on instanceof Date) {
      incurredOnStr = expense.incurred_on.toISOString().slice(0, 10);
    } else {
      incurredOnStr = String(expense.incurred_on).slice(0, 10);
    }
  }

  const res = {
    id: expense.id,
    propertyId: expense.property_id,
    addedBy: expense.added_by,
    maintenanceRequestId: expense.maintenance_request_id ?? null,
    maintenanceTitle: expense.maintenance_requests?.title ?? null,
    category: expense.category,
    description: expense.description,
    amount: new Prisma.Decimal(expense.amount).toFixed(2),
    incurredOn: incurredOnStr,
    hasReceipt: Boolean(expense.receipt_url),
    receiptUrl: signedReceiptUrl,
    createdAt: expense.created_at,
  };

  return res;
}

/**
 * Verifies caller has access to the property (OWNER of property or ADMIN).
 * Throws 404 if property not found or caller lacks access.
 * @param {string} propertyId
 * @param {object} user
 * @returns {Promise<object>}
 */
async function verifyPropertyAccess(propertyId, user) {
  const property = await prisma.properties.findUnique({
    where: { id: propertyId },
    select: { id: true, owner_id: true, title: true },
  });

  if (!property) {
    throw AppError.notFound('Property not found');
  }

  if (user.role !== 'ADMIN' && property.owner_id !== user.id) {
    throw AppError.notFound('Property not found');
  }

  return property;
}

/**
 * Creates a new property expense.
 * If maintenanceRequestId is provided, takes a row lock FOR UPDATE and enforces
 * the one-expense-per-job rule.
 * @param {string} propertyId
 * @param {object} user
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createPropertyExpense(propertyId, user, data) {
  await verifyPropertyAccess(propertyId, user);

  const amountDecimal = new Prisma.Decimal(data.amount).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP
  );

  const incurredOnDate = new Date(`${data.incurredOn}T00:00:00.000Z`);

  if (data.maintenanceRequestId) {
    const created = await prisma.$transaction(async (tx) => {
      // 1. Lock maintenance request row
      const rows = await tx.$queryRaw`
        SELECT id, property_id, status, actual_cost, title
        FROM public.maintenance_requests
        WHERE id = ${data.maintenanceRequestId}::uuid
        FOR UPDATE
      `;
      const lockedReq = rows[0];

      if (!lockedReq) {
        throw AppError.notFound('Maintenance request not found');
      }

      if (lockedReq.property_id !== propertyId) {
        throw AppError.badRequest('Maintenance request does not belong to this property');
      }

      if (lockedReq.status !== 'COMPLETED' || !lockedReq.actual_cost) {
        throw new AppError(
          409,
          'NOT_COMPLETED',
          'Expense can only be linked to a COMPLETED maintenance job with an actual cost'
        );
      }

      const existingExpense = await tx.property_expenses.findFirst({
        where: { maintenance_request_id: data.maintenanceRequestId },
        select: { id: true },
      });

      if (existingExpense) {
        throw new AppError(
          409,
          'EXPENSE_EXISTS',
          'An expense has already been recorded for this maintenance job',
          { expenseId: existingExpense.id }
        );
      }

      return tx.property_expenses.create({
        data: {
          property_id: propertyId,
          added_by: user.id,
          maintenance_request_id: data.maintenanceRequestId,
          category: data.category,
          description: data.description,
          amount: amountDecimal,
          incurred_on: incurredOnDate,
        },
        include: {
          maintenance_requests: { select: { title: true } },
        },
      });
    });

    return formatExpenseResponse(created);
  }

  const created = await prisma.property_expenses.create({
    data: {
      property_id: propertyId,
      added_by: user.id,
      maintenance_request_id: null,
      category: data.category,
      description: data.description,
      amount: amountDecimal,
      incurred_on: incurredOnDate,
    },
    include: {
      maintenance_requests: { select: { title: true } },
    },
  });

  return formatExpenseResponse(created);
}

/**
 * Lists property expenses with pagination, filters, and overall totalAmount sum.
 * @param {string} propertyId
 * @param {object} user
 * @param {object} query
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function listPropertyExpenses(propertyId, user, query) {
  await verifyPropertyAccess(propertyId, user);

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const where = { property_id: propertyId };

  if (query.category) {
    const categories = query.category.split(',').map((c) => c.trim().toUpperCase());
    where.category = { in: categories };
  }

  if (query.from || query.to) {
    where.incurred_on = {};
    if (query.from) where.incurred_on.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) where.incurred_on.lte = new Date(`${query.to}T23:59:59.999Z`);
  }

  if (query.q) {
    where.description = { contains: query.q, mode: 'insensitive' };
  }

  let orderBy = [{ incurred_on: 'desc' }, { created_at: 'desc' }];
  if (query.sort === 'amount_desc') {
    orderBy = [{ amount: 'desc' }, { incurred_on: 'desc' }];
  }

  const [total, sumAgg, records] = await Promise.all([
    prisma.property_expenses.count({ where }),
    prisma.property_expenses.aggregate({
      where,
      _sum: { amount: true },
    }),
    prisma.property_expenses.findMany({
      where,
      include: {
        maintenance_requests: { select: { title: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const totalAmount = sumAgg._sum.amount
    ? new Prisma.Decimal(sumAgg._sum.amount).toFixed(2)
    : '0.00';

  return {
    items: records.map((r) => formatExpenseResponse(r)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      totalAmount,
    },
  };
}

/**
 * Retrieves an expense by ID, returning a signed receipt URL and jobCostMismatch warning if applicable.
 * @param {string} id
 * @param {object} user
 * @returns {Promise<object>}
 */
export async function getExpenseById(id, user) {
  const expense = await prisma.property_expenses.findUnique({
    where: { id },
    include: {
      properties: { select: { id: true, owner_id: true } },
      maintenance_requests: { select: { id: true, title: true, actual_cost: true } },
    },
  });

  if (!expense) {
    throw AppError.notFound('Expense not found');
  }

  if (user.role !== 'ADMIN' && expense.properties.owner_id !== user.id) {
    throw AppError.notFound('Expense not found');
  }

  let signedReceiptUrl = null;
  if (expense.receipt_url) {
    try {
      signedReceiptUrl = await storageService.getSignedUrl('receipts', expense.receipt_url, 3600);
    } catch {
      signedReceiptUrl = null;
    }
  }

  const formatted = formatExpenseResponse(expense, signedReceiptUrl);

  // Check jobCostMismatch
  if (expense.maintenance_request_id && expense.maintenance_requests?.actual_cost) {
    const jobActualCost = new Prisma.Decimal(expense.maintenance_requests.actual_cost);
    const expenseAmount = new Prisma.Decimal(expense.amount);
    const isMismatch = !jobActualCost.equals(expenseAmount);

    formatted.jobCostMismatch = isMismatch;
    if (isMismatch) {
      formatted.jobActualCost = jobActualCost.toFixed(2);
      formatted.expenseAmount = expenseAmount.toFixed(2);
    }
  } else {
    formatted.jobCostMismatch = false;
  }

  return formatted;
}

/**
 * Updates an expense's category, description, amount, or incurredOn date.
 * Property and maintenanceRequestId cannot be altered.
 * @param {string} id
 * @param {object} user
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateExpense(id, user, data) {
  const expense = await prisma.property_expenses.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!expense) {
    throw AppError.notFound('Expense not found');
  }

  if (user.role !== 'ADMIN' && expense.properties.owner_id !== user.id) {
    throw AppError.notFound('Expense not found');
  }

  const updateData = {};
  if (data.category !== undefined) updateData.category = data.category;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.amount !== undefined) {
    updateData.amount = new Prisma.Decimal(data.amount).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP
    );
  }
  if (data.incurredOn !== undefined) {
    updateData.incurred_on = new Date(`${data.incurredOn}T00:00:00.000Z`);
  }

  const updated = await prisma.property_expenses.update({
    where: { id },
    data: updateData,
    include: {
      maintenance_requests: { select: { title: true } },
    },
  });

  return formatExpenseResponse(updated);
}

/**
 * Hard deletes an expense, its receipt in Supabase Storage, and media_assets row.
 * @param {string} id
 * @param {object} user
 * @returns {Promise<{ message: string }>}
 */
export async function deleteExpense(id, user) {
  const expense = await prisma.property_expenses.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!expense) {
    throw AppError.notFound('Expense not found');
  }

  if (user.role !== 'ADMIN' && expense.properties.owner_id !== user.id) {
    throw AppError.notFound('Expense not found');
  }

  // Remove storage object and media_assets row if present
  if (expense.receipt_url) {
    await storageService.deleteFile('receipts', expense.receipt_url);
    await prisma.media_assets.deleteMany({
      where: { storage_path: expense.receipt_url },
    });
  }

  await prisma.property_expenses.delete({
    where: { id },
  });

  return { message: 'Expense deleted successfully' };
}

/**
 * Uploads or replaces a receipt file in the private "receipts" bucket.
 * Deletes old receipt object and media_assets row only after new upload & DB update succeed.
 * @param {string} id
 * @param {object} user
 * @param {Express.Multer.File} file
 * @param {{ mimeType: string, ext: string }} detectedFile
 * @returns {Promise<{ receiptUrl: string }>}
 */
export async function uploadExpenseReceipt(id, user, file, detectedFile) {
  const expense = await prisma.property_expenses.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!expense) {
    throw AppError.notFound('Expense not found');
  }

  if (user.role !== 'ADMIN' && expense.properties.owner_id !== user.id) {
    throw AppError.notFound('Expense not found');
  }

  const oldStoragePath = expense.receipt_url;
  const newStoragePath = `${expense.property_id}/${id}/${crypto.randomUUID()}.${detectedFile.ext}`;

  // Upload new file to private bucket
  await storageService.uploadPrivateFile('receipts', newStoragePath, file.buffer, detectedFile.mimeType);

  try {
    await prisma.$transaction([
      prisma.property_expenses.update({
        where: { id },
        data: { receipt_url: newStoragePath },
      }),
      prisma.media_assets.create({
        data: {
          owner_type: 'EXPENSE',
          owner_id: id,
          bucket: 'receipts',
          storage_path: newStoragePath,
          mime_type: detectedFile.mimeType,
          size_bytes: file.size,
          uploaded_by: user.id,
          alt_text: file.originalname || 'Expense receipt',
        },
      }),
    ]);
  } catch (err) {
    // Clean up newly uploaded file if DB update fails
    await storageService.deleteFile('receipts', newStoragePath);
    throw err;
  }

  // If new write succeeded and old receipt existed, remove old file and DB asset
  if (oldStoragePath) {
    await storageService.deleteFile('receipts', oldStoragePath);
    await prisma.media_assets.deleteMany({
      where: { storage_path: oldStoragePath },
    });
  }

  const signedUrl = await storageService.getSignedUrl('receipts', newStoragePath, 3600);
  return { receiptUrl: signedUrl };
}

/**
 * Removes receipt file from private storage, media_assets row, and clears receipt_url.
 * @param {string} id
 * @param {object} user
 * @returns {Promise<{ message: string }>}
 */
export async function deleteExpenseReceipt(id, user) {
  const expense = await prisma.property_expenses.findUnique({
    where: { id },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!expense) {
    throw AppError.notFound('Expense not found');
  }

  if (user.role !== 'ADMIN' && expense.properties.owner_id !== user.id) {
    throw AppError.notFound('Expense not found');
  }

  if (expense.receipt_url) {
    await storageService.deleteFile('receipts', expense.receipt_url);
    await prisma.media_assets.deleteMany({
      where: { storage_path: expense.receipt_url },
    });
    await prisma.property_expenses.update({
      where: { id },
      data: { receipt_url: null },
    });
  }

  return { message: 'Receipt deleted successfully' };
}

/**
 * Records an expense from a completed maintenance job.
 * Enforces one expense per job via row locking FOR UPDATE.
 * Amount is strictly copied from actualCost.
 * @param {string} maintenanceRequestId
 * @param {object} user
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function recordExpenseFromMaintenanceJob(maintenanceRequestId, user, data) {
  const reqCheck = await prisma.maintenance_requests.findUnique({
    where: { id: maintenanceRequestId },
    include: { properties: { select: { owner_id: true } } },
  });

  if (!reqCheck) {
    throw AppError.notFound('Maintenance request not found');
  }

  if (user.role !== 'ADMIN' && reqCheck.properties.owner_id !== user.id) {
    throw AppError.notFound('Maintenance request not found');
  }

  const created = await prisma.$transaction(async (tx) => {
    // Lock maintenance request row
    const rows = await tx.$queryRaw`
      SELECT id, property_id, status, actual_cost, title, completed_at
      FROM public.maintenance_requests
      WHERE id = ${maintenanceRequestId}::uuid
      FOR UPDATE
    `;
    const lockedReq = rows[0];

    if (!lockedReq) {
      throw AppError.notFound('Maintenance request not found');
    }

    if (lockedReq.status !== 'COMPLETED' || !lockedReq.actual_cost) {
      throw new AppError(
        409,
        'NOT_COMPLETED',
        'Expense can only be recorded for COMPLETED maintenance jobs with an actual cost'
      );
    }

    const existingExpense = await tx.property_expenses.findFirst({
      where: { maintenance_request_id: maintenanceRequestId },
      select: { id: true },
    });

    if (existingExpense) {
      throw new AppError(
        409,
        'EXPENSE_EXISTS',
        'An expense has already been recorded for this maintenance job',
        { expenseId: existingExpense.id }
      );
    }

    const description = data.description || `Maintenance: ${lockedReq.title}`;
    let incurredOnDate;
    if (data.incurredOn) {
      incurredOnDate = new Date(`${data.incurredOn}T00:00:00.000Z`);
    } else if (lockedReq.completed_at) {
      incurredOnDate = new Date(lockedReq.completed_at);
    } else {
      incurredOnDate = new Date();
    }

    return tx.property_expenses.create({
      data: {
        property_id: lockedReq.property_id,
        added_by: user.id,
        maintenance_request_id: maintenanceRequestId,
        category: 'MAINTENANCE',
        description,
        amount: lockedReq.actual_cost,
        incurred_on: incurredOnDate,
      },
      include: {
        maintenance_requests: { select: { title: true } },
      },
    });
  });

  return formatExpenseResponse(created);
}

/**
 * Generates financial summary for a property's expenses over a given date range.
 * Uses at most TWO grouped database queries.
 * @param {string} propertyId
 * @param {object} user
 * @param {object} query
 * @returns {Promise<object>}
 */
export async function getPropertyExpensesSummary(propertyId, user, query) {
  await verifyPropertyAccess(propertyId, user);

  let fromDate;
  let toDate;

  if (query.year && !query.from && !query.to) {
    fromDate = new Date(`${query.year}-01-01T00:00:00.000Z`);
    toDate = new Date(`${query.year}-12-31T23:59:59.999Z`);
  } else {
    if (query.to) {
      toDate = new Date(`${query.to}T23:59:59.999Z`);
    } else {
      toDate = new Date();
    }

    if (query.from) {
      fromDate = new Date(`${query.from}T00:00:00.000Z`);
    } else {
      // Default: 12 months range (11 months back from toDate to include 12 full months)
      fromDate = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth() - 11, 1, 0, 0, 0, 0));
    }
  }

  if (fromDate > toDate) {
    throw AppError.badRequest('"from" date cannot be after "to" date');
  }

  // Exactly TWO grouped queries:
  // 1. Grouped by category
  const categoryGroups = await prisma.property_expenses.groupBy({
    by: ['category'],
    where: {
      property_id: propertyId,
      incurred_on: { gte: fromDate, lte: toDate },
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  // 2. Grouped by month
  const monthGroups = await prisma.$queryRaw`
    SELECT
      to_char(incurred_on, 'YYYY-MM') AS month,
      COALESCE(SUM(amount), 0) AS total
    FROM public.property_expenses
    WHERE property_id = ${propertyId}::uuid
      AND incurred_on >= ${fromDate}
      AND incurred_on <= ${toDate}
    GROUP BY to_char(incurred_on, 'YYYY-MM')
    ORDER BY month ASC
  `;

  let totalOverall = new Prisma.Decimal(0);
  let totalCount = 0;

  for (const cg of categoryGroups) {
    if (cg._sum.amount) {
      totalOverall = totalOverall.plus(cg._sum.amount);
    }
    totalCount += cg._count.id;
  }

  const byCategory = categoryGroups
    .map((cg) => {
      const catTotal = cg._sum.amount ? new Prisma.Decimal(cg._sum.amount) : new Prisma.Decimal(0);
      const percent = totalOverall.isZero()
        ? new Prisma.Decimal(0)
        : catTotal.dividedBy(totalOverall).times(100).toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP);

      return {
        category: cg.category,
        total: catTotal.toFixed(2),
        count: cg._count.id,
        percent: percent.toFixed(1),
      };
    })
    .sort((a, b) => Number(b.total) - Number(a.total));

  // Build month map from query 2
  const monthMap = new Map();
  if (Array.isArray(monthGroups)) {
    for (const r of monthGroups) {
      monthMap.set(r.month, new Prisma.Decimal(r.total).toFixed(2));
    }
  }

  // Ensure EVERY month in the range is present
  const byMonth = [];
  const current = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1));

  while (current <= endMonth) {
    const yyyy = current.getUTCFullYear();
    const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
    const monthKey = `${yyyy}-${mm}`;

    byMonth.push({
      month: monthKey,
      total: monthMap.get(monthKey) || '0.00',
    });

    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return {
    total: totalOverall.toFixed(2),
    count: totalCount,
    byCategory,
    byMonth,
  };
}
