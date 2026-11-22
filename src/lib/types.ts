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
  pastDebt?: number;
  yearDebt?: number;
  pastYearsDebt?: number;
  previousDebtRemaining?: number;
  unallocatedPayments?: { count: number; total: number };
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
  attachmentFilename?: string | null;
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

export interface DashboardBankAccountSummary {
  id: string;
  name: string;
  accountType: string;
  balance: number;
  lastDate: string | null;
}

export interface DashboardAnnouncement {
  id: string;
  title: string;
  message: string;
  category: 'assembly' | 'notice' | 'maintenance';
  dateLabel: string;
}

export interface DashboardPendingIssue {
  id: string;
  incidentId?: string | null;
  code?: string | null;
  title: string;
  description: string;
  category: string;
  status: 'open' | 'pending_payment' | 'in_analysis' | 'scheduled' | 'monitoring' | 'resolved';
  priority: 'high' | 'medium' | 'low';
  amount?: number | null;
  dateLabel?: string | null;
}

export interface DashboardExtraordinaryActivity {
  id: string;
  date: string;
  creditorName: string;
  category: string;
  description: string;
  amount: number;
}

export interface DashboardRegularService {
  id: string;
  name: string;
  category: string;
  isFixed: boolean;
  monthlyAmount: number;
  paidThisYear: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  status: 'regularized' | 'pending' | 'variable';
  pendingAmount: number;
}

export interface DashboardExpenseCategoryItem {
  category: string;
  label: string;
  amount: number;
  percentage: number;
}

export interface DashboardMyUnitSummary {
  id: string;
  code: string;
  description?: string | null;
  ownerName?: string | null;
  monthlyFee: number;
  paidThisYear: number;
  totalOwed: number;
  yearDebt: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
}

export interface DashboardStats {
  currentBalance: number;
  balanceTrend?: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  pendingPayments: number;
  currentYear: number;
  currentMonthLabel: string;
  totalBankBalance: number;
  bankAccounts: DashboardBankAccountSummary[];
  yearSummary: {
    yearIncome: number;
    yearOperationalExpenses: number;
    yearSavingsTransfers: number;
    yearNetBalance: number;
    pendingInvoicesTotal: number;
    pendingInvoicesCount: number;
  };
  unitCompliance: {
    totalUnits: number;
    unitsUpToDateThisYear: number;
    collectionRateYear: number;
  };
  announcements: DashboardAnnouncement[];
  pendingIssues: DashboardPendingIssue[];
  extraordinaryActivities: DashboardExtraordinaryActivity[];
  regularServices: DashboardRegularService[];
  expenseBreakdown: DashboardExpenseCategoryItem[];
  myUnit: DashboardMyUnitSummary | null;
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

export type IncidentStatus = 'open' | 'in_progress' | 'scheduled' | 'resolved' | 'closed';
export type IncidentPriority = 'low' | 'normal' | 'urgent';
export type IncidentVisibility = 'public' | 'unit_private';
export type IncidentLocation =
  | 'elevator'
  | 'garage'
  | 'lighting'
  | 'door'
  | 'water'
  | 'roof'
  | 'cleaning'
  | 'other';

export interface IncidentAttachment {
  id: string;
  incidentId: string;
  phase: 'report' | 'resolution';
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface IncidentLog {
  id: string;
  incidentId: string;
  actorName: string;
  actorRole: string;
  actionType: string;
  message: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  code: string;
  title: string;
  description: string;
  immediateAction?: string | null;
  location: IncidentLocation | string;
  priority: IncidentPriority | string;
  visibility: IncidentVisibility | string;
  status: IncidentStatus | string;
  reportedByUnitId?: string | null;
  reportedByUnit?: { id: string; code: string; description?: string | null } | null;
  reportedByName: string;
  reportedByEmail?: string | null;
  notifyEmails?: string | null;
  reportedAt: string;
  assignedTo?: string | null;
  plannedDate?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  expenseAmount?: number | null;
  creditorId?: string | null;
  creditor?: { id: string; name: string; category: string } | null;
  supplierInvoiceId?: string | null;
  supplierInvoice?: { id: string; description: string; amountDue: number; isPaid: boolean } | null;
  attachments?: IncidentAttachment[];
  logs?: IncidentLog[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationConfigData {
  id: string;
  enabled: boolean;
  adminEmails: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
}
