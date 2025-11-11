export type WindowState = 'normal' | 'maximized';

export interface WindowControls {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<WindowState>;
  close: () => Promise<void>;
  getState: () => Promise<WindowState>;
  onStateChange: (callback: (state: WindowState) => void) => () => void;
}

export interface AppSettings {
  administrator_name?: string;
  company_name?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface ElectronAPI {
  query: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  run: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  get: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  windowControls: WindowControls;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface Condominium {
  id: number;
  name: string;
  address?: string;
  nipc?: string;
  created_at: string;
}

export interface Unit {
  id: number;
  condominium_id: number;
  unit_number: string;
  unit_type: 'apartment' | 'store' | 'garage' | 'other';
  floor?: string;
  permilagem: number;
  notes?: string;
  created_at: string;
}

export interface Person {
  id: number;
  condominium_id: number;
  name: string;
  email?: string;
  phone?: string;
  nif?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface UnitOwnership {
  id: number;
  unit_id: number;
  person_id: number;
  relationship_type: 'owner' | 'renter' | 'usufructuary' | 'proxy';
  start_date: string;
  end_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface Budget {
  id: number;
  condominium_id: number;
  year: number;
  total_amount: number;
  reserve_fund_amount: number;
  reserve_fund_percentage: number;
  description?: string;
  created_at: string;
}

export interface BudgetCategory {
  id: number;
  budget_id: number;
  name: string;
  planned_amount: number;
  description?: string;
  category_type?: string;
  allocation_scope?: 'all' | 'unit_types' | 'custom';
  eligible_unit_types?: string;
  contributes_to_fcr?: boolean;
}

export interface Transaction {
  id: number;
  condominium_id: number;
  type: 'income' | 'expense';
  category?: string;
  category_id?: number;
  supplier_id?: number;
  supplier_name?: string;
  category_name?: string;
  category_year?: number;
  amount: number;
  description?: string;
  transaction_date: string;
  is_reserve_fund: boolean;
  created_at: string;
}

export interface Payment {
  id: number;
  unit_id: number;
  amount: number;
  payment_date: string;
  due_date?: string;
  period?: string;
  status: 'pending' | 'paid' | 'overdue';
  paid_at?: string;
  notes?: string;
  unit_number?: string;
  created_at: string;
}

export interface Supplier {
  id: number;
  condominium_id: number;
  name: string;
  email?: string;
  phone?: string;
  nif?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

export interface MaintenanceTask {
  id: number;
  condominium_id: number;
  unit_id?: number;
  supplier_id?: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  reported_date: string;
  due_date?: string;
  completed_date?: string;
  estimated_cost?: number;
  actual_cost?: number;
  notes?: string;
  created_at: string;
  unit_number?: string;
  supplier_name?: string;
}

export interface Meeting {
  id: number;
  condominium_id: number;
  title: string;
  meeting_date: string;
  location?: string;
  agenda?: string;
  minutes?: string;
  created_at: string;
}

export interface Communication {
  id: number;
  condominium_id: number;
  title: string;
  audience: string;
  channel: string;
  status: string;
  sent_date?: string;
  message: string;
  created_at: string;
}

export interface QuotaSchedule {
  id: number;
  budget_id?: number;
  condominium_id?: number;
  version: number;
  generated_at: string;
  status: 'draft' | 'finalized';
  notes?: string;
  is_standalone?: boolean;
  total_amount?: number;
  duration_months?: number;
  title?: string;
}

export interface QuotaScheduleItem {
  schedule_id: number;
  unit_id: number;
  month_index: number;
  amount: number;
}
