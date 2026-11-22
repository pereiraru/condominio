export interface BudgetLineInput {
  id?: string;
  category: string;
  description: string;
  monthlyAmount: number;
  annualAmount: number;
  percentage?: number;
}

export interface UnitMonthGridCell {
  month: string;
  label: string;
  fullLabel: string;
  expected: number;
  paid: number;
  debt: number;
  isElapsed: boolean;
  status: 'paid' | 'partial' | 'unpaid' | 'future';
}

export interface UnitYearGrid {
  year: number;
  months: UnitMonthGridCell[];
  expectedDue: number;
  expectedFull: number;
  paid: number;
  debt: number;
}

export interface UnitReportPayment {
  id: string;
  date: string;
  description: string;
  amount: number;
  allocations: {
    month: string;
    amount: number;
    extraDescription?: string | null;
  }[];
}

export interface UnitReportItem {
  id: string;
  code: string;
  floor: number | null;
  description: string | null;
  monthlyFee: number;
  permilagem: number;
  currentOwner: {
    id: string;
    name: string;
    email?: string | null;
    telefone?: string | null;
  } | null;
  owners: {
    id: string;
    name: string;
    startMonth?: string | null;
    endMonth?: string | null;
    previousDebt: number;
  }[];
  pre2024: {
    initial: number;
    paid: number;
    remaining: number;
    payments: {
      id: string;
      date: string;
      description: string;
      amount: number;
    }[];
  };
  debtByYear: {
    pastYearsDebt: number;
    currentYearDebt: number;
    totalDebt: number;
  };
  totalPaidDigital: number;
  yearsGrid: UnitYearGrid[];
  payments: UnitReportPayment[];
  autoNotes: string;
}

export interface UnitReportsPayload {
  year: number;
  buildingName: string;
  units: UnitReportItem[];
  suggestedBudgetLines: BudgetLineInput[];
}

export type FeeAdjustmentMode = 'percentage' | 'fixed';
export type FeeRoundingMode = 'exact' | 'half_euro' | 'integer';
export type RcdAdminMode = 'proportional' | 'half_standard';

export interface FeeSimulationConfig {
  mode: FeeAdjustmentMode;
  value: number;
  rounding: FeeRoundingMode;
  rcdAdminMode: RcdAdminMode;
  customOverrides: Record<string, number>;
}

export interface FeeSimulationRow {
  unitId: string;
  code: string;
  ownerName: string;
  currentMonthly: number;
  newMonthly: number;
  monthlyDiff: number;
  percentDiff: number;
  currentAnnual: number;
  newAnnual: number;
  annualDiff: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnnualReportData = any;
