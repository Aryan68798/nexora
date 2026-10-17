import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { getOwnerHealthOverview, getPropertyHealth } from './inspection.service.js';

/**
 * Sanitizes text to ensure no emails or phone numbers are leaked in activity logs.
 * @param {string} text
 * @returns {string}
 */
function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[REDACTED_PHONE]');
}

/**
 * Computes date range boundaries in Asia/Kolkata timezone.
 * Defaults to the last 12 calendar months ending today.
 * @param {string} [from] - Optional YYYY-MM-DD
 * @param {string} [to] - Optional YYYY-MM-DD
 * @returns {{ fromStr: string, toStr: string, rangeStart: Date, rangeEnd: Date, months: string[], daysInRange: number }}
 */
export function resolveDateRange(from, to) {
  const now = new Date();
  const kolkataToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

  const toStr = to || kolkataToday;

  let fromStr = from;
  if (!fromStr) {
    // Default 12 calendar months ending in current month:
    // e.g. if to is 2026-11-22, 11 months prior is 2025-12-01
    const [toYearStr, toMonthStr] = toStr.split('-');
    let startYear = Number(toYearStr);
    let startMonth = Number(toMonthStr) - 11;
    if (startMonth <= 0) {
      startMonth += 12;
      startYear -= 1;
    }
    fromStr = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  }

  const rangeStart = new Date(`${fromStr}T00:00:00.000+05:30`);
  const rangeEnd = new Date(`${toStr}T23:59:59.999+05:30`);

  if (rangeStart > rangeEnd) {
    throw AppError.badRequest('"from" date cannot be after "to" date');
  }

  // Generate continuous list of months (YYYY-MM) across year boundaries
  const months = [];
  const [startYearStr, startMonthStr] = fromStr.split('-');
  const [endYearStr, endMonthStr] = toStr.split('-');

  let curY = Number(startYearStr);
  let curM = Number(startMonthStr);
  const endY = Number(endYearStr);
  const endM = Number(endMonthStr);

  while (curY < endY || (curY === endY && curM <= endM)) {
    months.push(`${curY}-${String(curM).padStart(2, '0')}`);
    curM += 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }
  }

  const daysInRange = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)));

  return { fromStr, toStr, rangeStart, rangeEnd, months, daysInRange };
}

/**
 * Resolves and validates target owner ID and property ownership.
 * Non-owners and non-admins receive 404.
 * @param {object} user - Authenticated user
 * @param {string} [queryOwnerId] - Optional ownerId from query (Admin only)
 * @param {string} [queryPropertyId] - Optional propertyId from query
 * @returns {Promise<{ targetOwnerId: string, property: object|null }>}
 */
async function resolveDashboardScope(user, queryOwnerId, queryPropertyId) {
  if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
    throw AppError.notFound('Dashboard not found');
  }

  let targetOwnerId = user.id;
  if (user.role === 'ADMIN' && queryOwnerId) {
    const ownerProfile = await prisma.profiles.findUnique({
      where: { id: queryOwnerId },
      select: { id: true, role: true },
    });
    if (!ownerProfile || ownerProfile.role !== 'OWNER') {
      throw AppError.notFound('Owner profile not found');
    }
    targetOwnerId = ownerProfile.id;
  }

  let property = null;
  if (queryPropertyId) {
    property = await prisma.properties.findUnique({
      where: { id: queryPropertyId },
      select: { id: true, owner_id: true, title: true },
    });

    if (!property) {
      throw AppError.notFound('Property not found');
    }

    if (user.role !== 'ADMIN' && property.owner_id !== user.id) {
      throw AppError.notFound('Property not found');
    }

    targetOwnerId = property.owner_id;
  }

  return { targetOwnerId, property };
}

/**
 * Retrieves the comprehensive owner dashboard for a date range and optional property.
 * @param {object} user - Authenticated user
 * @param {object} query - Query parameters (from, to, propertyId, ownerId)
 * @returns {Promise<object>} Dashboard payload
 */
