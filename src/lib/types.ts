export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'resident';
  unitId?: string;
  unit?: Unit;
}

export interface Owner {
  id: string;
  name: string;
  email?: string | null;
  telefone?: string | null;
  nib?: string | null;
  startMonth?: string | null; // "YYYY-MM"
  endMonth?: string | null;   // "YYYY-MM"
  previousDebt?: number;
  unitId: string;
}

export interface Unit {
  id: string;
  code: string;
  floor?: number;
  description?: string;
  monthlyFee: number;
  nib?: string;
  telefone?: string;
  email?: string;
  owners?: Owner[];
  totalPaid?: number;
  totalOwed?: number;
}

export interface Creditor {
  id: string;
  name: string;
  description?: string;
  category: string;
  amountDue?: number;
  email?: string;
  telefone?: string;
  nib?: string;
  attachments?: CreditorAttachment[];
  totalPaid?: number;
  avgMonthly?: number;
}

export interface CreditorAttachment {
  id: string;
  creditorId: string;
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface TransactionMonth {
  id: string;
  transactionId: string;
  month: string; // "YYYY-MM"
  amount: number;
  extraChargeId?: string | null;
  extraCharge?: ExtraCharge;
}

export interface MonthExpectedBreakdown {
  baseFee: number;
  extras: { id: string; description: string; amount: number }[];
}

export interface MonthPaymentBreakdown {
  baseFee: number;
  extras: { extraChargeId: string; description: string; paid: number }[];
}

export interface Transaction {
  id: string;
  date: string;
  valueDate?: string;
  description: string;
  amount: number;
  balance?: number;
  type: 'payment' | 'expense' | 'fee' | 'transfer';
  category?: string;
  referenceMonth?: string; // "YYYY-MM" (legacy)
  unitId?: string;
  unit?: Unit;
  creditorId?: string;
  creditor?: Creditor;
  monthAllocations?: TransactionMonth[];
}

export interface MonthPaymentStatus {
  month: string; // "YYYY-MM"
  paid: number;
  expected: number;
  baseFee?: number;
  extras?: { description: string; amount: number }[];
  isPaid: boolean;
}

export interface FeeHistory {
  id: string;
  unitId?: string;
  creditorId?: string;
  amount: number;
  effectiveFrom: string; // "YYYY-MM"
  effectiveTo?: string | null; // "YYYY-MM"
}

export interface ExtraCharge {
  id: string;
  unitId?: string | null;
  unit?: { code: string };
  description: string;
  amount: number;
  effectiveFrom: string; // "YYYY-MM"
  effectiveTo?: string | null; // "YYYY-MM"
}

export interface OutstandingExtra {
  id: string;
  description: string;
  monthlyAmount: number;
  totalExpected: number;
  totalPaid: number;
  remaining: number;
}

export interface Document {
  id: string;
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  category: 'invoice' | 'receipt' | 'minutes' | 'contract' | 'other';
  description?: string;
  uploadedAt: string;
}

export interface BankAccount {
  id: string;
  name: string;
  accountType: string;
  description?: string;
  snapshots?: BankAccountSnapshot[];
}

export interface BankAccountSnapshot {
  id: string;
  bankAccountId: string;
  date: string;
  balance: number;
  description?: string;
}

export interface SupplierInvoice {
  id: string;
  invoiceNumber?: string;
  entryNumber?: string;
  date: string;
  creditorId: string;
  creditor?: Creditor;
  description: string;
  category: string;
  amountDue: number;
  amountPaid: number;
  isPaid: boolean;
  transactionId?: string;
}

export interface Budget {
  id: string;
  year: number;
  notes?: string;
  lines?: BudgetLine[];
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  category: string;
  description: string;
  monthlyAmount: number;
  annualAmount: number;
  percentage?: number;
  sortOrder: number;
}

export interface DashboardStats {
  currentBalance: number;
  balanceTrend?: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  pendingPayments: number;
}

export interface UnitPaymentStatus {
  unitCode: string;
  expectedAmount: number;
  paidAmount: number;
  isPaid: boolean;
  lastPaymentDate?: string;
}

export interface DescriptionMapping {
  id: string;
  pattern: string;
  unitId?: string | null;
  creditorId?: string | null;
  createdAt: string;
}
