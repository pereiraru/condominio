import { FeeSimulationConfig, FeeSimulationRow, UnitReportItem } from './types';

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function fmtEur(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function formatUnitLabel(code: string): string {
  const exact: Record<string, string> = {
    RCD: 'R/C Direito',
    RCE: 'R/C Esquerdo',
    CV: 'Cave -2',
    CVD: 'Cave Direito',
    CVE: 'Cave Esquerdo',
    Garagem: 'Cave -1 (Garagem)',
  };
  if (exact[code]) return exact[code];

  const match = code.match(/^(\d+)([DE])$/);
  if (match) {
    return `${match[1]}º ${match[2] === 'D' ? 'Direito' : 'Esquerdo'}`;
  }
  return code;
}

function applyRounding(amount: number, rounding: FeeSimulationConfig['rounding']): number {
  if (rounding === 'integer') return Math.round(amount);
  if (rounding === 'half_euro') return Math.round(amount * 2) / 2;
  return round2(amount);
}

function computeStandardNewFee(
  baseMonthly: number,
  config: FeeSimulationConfig
): number {
  const raw =
    config.mode === 'percentage'
      ? baseMonthly * (1 + config.value / 100)
      : baseMonthly + config.value;
  return applyRounding(raw, config.rounding);
}

export function computeFeeSimulation(
  units: UnitReportItem[],
  config: FeeSimulationConfig
): {
  rows: FeeSimulationRow[];
  totalCurrentMonthly: number;
  totalNewMonthly: number;
  totalCurrentAnnual: number;
  totalNewAnnual: number;
  monthlyImpact: number;
  annualImpact: number;
  overallPercentImpact: number;
} {
  // Reference standard fee (first non-RCD unit, typically 45.00 EUR)
  const standardUnit = units.find((u) => u.code !== 'RCD');
  const standardNewMonthly = standardUnit
    ? computeStandardNewFee(standardUnit.monthlyFee, config)
    : 45;

  const rows: FeeSimulationRow[] = units.map((u) => {
    const currentMonthly = u.monthlyFee;
    let computedNew = currentMonthly;

    if (config.customOverrides[u.id] != null && !isNaN(config.customOverrides[u.id])) {
      computedNew = config.customOverrides[u.id];
    } else if (u.code === 'RCD') {
      if (config.rcdAdminMode === 'half_standard') {
        computedNew = applyRounding(standardNewMonthly * 0.5, config.rounding);
      } else {
        // Proportional: same % increase over current 20.00 €, or 50% of fixed € increase
        const raw =
          config.mode === 'percentage'
            ? currentMonthly * (1 + config.value / 100)
            : currentMonthly + config.value * 0.5;
        computedNew = applyRounding(raw, config.rounding);
      }
    } else {
      computedNew = computeStandardNewFee(currentMonthly, config);
    }

    const newMonthly = Math.max(0, round2(computedNew));
    const monthlyDiff = round2(newMonthly - currentMonthly);
    const percentDiff = currentMonthly > 0 ? round2((monthlyDiff / currentMonthly) * 100) : 0;
    const currentAnnual = round2(currentMonthly * 12);
    const newAnnual = round2(newMonthly * 12);
    const annualDiff = round2(newAnnual - currentAnnual);

    return {
      unitId: u.id,
      code: u.code,
      ownerName: u.currentOwner?.name || 'N/D',
      currentMonthly,
      newMonthly,
      monthlyDiff,
      percentDiff,
      currentAnnual,
      newAnnual,
      annualDiff,
    };
  });

  const totalCurrentMonthly = round2(rows.reduce((s, r) => s + r.currentMonthly, 0));
  const totalNewMonthly = round2(rows.reduce((s, r) => s + r.newMonthly, 0));
  const totalCurrentAnnual = round2(rows.reduce((s, r) => s + r.currentAnnual, 0));
  const totalNewAnnual = round2(rows.reduce((s, r) => s + r.newAnnual, 0));
  const monthlyImpact = round2(totalNewMonthly - totalCurrentMonthly);
  const annualImpact = round2(totalNewAnnual - totalCurrentAnnual);
  const overallPercentImpact =
    totalCurrentAnnual > 0 ? round2((annualImpact / totalCurrentAnnual) * 100) : 0;

  return {
    rows,
    totalCurrentMonthly,
    totalNewMonthly,
    totalCurrentAnnual,
    totalNewAnnual,
    monthlyImpact,
    annualImpact,
    overallPercentImpact,
  };
}
