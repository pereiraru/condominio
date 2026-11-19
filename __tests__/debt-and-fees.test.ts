import {
  getFeeForMonth,
  getExtraChargesForMonth,
  getTotalFeeForMonth,
  FeeHistoryRecord,
  ExtraChargeRecord,
} from '@/lib/feeHistory';
import { isMonthInOwnerPeriod, getOwnerForMonth } from '@/lib/ownerPeriod';

describe('FeeHistory and ExtraCharge calculations', () => {
  const standardUnitFees: FeeHistoryRecord[] = [
    { amount: 37.5, effectiveFrom: '2024-01', effectiveTo: '2024-05' },
    { amount: 45.0, effectiveFrom: '2024-06', effectiveTo: null },
  ];

  const rcdFees: FeeHistoryRecord[] = [
    { amount: 17.5, effectiveFrom: '2024-01', effectiveTo: '2024-04' },
    { amount: 20.0, effectiveFrom: '2024-05', effectiveTo: null },
  ];

  const otisFees: FeeHistoryRecord[] = [
    { amount: 218.92, effectiveFrom: '2024-01', effectiveTo: '2025-10' },
    { amount: 110.68, effectiveFrom: '2025-11', effectiveTo: '2026-10' },
    { amount: 118.42, effectiveFrom: '2026-11', effectiveTo: null },
  ];

  it('returns correct fees across transitions for standard unit and RCD', () => {
    expect(getFeeForMonth(standardUnitFees, '2024-01', 45)).toBe(37.5);
    expect(getFeeForMonth(standardUnitFees, '2024-05', 45)).toBe(37.5);
    expect(getFeeForMonth(standardUnitFees, '2024-06', 45)).toBe(45.0);
    expect(getFeeForMonth(standardUnitFees, '2026-11', 45)).toBe(45.0);

    expect(getFeeForMonth(rcdFees, '2024-04', 20)).toBe(17.5);
    expect(getFeeForMonth(rcdFees, '2024-05', 20)).toBe(20.0);
  });

  it('returns correct fees for Otis contract transitions', () => {
    expect(getFeeForMonth(otisFees, '2025-10', 118.42)).toBe(218.92);
    expect(getFeeForMonth(otisFees, '2025-11', 118.42)).toBe(110.68);
    expect(getFeeForMonth(otisFees, '2026-10', 118.42)).toBe(110.68);
    expect(getFeeForMonth(otisFees, '2026-11', 118.42)).toBe(118.42);
  });

  it('includes global and unit-specific extra charges properly', () => {
    const extras: ExtraChargeRecord[] = [
      { id: 'ex-global', description: 'Obra telhado', amount: 25, effectiveFrom: '2026-03', effectiveTo: '2026-05', unitId: null },
      { id: 'ex-unit', description: 'Chave garagem', amount: 15, effectiveFrom: '2026-04', effectiveTo: '2026-04', unitId: 'u1' },
    ];
    expect(getExtraChargesForMonth(extras, '2026-04', 'u1')).toHaveLength(2);
    expect(getExtraChargesForMonth(extras, '2026-04', 'u2')).toHaveLength(1);
    expect(getTotalFeeForMonth(standardUnitFees, extras, '2026-04', 45, 'u1').total).toBe(85);
    expect(getTotalFeeForMonth(standardUnitFees, extras, '2026-04', 45, 'u2').total).toBe(70);
  });
});

describe('Owner period boundaries', () => {
  const owners2E = [
    { id: 'o1', name: 'Cesar', startMonth: '2024-01', endMonth: '2025-02' },
    { id: 'o2', name: 'Nuno', startMonth: '2025-03', endMonth: null },
  ];

  it('matches months strictly inside owner tenure', () => {
    expect(isMonthInOwnerPeriod('2025-02', '2024-01', '2025-02')).toBe(true);
    expect(isMonthInOwnerPeriod('2025-03', '2024-01', '2025-02')).toBe(false);
    expect(isMonthInOwnerPeriod('2025-03', '2025-03', null)).toBe(true);
    expect(getOwnerForMonth(owners2E, '2025-02')?.name).toBe('Cesar');
    expect(getOwnerForMonth(owners2E, '2025-03')?.name).toBe('Nuno');
  });
});

describe('YTD debt and surplus carry-forward scenarios', () => {
  function computeYtdDebt(expectedMonths: number[], paidMonths: number[]): number {
    const expected = expectedMonths.reduce((a, b) => a + b, 0);
    const paid = paidMonths.reduce((a, b) => a + b, 0);
    return Math.round(Math.max(0, expected - paid) * 100) / 100;
  }

  it('computes 2E 2026 YTD debt (Jan-Nov, 4 months paid = 315.00 EUR owed)', () => {
    const expected2026 = Array(11).fill(45);
    const paid2026 = [45, 45, 45, 45, 0, 0, 0, 0, 0, 0, 0];
    expect(computeYtdDebt(expected2026, paid2026)).toBe(315);
  });

  it('computes 6D 2026 YTD debt (228.25 EUR paid across Jan-Jun = 266.75 EUR owed)', () => {
    const expected2026 = Array(11).fill(45);
    const paid2026 = [45, 45, 45, 45, 45, 3.25, 0, 0, 0, 0, 0];
    expect(computeYtdDebt(expected2026, paid2026)).toBe(266.75);
  });

  it('carries surplus from past years to offset previousDebt', () => {
    const previousDebt = 1000;
    const previousDebtPaid = 0;
    const netPastDiff = -115; // e.g. 115 EUR surplus across 2024-2025
    const adjusted = Math.max(0, previousDebt - previousDebtPaid + netPastDiff);
    expect(adjusted).toBe(885);
  });
});
