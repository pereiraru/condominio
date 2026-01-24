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
