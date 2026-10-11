import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';

/**
 * Valid condition point values.
 * Database CHECK constraint aligns with: EXCELLENT, GOOD, FAIR, POOR, CRITICAL.
 */
export const CONDITION_POINTS = {
  EXCELLENT: 100,
  GOOD: 80,
  FAIR: 60,
  POOR: 30,
  CRITICAL: 0,
};

/**
 * @typedef {Object} InspectionItemInput
 * @property {string} [id] - Item UUID
 * @property {string} [item_name] - Item title from DB
 * @property {string} [itemName] - Item title from payload
 * @property {string} category - Inspection item category (e.g. Structure, Plumbing)
 * @property {'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL'} condition - Physical condition
 * @property {string} [notes] - Additional notes
 */

/**
 * @typedef {Object} CategoryScore
 * @property {string} category - Category name
 * @property {import('@prisma/client').Prisma.Decimal} score - Average score for category
 * @property {number} itemCount - Total items evaluated in this category
 */

/**
 * @typedef {Object} InspectionScoreResult
 * @property {import('@prisma/client').Prisma.Decimal | null} overallScore - Calculated overall score (null if no items)
 * @property {'A' | 'B' | 'C' | 'D' | 'F' | null} grade - Letter grade based on overall score
 * @property {CategoryScore[]} categories - Breakdown of scores per category
 * @property {Record<string, number>} conditionCounts - Count of items in each condition
 * @property {Array<{ id?: string, itemName: string, category: string, condition: string, notes?: string | null }>} worstItems - Up to 5 items in POOR or CRITICAL, worst first
 */

/**
 * Assigns a letter grade based on a numeric or Decimal score:
 * - 90+ : A
 * - 75 - 89.99 : B
 * - 60 - 74.99 : C
 * - 40 - 59.99 : D
 * - Below 40 : F
 * @param {import('@prisma/client').Prisma.Decimal | number | null | undefined} score - Numeric score
 * @returns {'A' | 'B' | 'C' | 'D' | 'F' | null} Letter grade or null if score is null/undefined
 */
export function calculateGrade(score) {
  if (score === null || score === undefined) {
    return null;
  }
  const num = typeof score === 'number' ? score : Number(score);
  if (num >= 90) return 'A';
  if (num >= 75) return 'B';
  if (num >= 60) return 'C';
  if (num >= 40) return 'D';
  return 'F';
}

/**
 * Determines trend between current and previous scores:
 * - 'UP': Current score is higher than previous
 * - 'DOWN': Current score is lower than previous
 * - 'SAME': Current and previous scores are identical
 * - null: Fewer than two completed scores
 * @param {import('@prisma/client').Prisma.Decimal | number | null | undefined} currentScore - Latest score
 * @param {import('@prisma/client').Prisma.Decimal | number | null | undefined} previousScore - Prior score
 * @returns {'UP' | 'DOWN' | 'SAME' | null}
 */
export function calculateTrend(currentScore, previousScore) {
  if (
    currentScore === null ||
    currentScore === undefined ||
    previousScore === null ||
    previousScore === undefined
  ) {
    return null;
  }
  const curr = typeof currentScore === 'number' ? currentScore : Number(currentScore);
  const prev = typeof previousScore === 'number' ? previousScore : Number(previousScore);
  if (curr > prev) return 'UP';
  if (curr < prev) return 'DOWN';
  return 'SAME';
}

/**
 * Calculates deterministic inspection score, grade, category breakdown, condition counts, and worst items.
 * Uses Prisma.Decimal exclusively with ROUND_HALF_UP to 2 decimal places.
 * If items array is empty, overallScore and grade are null.
 * @param {InspectionItemInput[]} items - Evaluated inspection items
 * @returns {InspectionScoreResult}
 */
export function calculateInspectionScore(items) {
  if (!items || items.length === 0) {
    return {
      overallScore: null,
      grade: null,
      categories: [],
      conditionCounts: {
        EXCELLENT: 0,
        GOOD: 0,
        FAIR: 0,
        POOR: 0,
        CRITICAL: 0,
      },
      worstItems: [],
    };
  }

  const conditionCounts = {
    EXCELLENT: 0,
    GOOD: 0,
    FAIR: 0,
    POOR: 0,
    CRITICAL: 0,
  };

  let totalPoints = new Prisma.Decimal(0);
  const categoryMap = new Map();

  for (const item of items) {
    const condition = item.condition;
    const points = CONDITION_POINTS[condition];
    if (points === undefined) {
      throw AppError.badRequest(`Unknown condition value: ${condition}`);
    }

    conditionCounts[condition] += 1;
    totalPoints = totalPoints.add(points);

    const categoryName = item.category;
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, {
        totalPoints: new Prisma.Decimal(0),
        itemCount: 0,
      });
    }
    const catEntry = categoryMap.get(categoryName);
    catEntry.totalPoints = catEntry.totalPoints.add(points);
    catEntry.itemCount += 1;
  }

  // Overall score: average of all items' points (equal weight), ROUND_HALF_UP to 2 decimals
  const overallScore = totalPoints
    .div(items.length)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const grade = calculateGrade(overallScore);

  // Category scores
  const categories = [];
  for (const [category, entry] of categoryMap.entries()) {
    const score = entry.totalPoints
      .div(entry.itemCount)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    categories.push({
      category,
      score,
      itemCount: entry.itemCount,
    });
  }

  // Worst items: up to 5 items in POOR or CRITICAL, worst first (CRITICAL first, then POOR)
  const conditionRank = { CRITICAL: 1, POOR: 2 };
  const worstItems = items
    .filter((item) => item.condition === 'CRITICAL' || item.condition === 'POOR')
    .sort((a, b) => conditionRank[a.condition] - conditionRank[b.condition])
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      itemName: item.item_name ?? item.itemName ?? 'Unknown Item',
      category: item.category,
      condition: item.condition,
      notes: item.notes ?? null,
    }));

  return {
    overallScore,
    grade,
    categories,
    conditionCounts,
    worstItems,
  };
}
