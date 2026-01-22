export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'resident';
  unitId?: string;
  unit?: Unit;
}

export interface Unit {
  id: string;
  code: string;
  floor?: number;
  description?: string;
  monthlyFee: number;
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
  unitId?: string;
  unit?: Unit;
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