export async function getOwnerDashboard(user, query) {
  const { targetOwnerId, property } = await resolveDashboardScope(user, query.ownerId, query.propertyId);
  const { fromStr, toStr, rangeStart, rangeEnd, months, daysInRange } = resolveDateRange(query.from, query.to);

  const propertyFilter = property
    ? Prisma.sql`AND pr.id = ${property.id}::uuid`
    : Prisma.empty;

  // Execute grouped SQL queries in parallel (Target: 12 queries or fewer, fixed count)
  const [
    paymentTotalsRows,
    incomeExpectedRows,
    expenseTotalRows,
    monthlyIncomeRows,
    monthlyExpenseRows,
    bookingCountsRows,
    occupancyRows,
    topSpacesRows,
    maintenanceRows,
    upcomingBookings,
    upcomingInspections,
    upcomingMaintenance,
    recentBookingHistory,
    recentPayments,
    recentUpdates,
  ] = await Promise.all([
    // 1. Payment Totals (incomeReceived, grossCollected, platformFeesPaid, taxCollected, refundedAmount)
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN ROUND(p.amount * (b.owner_amount / NULLIF(b.total_amount, 0)), 2) ELSE 0 END), 0) AS income_received,
        COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN p.amount ELSE 0 END), 0) AS gross_collected,
        COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN ROUND(p.amount * (b.platform_fee / NULLIF(b.total_amount, 0)), 2) ELSE 0 END), 0) AS platform_fees_paid,
        COALESCE(SUM(CASE WHEN p.status = 'PAID' THEN ROUND(p.amount * (b.tax_amount / NULLIF(b.total_amount, 0)), 2) ELSE 0 END), 0) AS tax_collected,
        COALESCE(SUM(CASE WHEN p.status = 'REFUNDED' THEN p.amount ELSE 0 END), 0) AS refunded_amount
      FROM public.payments p
      JOIN public.bookings b ON p.booking_id = b.id
      JOIN public.spaces s ON b.space_id = s.id
      JOIN public.properties pr ON s.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND (
          (p.status = 'PAID' AND p.paid_at >= ${rangeStart} AND p.paid_at <= ${rangeEnd})
          OR (p.status = 'REFUNDED' AND (
            (p.paid_at >= ${rangeStart} AND p.paid_at <= ${rangeEnd})
            OR (p.paid_at IS NULL AND p.created_at >= ${rangeStart} AND p.created_at <= ${rangeEnd})
          ))
        )
        ${propertyFilter}
    `,

    // 2. Expected Income
    prisma.$queryRaw`
      WITH booking_paid AS (
        SELECT
          p.booking_id,
          COALESCE(SUM(ROUND(p.amount * (b.owner_amount / NULLIF(b.total_amount, 0)), 2)), 0) AS paid_owner_share
        FROM public.payments p
        JOIN public.bookings b ON p.booking_id = b.id
        WHERE p.status = 'PAID'
        GROUP BY p.booking_id
      )
      SELECT
        COALESCE(SUM(GREATEST(0, b.owner_amount - COALESCE(bp.paid_owner_share, 0))), 0) AS income_expected
      FROM public.bookings b
      JOIN public.spaces s ON b.space_id = s.id
      JOIN public.properties pr ON s.property_id = pr.id
      LEFT JOIN booking_paid bp ON b.id = bp.booking_id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND b.status IN ('CONFIRMED', 'COMPLETED')
        AND b.start_at >= ${rangeStart}
        AND b.start_at <= ${rangeEnd}
        ${propertyFilter}
    `,

    // 3. Expenses Total
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM(pe.amount), 0) AS total_expenses
      FROM public.property_expenses pe
      JOIN public.properties pr ON pe.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND pe.incurred_on >= ${fromStr}::date
        AND pe.incurred_on <= ${toStr}::date
        ${propertyFilter}
    `,

    // 4. Monthly Series - Income Received
    prisma.$queryRaw`
      SELECT
        to_char(timezone('Asia/Kolkata', p.paid_at), 'YYYY-MM') AS month,
        COALESCE(SUM(ROUND(p.amount * (b.owner_amount / NULLIF(b.total_amount, 0)), 2)), 0) AS income_received
      FROM public.payments p
      JOIN public.bookings b ON p.booking_id = b.id
      JOIN public.spaces s ON b.space_id = s.id
      JOIN public.properties pr ON s.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND p.status = 'PAID'
        AND p.paid_at >= ${rangeStart}
        AND p.paid_at <= ${rangeEnd}
        ${propertyFilter}
      GROUP BY 1
      ORDER BY 1 ASC
    `,

    // 5. Monthly Series - Expenses
    prisma.$queryRaw`
      SELECT
        to_char(pe.incurred_on, 'YYYY-MM') AS month,
        COALESCE(SUM(pe.amount), 0) AS expenses
      FROM public.property_expenses pe
      JOIN public.properties pr ON pe.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND pe.incurred_on >= ${fromStr}::date
        AND pe.incurred_on <= ${toStr}::date
        ${propertyFilter}
      GROUP BY 1
      ORDER BY 1 ASC
    `,

    // 6. Booking Counts by status & this period count
    prisma.$queryRaw`
      SELECT
        b.status,
        COUNT(*) AS count,
        COUNT(*) FILTER (WHERE b.start_at >= ${rangeStart} AND b.start_at <= ${rangeEnd}) AS in_period_count
      FROM public.bookings b
      JOIN public.spaces s ON b.space_id = s.id
      JOIN public.properties pr ON s.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        ${propertyFilter}
      GROUP BY b.status
    `,

    // 7. Occupancy Stats
    prisma.$queryRaw`
      WITH space_stats AS (
        SELECT
          COUNT(*) FILTER (WHERE s.status = 'AVAILABLE') AS available_spaces
        FROM public.spaces s
        JOIN public.properties pr ON s.property_id = pr.id
        WHERE pr.owner_id = ${targetOwnerId}::uuid
          ${propertyFilter}
      ),
      booking_hours AS (
        SELECT
          COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_at, ${rangeEnd}) - GREATEST(b.start_at, ${rangeStart}))) / 3600.0), 0) AS booked_hours
        FROM public.bookings b
        JOIN public.spaces s ON b.space_id = s.id
        JOIN public.properties pr ON s.property_id = pr.id
        WHERE pr.owner_id = ${targetOwnerId}::uuid
          AND b.status IN ('CONFIRMED', 'COMPLETED')
          AND b.start_at < ${rangeEnd}
          AND b.end_at > ${rangeStart}
          ${propertyFilter}
      )
      SELECT
        (SELECT available_spaces FROM space_stats) AS available_spaces,
        (SELECT booked_hours FROM booking_hours) AS booked_hours
    `,

    // 8. Top 5 Spaces
    prisma.$queryRaw`
      SELECT
        s.id AS "spaceId",
        s.name AS "spaceName",
        pr.title AS "propertyTitle",
        COALESCE(SUM(ROUND(p.amount * (b.owner_amount / NULLIF(b.total_amount, 0)), 2)), 0) AS "incomeReceived",
        COUNT(DISTINCT b.id) AS "bookingCount"
      FROM public.spaces s
      JOIN public.properties pr ON s.property_id = pr.id
      LEFT JOIN public.bookings b ON s.id = b.space_id
      LEFT JOIN public.payments p ON b.id = p.booking_id AND p.status = 'PAID' AND p.paid_at >= ${rangeStart} AND p.paid_at <= ${rangeEnd}
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        ${propertyFilter}
      GROUP BY s.id, s.name, pr.title
      ORDER BY "incomeReceived" DESC, "bookingCount" DESC
      LIMIT 5
    `,

    // 9. Maintenance stats
    prisma.$queryRaw`
      SELECT
        m.status,
        COUNT(*) AS count,
        COUNT(*) FILTER (WHERE m.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS') AND m.priority IN ('URGENT', 'HIGH')) AS urgent_high_open,
        COALESCE(SUM(m.actual_cost) FILTER (WHERE m.status = 'COMPLETED' AND m.completed_at >= ${rangeStart} AND m.completed_at <= ${rangeEnd}), 0) AS total_actual_cost
      FROM public.maintenance_requests m
      JOIN public.properties pr ON m.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        ${propertyFilter}
      GROUP BY m.status
    `,

    // 10. Upcoming confirmed bookings
    prisma.bookings.findMany({
      where: {
        status: 'CONFIRMED',
        start_at: { gte: new Date() },
        spaces: {
          properties: {
            owner_id: targetOwnerId,
            ...(property ? { id: property.id } : {}),
          },
        },
      },
      select: {
        id: true,
        start_at: true,
        end_at: true,
        spaces: {
          select: {
            name: true,
            properties: { select: { title: true } },
          },
        },
        profiles: { select: { name: true } },
      },
      orderBy: { start_at: 'asc' },
      take: 5,
    }),

    // 11. Upcoming inspections
    prisma.inspections.findMany({
      where: {
        status: 'SCHEDULED',
        scheduled_at: { gte: new Date() },
        properties: {
          owner_id: targetOwnerId,
          ...(property ? { id: property.id } : {}),
        },
      },
      select: {
        id: true,
        scheduled_at: true,
        properties: { select: { title: true } },
      },
      orderBy: { scheduled_at: 'asc' },
      take: 5,
    }),

    // 12. Upcoming maintenance jobs
    prisma.maintenance_requests.findMany({
      where: {
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
        scheduled_at: { gte: new Date() },
        properties: {
          owner_id: targetOwnerId,
          ...(property ? { id: property.id } : {}),
        },
      },
      select: {
        id: true,
        scheduled_at: true,
        title: true,
        priority: true,
        properties: { select: { title: true } },
      },
      orderBy: { scheduled_at: 'asc' },
      take: 5,
    }),

    // 13. Recent booking status history
    prisma.booking_status_history.findMany({
      where: {
        bookings: {
          spaces: {
            properties: {
              owner_id: targetOwnerId,
              ...(property ? { id: property.id } : {}),
            },
          },
        },
      },
      select: {
        status: true,
        changed_at: true,
        bookings: {
          select: {
            spaces: {
              select: {
                name: true,
                properties: { select: { title: true } },
              },
            },
          },
        },
      },
      orderBy: { changed_at: 'desc' },
      take: 10,
    }),

    // 14. Recent payments
    prisma.payments.findMany({
      where: {
        status: 'PAID',
        bookings: {
          spaces: {
            properties: {
              owner_id: targetOwnerId,
              ...(property ? { id: property.id } : {}),
            },
          },
        },
      },
      select: {
        amount: true,
        paid_at: true,
        transaction_reference: true,
        bookings: {
          select: {
            spaces: {
              select: {
                name: true,
                properties: { select: { title: true } },
              },
            },
          },
        },
      },
      orderBy: { paid_at: 'desc' },
      take: 10,
    }),

    // 15. Recent maintenance updates
    prisma.maintenance_updates.findMany({
      where: {
        maintenance_requests: {
          properties: {
            owner_id: targetOwnerId,
            ...(property ? { id: property.id } : {}),
          },
        },
      },
      select: {
        note: true,
        created_at: true,
        maintenance_requests: {
          select: {
            title: true,
            properties: { select: { title: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
  ]);

  // --- Process Financial Totals ---
  const payRow = paymentTotalsRows[0] || {};
  const incomeReceived = new Prisma.Decimal(payRow.income_received || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const grossCollected = new Prisma.Decimal(payRow.gross_collected || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const platformFeesPaid = new Prisma.Decimal(payRow.platform_fees_paid || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const taxCollected = new Prisma.Decimal(payRow.tax_collected || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const refundedAmount = new Prisma.Decimal(payRow.refunded_amount || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const expRow = expenseTotalRows[0] || {};
  const expenses = new Prisma.Decimal(expRow.total_expenses || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const expIncRow = incomeExpectedRows[0] || {};
  const incomeExpected = new Prisma.Decimal(expIncRow.income_expected || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const net = incomeReceived.minus(expenses);
  const roundingDifference = grossCollected.minus(incomeReceived.plus(platformFeesPaid).plus(taxCollected));

  // --- Process Monthly Series ---
  const incomeMap = new Map();
  if (Array.isArray(monthlyIncomeRows)) {
    for (const r of monthlyIncomeRows) {
      if (r && r.month && r.income_received !== undefined && r.income_received !== null) {
        incomeMap.set(r.month, new Prisma.Decimal(r.income_received));
      }
    }
  }

  const expenseMap = new Map();
  if (Array.isArray(monthlyExpenseRows)) {
    for (const r of monthlyExpenseRows) {
      if (r && r.month && r.expenses !== undefined && r.expenses !== null) {
        expenseMap.set(r.month, new Prisma.Decimal(r.expenses));
      }
    }
  }

  const series = months.map((m) => {
    const inc = incomeMap.get(m) || new Prisma.Decimal(0);
    const exp = expenseMap.get(m) || new Prisma.Decimal(0);
    const mNet = inc.minus(exp);
    return {
      month: m,
      incomeReceived: inc.toFixed(2),
      expenses: exp.toFixed(2),
      net: mNet.toFixed(2),
    };
  });

  // --- Process Booking Counts ---
  const bookingCounts = {
    PENDING: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
    REJECTED: 0,
  };
  let bookingsThisPeriod = 0;

  if (Array.isArray(bookingCountsRows)) {
    for (const r of bookingCountsRows) {
      const st = r.status;
      if (bookingCounts[st] !== undefined) {
        bookingCounts[st] = Number(r.count);
      }
      bookingsThisPeriod += Number(r.in_period_count || 0);
    }
  }

  // --- Process Occupancy ---
  const occRow = occupancyRows[0] || {};
  const availableSpaces = Number(occRow.available_spaces || 0);
  const bookedHours = Number(occRow.booked_hours || 0);

  let occupancy = null;
  if (availableSpaces > 0) {
    const totalAvailableHours = 24 * daysInRange * availableSpaces;
    const rawOccupancy = (bookedHours / totalAvailableHours) * 100;
    const capped = Math.min(100, Math.max(0, rawOccupancy));
    occupancy = Number(new Prisma.Decimal(capped).toFixed(1));
  }

  // --- Process Top Spaces ---
  const topSpaces = Array.isArray(topSpacesRows)
    ? topSpacesRows.map((r) => ({
      spaceId: r.spaceId,
      spaceName: r.spaceName,
      propertyTitle: r.propertyTitle,
      incomeReceived: new Prisma.Decimal(r.incomeReceived || 0).toFixed(2),
      bookingCount: Number(r.bookingCount || 0),
    }))
    : [];

  // --- Process Maintenance ---
  const maintCounts = {
    OPEN: 0,
    ASSIGNED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  let urgentHighOpenCount = 0;
  let totalActualCost = new Prisma.Decimal(0);

  if (Array.isArray(maintenanceRows)) {
    for (const r of maintenanceRows) {
      const st = r.status;
      if (maintCounts[st] !== undefined) {
        maintCounts[st] = Number(r.count);
      }
      urgentHighOpenCount += Number(r.urgent_high_open || 0);
      if (r.total_actual_cost) {
        totalActualCost = totalActualCost.plus(new Prisma.Decimal(r.total_actual_cost));
      }
    }
  }

  // --- Process Health ---
  let healthSummary = {
    properties: [],
    overdueProperties: 0,
  };

  if (property) {
    const singleHealth = await getPropertyHealth(property.id, user);
    const isOverdue = !singleHealth.inspectedAt || Date.now() - new Date(singleHealth.inspectedAt).getTime() > 90 * 86400000;
    healthSummary = {
      properties: [
        {
          propertyId: property.id,
          title: property.title,
          score: singleHealth.score ? new Prisma.Decimal(singleHealth.score).toFixed(2) : null,
          grade: singleHealth.grade ?? null,
          trend: singleHealth.trend ?? null,
          overdue: isOverdue,
        },
      ],
      overdueProperties: isOverdue ? 1 : 0,
    };
  } else {
    const healthOverview = await getOwnerHealthOverview(targetOwnerId);
    healthSummary = {
      properties: healthOverview.map((h) => ({
        propertyId: h.id,
        title: h.title,
        score: h.latestScore ? new Prisma.Decimal(h.latestScore).toFixed(2) : null,
        grade: h.grade ?? null,
        trend: h.trend ?? null,
        overdue: h.overdue,
      })),
      overdueProperties: healthOverview.filter((h) => h.overdue).length,
    };
  }

  // --- Process Upcoming ---
  const upcoming = {
    nextBookings: upcomingBookings.map((b) => {
      const fullName = b.profiles?.name || 'Guest';
      const firstName = fullName.trim().split(/\s+/)[0];
      return {
        id: b.id,
        startAt: b.start_at,
        endAt: b.end_at,
        spaceName: b.spaces?.name,
        propertyTitle: b.spaces?.properties?.title,
        customerFirstName: firstName,
      };
    }),
    nextInspections: upcomingInspections.map((i) => ({
      id: i.id,
      scheduledAt: i.scheduled_at,
      propertyTitle: i.properties?.title,
    })),
    nextMaintenance: upcomingMaintenance.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduled_at,
      title: m.title,
      priority: m.priority,
      propertyTitle: m.properties?.title,
    })),
  };

  // --- Process Recent Activity (Combine, Sort, Redact Personal Data) ---
  const activityItems = [];

  for (const h of recentBookingHistory) {
    const space = h.bookings?.spaces?.name || 'Space';
    activityItems.push({
      type: 'BOOKING',
      text: `Booking ${h.status.toLowerCase()} for ${space}`,
      time: h.changed_at,
    });
  }

  for (const p of recentPayments) {
    const space = p.bookings?.spaces?.name || 'Booking';
    const formattedAmt = new Prisma.Decimal(p.amount).toFixed(2);
    activityItems.push({
      type: 'PAYMENT',
      text: `Payment of ₹${formattedAmt} received for ${space}`,
      time: p.paid_at,
    });
  }

  for (const u of recentUpdates) {
    const jobTitle = u.maintenance_requests?.title || 'Maintenance job';
    const cleanNote = sanitizeText(u.note);
    activityItems.push({
      type: 'MAINTENANCE',
      text: `${jobTitle}: ${cleanNote}`,
      time: u.created_at,
    });
  }

  activityItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const recentActivity = activityItems.slice(0, 10);

  return {
    range: {
      from: fromStr,
      to: toStr,
    },
    totals: {
      incomeReceived: incomeReceived.toFixed(2),
      incomeExpected: incomeExpected.toFixed(2),
      expenses: expenses.toFixed(2),
      net: net.toFixed(2),
      grossCollected: grossCollected.toFixed(2),
      platformFeesPaid: platformFeesPaid.toFixed(2),
      taxCollected: taxCollected.toFixed(2),
      refundedAmount: refundedAmount.toFixed(2),
      roundingDifference: roundingDifference.toFixed(2),
    },
    series,
    bookingCounts,
    bookingsThisPeriod,
    occupancy,
    topSpaces,
    maintenance: {
      countsByStatus: maintCounts,
      urgentHighOpenCount,
      totalActualCost: totalActualCost.toFixed(2),
    },
    health: healthSummary,
    upcoming,
    recentActivity,
  };
}

/**
 * Retrieves per-property dashboard table for an owner using ONE single query set.
 * @param {object} user - Authenticated user
 * @param {object} query - Query parameters (from, to, ownerId)
 * @returns {Promise<object[]>} Array of property dashboard rows
 */
export async function getOwnerDashboardProperties(user, query) {
  const { targetOwnerId } = await resolveDashboardScope(user, query.ownerId);
  const { fromStr, toStr, rangeStart, rangeEnd, daysInRange } = resolveDateRange(query.from, query.to);

  // Exactly ONE set of grouped queries (fixed count, independent of number of properties)
  const [
    properties,
    incomeRows,
    expenseRows,
    bookingStatsRows,
    spaceStatsRows,
    healthOverview,
  ] = await Promise.all([
    // 1. Properties
    prisma.properties.findMany({
      where: { owner_id: targetOwnerId },
      select: {
        id: true,
        title: true,
        address_line1: true,
        city: true,
      },
      orderBy: { created_at: 'desc' },
    }),

    // 2. Income by property
    prisma.$queryRaw`
      SELECT
        pr.id AS property_id,
        COALESCE(SUM(ROUND(p.amount * (b.owner_amount / NULLIF(b.total_amount, 0)), 2)), 0) AS income_received
      FROM public.properties pr
      JOIN public.spaces s ON pr.id = s.property_id
      JOIN public.bookings b ON s.id = b.space_id
      JOIN public.payments p ON b.id = p.booking_id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND p.status = 'PAID'
        AND p.paid_at >= ${rangeStart}
        AND p.paid_at <= ${rangeEnd}
      GROUP BY pr.id
    `,

    // 3. Expenses by property
    prisma.$queryRaw`
      SELECT
        pe.property_id,
        COALESCE(SUM(pe.amount), 0) AS expenses
      FROM public.property_expenses pe
      JOIN public.properties pr ON pe.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND pe.incurred_on >= ${fromStr}::date
        AND pe.incurred_on <= ${toStr}::date
      GROUP BY pe.property_id
    `,

    // 4. Bookings and Booked Hours by property
    prisma.$queryRaw`
      SELECT
        pr.id AS property_id,
        COUNT(DISTINCT b.id) AS booking_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (LEAST(b.end_at, ${rangeEnd}) - GREATEST(b.start_at, ${rangeStart}))) / 3600.0), 0) AS booked_hours
      FROM public.properties pr
      JOIN public.spaces s ON pr.id = s.property_id
      JOIN public.bookings b ON s.id = b.space_id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND b.status IN ('CONFIRMED', 'COMPLETED')
        AND b.start_at < ${rangeEnd}
        AND b.end_at > ${rangeStart}
      GROUP BY pr.id
    `,

    // 5. Available spaces by property
    prisma.$queryRaw`
      SELECT
        s.property_id,
        COUNT(*) AS available_spaces
      FROM public.spaces s
      JOIN public.properties pr ON s.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND s.status = 'AVAILABLE'
      GROUP BY s.property_id
    `,

    // 6. Health overview
    getOwnerHealthOverview(targetOwnerId),
  ]);

  // Index stats into Maps for O(1) row assembly
  const incomeMap = new Map();
  if (Array.isArray(incomeRows)) {
    for (const r of incomeRows) incomeMap.set(r.property_id, new Prisma.Decimal(r.income_received));
  }

  const expenseMap = new Map();
  if (Array.isArray(expenseRows)) {
    for (const r of expenseRows) expenseMap.set(r.property_id, new Prisma.Decimal(r.expenses));
  }

  const bookingStatsMap = new Map();
  if (Array.isArray(bookingStatsRows)) {
    for (const r of bookingStatsRows) {
      bookingStatsMap.set(r.property_id, {
        bookingCount: Number(r.booking_count),
        bookedHours: Number(r.booked_hours),
      });
    }
  }

  const spaceStatsMap = new Map();
  if (Array.isArray(spaceStatsRows)) {
    for (const r of spaceStatsRows) spaceStatsMap.set(r.property_id, Number(r.available_spaces));
  }

  const healthMap = new Map();
  if (Array.isArray(healthOverview)) {
    for (const h of healthOverview) healthMap.set(h.id, h);
  }

  return properties.map((p) => {
    const inc = incomeMap.get(p.id) || new Prisma.Decimal(0);
    const exp = expenseMap.get(p.id) || new Prisma.Decimal(0);
    const pNet = inc.minus(exp);

    const bStats = bookingStatsMap.get(p.id) || { bookingCount: 0, bookedHours: 0 };
    const availSpaces = spaceStatsMap.get(p.id) || 0;

    let occupancy = null;
    if (availSpaces > 0) {
      const totalAvailHours = 24 * daysInRange * availSpaces;
      const rawOcc = (bStats.bookedHours / totalAvailHours) * 100;
      const capped = Math.min(100, Math.max(0, rawOcc));
      occupancy = Number(new Prisma.Decimal(capped).toFixed(1));
    }

    const health = healthMap.get(p.id);

    return {
      propertyId: p.id,
      title: p.title,
      addressLine1: p.address_line1,
      city: p.city,
      incomeReceived: inc.toFixed(2),
      expenses: exp.toFixed(2),
      net: pNet.toFixed(2),
      occupancy,
      bookingCount: bStats.bookingCount,
      healthScore: health?.latestScore ? new Prisma.Decimal(health.latestScore).toFixed(2) : null,
      healthGrade: health?.grade ?? null,
      healthTrend: health?.trend ?? null,
      overdue: health?.overdue ?? true,
    };
  });
}

/**
 * Reconciles totals against raw underlying lists of payments and expenses.
 * @param {object} user - Authenticated user
 * @param {object} query - Query parameters (from, to, propertyId, ownerId, page, limit)
 * @returns {Promise<object>} Reconcile data with raw lists and totals
 */
export async function getOwnerDashboardReconcile(user, query) {
  const { targetOwnerId, property } = await resolveDashboardScope(user, query.ownerId, query.propertyId);
  const { fromStr, toStr, rangeStart, rangeEnd } = resolveDateRange(query.from, query.to);

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(200, Math.max(1, query.limit || 100));
  const skip = (page - 1) * limit;

  const propertyFilter = property
    ? Prisma.sql`AND pr.id = ${property.id}::uuid`
    : Prisma.empty;

  const [
    totalsDashboard,
    paymentsCountRow,
    expensesCountRow,
    rawPayments,
    rawExpenses,
  ] = await Promise.all([
    // Recompute totals for this exact range
    getOwnerDashboard(user, { from: fromStr, to: toStr, propertyId: property?.id, ownerId: targetOwnerId }),

    // Count payments
    prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM public.payments p
      JOIN public.bookings b ON p.booking_id = b.id
      JOIN public.spaces s ON b.space_id = s.id
      JOIN public.properties pr ON s.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND p.status = 'PAID'
        AND p.paid_at >= ${rangeStart}
        AND p.paid_at <= ${rangeEnd}
        ${propertyFilter}
    `,

    // Count expenses
    prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM public.property_expenses pe
      JOIN public.properties pr ON pe.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND pe.incurred_on >= ${fromStr}::date
        AND pe.incurred_on <= ${toStr}::date
        ${propertyFilter}
    `,

    // Raw payments list
    prisma.$queryRaw`
      SELECT
        p.id,
        p.booking_id AS "bookingId",
        p.paid_at AS "paidAt",
        p.amount,
        ROUND(p.amount * (b.owner_amount / NULLIF(b.total_amount, 0)), 2) AS "ownerShare",
        ROUND(p.amount * (b.platform_fee / NULLIF(b.total_amount, 0)), 2) AS "platformFeeShare",
        ROUND(p.amount * (b.tax_amount / NULLIF(b.total_amount, 0)), 2) AS "taxShare"
      FROM public.payments p
      JOIN public.bookings b ON p.booking_id = b.id
      JOIN public.spaces s ON b.space_id = s.id
      JOIN public.properties pr ON s.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND p.status = 'PAID'
        AND p.paid_at >= ${rangeStart}
        AND p.paid_at <= ${rangeEnd}
        ${propertyFilter}
      ORDER BY p.paid_at DESC
      OFFSET ${skip}
      LIMIT ${limit}
    `,

    // Raw expenses list
    prisma.$queryRaw`
      SELECT
        pe.id,
        pe.property_id AS "propertyId",
        pe.incurred_on AS "incurredOn",
        pe.category,
        pe.amount,
        pe.description
      FROM public.property_expenses pe
      JOIN public.properties pr ON pe.property_id = pr.id
      WHERE pr.owner_id = ${targetOwnerId}::uuid
        AND pe.incurred_on >= ${fromStr}::date
        AND pe.incurred_on <= ${toStr}::date
        ${propertyFilter}
      ORDER BY pe.incurred_on DESC
      OFFSET ${skip}
      LIMIT ${limit}
    `,
  ]);

  const totalPayments = Number(paymentsCountRow[0]?.total || 0);
  const totalExpenses = Number(expensesCountRow[0]?.total || 0);

  const formattedPayments = Array.isArray(rawPayments)
    ? rawPayments.map((p) => ({
      id: p.id,
      bookingId: p.bookingId,
      paidAt: p.paidAt,
      amount: new Prisma.Decimal(p.amount).toFixed(2),
      ownerShare: new Prisma.Decimal(p.ownerShare || 0).toFixed(2),
      platformFeeShare: new Prisma.Decimal(p.platformFeeShare || 0).toFixed(2),
      taxShare: new Prisma.Decimal(p.taxShare || 0).toFixed(2),
    }))
    : [];

  const formattedExpenses = Array.isArray(rawExpenses)
    ? rawExpenses.map((e) => ({
      id: e.id,
      propertyId: e.propertyId,
      incurredOn: e.incurredOn instanceof Date ? e.incurredOn.toISOString().slice(0, 10) : String(e.incurredOn).slice(0, 10),
      category: e.category,
      amount: new Prisma.Decimal(e.amount).toFixed(2),
      description: e.description,
    }))
    : [];

  return {
    totals: totalsDashboard.totals,
    payments: formattedPayments,
    expenses: formattedExpenses,
    meta: {
      page,
      limit,
      totalPayments,
      totalExpenses,
      totalPagesPayments: Math.ceil(totalPayments / limit),
      totalPagesExpenses: Math.ceil(totalExpenses / limit),
    },
  };
}

/**
 * Retrieves platform-wide statistics for ADMIN dashboard with zero personal data.
 * @param {object} user - Authenticated admin
 * @param {object} query - Optional from/to
 * @returns {Promise<object>} Platform statistics
 */
export async function getAdminDashboard(user, query = {}) {
  if (user.role !== 'ADMIN') {
    throw AppError.forbidden('Admin access required');
  }

  const { rangeStart, rangeEnd } = resolveDateRange(query.from, query.to);

  const [
    volumeRows,
    bookingsByStatusRows,
    usersByRoleRows,
    activePropertiesCount,
    pendingVerificationsCount,
    openMaintenanceCount,
  ] = await Promise.all([
    // Platform volume & fees
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM(p.amount), 0) AS gross_volume,
        COALESCE(SUM(ROUND(p.amount * (b.platform_fee / NULLIF(b.total_amount, 0)), 2)), 0) AS platform_fees_earned
      FROM public.payments p
      JOIN public.bookings b ON p.booking_id = b.id
      WHERE p.status = 'PAID'
        AND p.paid_at >= ${rangeStart}
        AND p.paid_at <= ${rangeEnd}
    `,

    // Bookings count by status
    prisma.bookings.groupBy({
      by: ['status'],
      _count: { id: true },
    }),

    // Users by role
    prisma.profiles.groupBy({
      by: ['role'],
      _count: { id: true },
    }),

    // Active properties
    prisma.properties.count({
      where: { status: 'ACTIVE' },
    }),

    // Pending provider verifications
    prisma.service_providers.count({
      where: { verification_status: 'PENDING' },
    }),

    // Open maintenance requests
    prisma.maintenance_requests.count({
      where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
    }),
  ]);

  const vRow = volumeRows[0] || {};
  const grossVolume = new Prisma.Decimal(vRow.gross_volume || 0).toFixed(2);
  const platformFeesEarned = new Prisma.Decimal(vRow.platform_fees_earned || 0).toFixed(2);

  const bookingsByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
    REJECTED: 0,
  };
  for (const b of bookingsByStatusRows) {
    if (bookingsByStatus[b.status] !== undefined) {
      bookingsByStatus[b.status] = b._count.id;
    }
  }

  const usersByRole = {
    CUSTOMER: 0,
    OWNER: 0,
    PROVIDER: 0,
    ADMIN: 0,
  };
  for (const u of usersByRoleRows) {
    if (usersByRole[u.role] !== undefined) {
      usersByRole[u.role] = u._count.id;
    }
  }

  return {
    grossVolume,
    platformFeesEarned,
    bookingsByStatus,
    usersByRole,
    activeProperties: activePropertiesCount,
    pendingProviderVerifications: pendingVerificationsCount,
    openMaintenance: openMaintenanceCount,
  };
}
