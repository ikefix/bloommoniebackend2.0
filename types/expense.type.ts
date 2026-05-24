import { Types } from 'mongoose';

// =========================
// EXPENSE CATEGORY TYPES
// =========================

export interface ExpenseCategory {
  _id?: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  parentCategory?: Types.ObjectId | null;
  budgetLimit?: number;
  alertThreshold?: number;
  isActive?: boolean;
  color?: string;
  icon?: string;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateExpenseCategoryRequest {
  name: string;
  code?: string;
  description?: string;
  parentCategory?: Types.ObjectId | null;
  budgetLimit?: number;
  alertThreshold?: number;
  color?: string;
  icon?: string;
}

export interface UpdateExpenseCategoryRequest {
  name?: string;
  description?: string;
  parentCategory?: Types.ObjectId | null;
  budgetLimit?: number;
  alertThreshold?: number;
  isActive?: boolean;
  color?: string;
  icon?: string;
}

// =========================
// EXPENSE TYPES
// =========================

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'cheque' | 'mobile_money' | 'other';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'reimbursed';
export type RecurringPattern = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Vendor {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Receipt {
  filename?: string;
  url?: string;
  uploadedAt?: Date;
}

export interface Attachment {
  filename: string;
  url: string;
  type?: string;
  uploadedAt?: Date;
}

export interface Expense {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  amount: number;
  category: Types.ObjectId;
  subcategory?: Types.ObjectId | null;
  expenseDate: Date;
  paymentMethod: PaymentMethod;
  reference?: string;
  receipt?: Receipt;
  attachments?: Attachment[];
  tags?: string[];
  status?: ExpenseStatus;
  approvedBy?: Types.ObjectId | null;
  reimbursedBy?: Types.ObjectId | null;
  reimbursedAt?: Date | null;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern | null;
  recurringEndDate?: Date | null;
  nextRecurringDate?: Date | null;
  location?: string;
  project?: string;
  vendor?: Vendor;
  taxAmount?: number;
  currency?: string;
  exchangeRate?: number;
  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateExpenseRequest {
  title: string;
  description?: string;
  amount: number;
  category: Types.ObjectId;
  subcategory?: Types.ObjectId | null;
  expenseDate: Date;
  paymentMethod: PaymentMethod;
  reference?: string;
  receipt?: Receipt;
  attachments?: Attachment[];
  tags?: string[];
  status?: ExpenseStatus;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  recurringEndDate?: Date;
  location?: string;
  project?: string;
  vendor?: Vendor;
  taxAmount?: number;
  currency?: string;
  exchangeRate?: number;
  notes?: string;
}

export interface UpdateExpenseRequest {
  title?: string;
  description?: string;
  amount?: number;
  category?: Types.ObjectId;
  subcategory?: Types.ObjectId | null;
  expenseDate?: Date;
  paymentMethod?: PaymentMethod;
  reference?: string;
  receipt?: Receipt;
  attachments?: Attachment[];
  tags?: string[];
  status?: ExpenseStatus;
  isRecurring?: boolean;
  recurringPattern?: RecurringPattern;
  recurringEndDate?: Date;
  location?: string;
  project?: string;
  vendor?: Vendor;
  taxAmount?: number;
  currency?: string;
  exchangeRate?: number;
  notes?: string;
}

export interface RejectExpenseRequest {
  reason: string;
}

export interface ProcessRecurringExpensesRequest {
  expenseIds: Types.ObjectId[];
}

// =========================
// QUERY PARAM TYPES
// =========================

export interface GetExpensesQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  subcategory?: string;
  status?: ExpenseStatus;
  startDate?: string;
  endDate?: string;
  paymentMethod?: PaymentMethod;
  isRecurring?: string;
  tags?: string;
}

export interface GetExpenseCategoriesQuery {
  search?: string;
}

export interface GetExpenseSummaryQuery {
  startDate?: string;
  endDate?: string;
  category?: string;
}

export interface GetExpenseTrendsQuery {
  year?: string | number;
}

// =========================
// RESPONSE TYPES
// =========================

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
}

export interface ExpenseListResponse {
  expenses: Expense[];
  pagination: PaginationInfo;
}

export interface ExpenseSummary {
  totalExpenses: number;
  totalTax: number;
  totalWithTax: number;
  expenseCount: number;
  averageExpense: number;
  maxExpense: number;
  minExpense: number;
}

export interface CategoryExpenseSummary {
  _id: Types.ObjectId;
  categoryName: string;
  totalAmount: number;
  totalTax: number;
  expenseCount: number;
  averageAmount: number;
}

export interface MonthlyTrend {
  _id: number;
  month: string;
  totalAmount: number;
  totalTax: number;
  expenseCount: number;
  averageAmount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}
