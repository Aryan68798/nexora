import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  calculateInspectionScore,
  calculateGrade,
  calculateTrend,
  CONDITION_POINTS,
} from '../src/services/healthScore.service.js';

describe('Health Score Service — Unit Tests', () => {
  it('maps each condition to the exact expected points', () => {
    expect(CONDITION_POINTS.EXCELLENT).toBe(100);
    expect(CONDITION_POINTS.GOOD).toBe(80);
    expect(CONDITION_POINTS.FAIR).toBe(60);
    expect(CONDITION_POINTS.POOR).toBe(30);
    expect(CONDITION_POINTS.CRITICAL).toBe(0);
  });

  it('calculates overall score as the exact equal-weight average of all items', () => {
    const items = [
      { itemName: 'Roof', category: 'Structure', condition: 'EXCELLENT' }, // 100
      { itemName: 'Walls', category: 'Structure', condition: 'GOOD' }, // 80
      { itemName: 'Pipes', category: 'Plumbing', condition: 'FAIR' }, // 60
      { itemName: 'Heater', category: 'Plumbing', condition: 'POOR' }, // 30
      { itemName: 'Wiring', category: 'Electrical', condition: 'CRITICAL' }, // 0
    ];
    // Sum = 100 + 80 + 60 + 30 + 0 = 270 / 5 = 54.00
    const result = calculateInspectionScore(items);
    expect(result.overallScore.toString()).toBe('54');
    expect(result.grade).toBe('D');
    expect(result.conditionCounts).toEqual({
      EXCELLENT: 1,
      GOOD: 1,
      FAIR: 1,
      POOR: 1,
      CRITICAL: 1,
    });
  });

  it('correctly calculates category breakdown with category averages', () => {
    const items = [
      { itemName: 'Roof', category: 'Structure', condition: 'EXCELLENT' }, // 100
      { itemName: 'Walls', category: 'Structure', condition: 'GOOD' }, // 80
      { itemName: 'Pipes', category: 'Plumbing', condition: 'POOR' }, // 30
      { itemName: 'Drainage', category: 'Plumbing', condition: 'CRITICAL' }, // 0
    ];
    const result = calculateInspectionScore(items);
    // Structure avg: (100 + 80) / 2 = 90.00
    // Plumbing avg: (30 + 0) / 2 = 15.00
    const structCat = result.categories.find((c) => c.category === 'Structure');
    const plumbCat = result.categories.find((c) => c.category === 'Plumbing');

    expect(structCat).toBeDefined();
    expect(structCat.score.toString()).toBe('90');
    expect(structCat.itemCount).toBe(2);

    expect(plumbCat).toBeDefined();
    expect(plumbCat.score.toString()).toBe('15');
    expect(plumbCat.itemCount).toBe(2);
  });

  it('returns null overall score and null grade when items list is empty', () => {
    const result = calculateInspectionScore([]);
    expect(result.overallScore).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.categories).toEqual([]);
    expect(result.worstItems).toEqual([]);
    expect(result.conditionCounts.EXCELLENT).toBe(0);
  });

  it('strictly adheres to exact grade boundaries', () => {
    expect(calculateGrade(100)).toBe('A');
    expect(calculateGrade(90.0)).toBe('A');
    expect(calculateGrade(89.99)).toBe('B');
    expect(calculateGrade(75.0)).toBe('B');
    expect(calculateGrade(74.99)).toBe('C');
    expect(calculateGrade(60.0)).toBe('C');
    expect(calculateGrade(59.99)).toBe('D');
    expect(calculateGrade(40.0)).toBe('D');
    expect(calculateGrade(39.99)).toBe('F');
    expect(calculateGrade(0)).toBe('F');
    expect(calculateGrade(null)).toBeNull();
  });

  it('rounds scores using ROUND_HALF_UP to 2 decimal places', () => {
    // 100 + 80 + 80 = 260 / 3 = 86.66666... -> rounds up to 86.67
    const items = [
      { itemName: 'A', category: 'Test', condition: 'EXCELLENT' },
      { itemName: 'B', category: 'Test', condition: 'GOOD' },
      { itemName: 'C', category: 'Test', condition: 'GOOD' },
    ];
    const result = calculateInspectionScore(items);
    expect(result.overallScore.toString()).toBe('86.67');
    expect(result.grade).toBe('B');

    // 60 + 60 + 30 = 150 / 3 = 50.00
    const items2 = [
      { itemName: 'A', category: 'Test', condition: 'FAIR' },
      { itemName: 'B', category: 'Test', condition: 'FAIR' },
      { itemName: 'C', category: 'Test', condition: 'POOR' },
    ];
    const result2 = calculateInspectionScore(items2);
    expect(result2.overallScore.toString()).toBe('50');
  });

  it('rejects unknown condition values with an error', () => {
    const items = [{ itemName: 'Invalid', category: 'Test', condition: 'UNKNOWN' }];
    expect(() => calculateInspectionScore(items)).toThrow('Unknown condition value: UNKNOWN');
  });

  it('correctly sorts worstItems with CRITICAL first, then POOR, capped at 5 items', () => {
    const items = [
      { id: '1', itemName: 'Good Thing', category: 'General', condition: 'GOOD' },
      { id: '2', itemName: 'Poor Thing 1', category: 'General', condition: 'POOR' },
      { id: '3', itemName: 'Critical Thing 1', category: 'General', condition: 'CRITICAL' },
      { id: '4', itemName: 'Poor Thing 2', category: 'General', condition: 'POOR' },
      { id: '5', itemName: 'Critical Thing 2', category: 'General', condition: 'CRITICAL' },
      { id: '6', itemName: 'Critical Thing 3', category: 'General', condition: 'CRITICAL' },
      { id: '7', itemName: 'Poor Thing 3', category: 'General', condition: 'POOR' },
    ];
    const result = calculateInspectionScore(items);
    expect(result.worstItems).toHaveLength(5);
    // First 3 must be CRITICAL
    expect(result.worstItems[0].condition).toBe('CRITICAL');
    expect(result.worstItems[1].condition).toBe('CRITICAL');
    expect(result.worstItems[2].condition).toBe('CRITICAL');
    // Remaining 2 must be POOR
    expect(result.worstItems[3].condition).toBe('POOR');
    expect(result.worstItems[4].condition).toBe('POOR');
  });

  it('determines trend calculation correctly', () => {
    expect(calculateTrend(85, 80)).toBe('UP');
    expect(calculateTrend(new Prisma.Decimal('75.50'), new Prisma.Decimal('80.00'))).toBe('DOWN');
    expect(calculateTrend(new Prisma.Decimal('90.00'), new Prisma.Decimal('90.00'))).toBe('SAME');
    expect(calculateTrend(90, null)).toBeNull();
    expect(calculateTrend(null, 90)).toBeNull();
    expect(calculateTrend(undefined, 90)).toBeNull();
  });
});
