/**
 * Station-OS — Database row types (snake_case).
 * Mirrors: supabase/migrations/20260401_station_os_schema.sql
 * Used exclusively in mapper functions (dbTo* / *ToDb).
 */

export interface DbStationRow {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number];
  city?: string | null;
  province?: string | null;
  phone?: string | null;
  manager_name?: string | null;
  is_active: boolean;
  owner_email?: string | null;
  station_code?: string | null;
  watch_path?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbEmployeeRow {
  id: string;
  station_id: string;
  name: string;
  email?: string | null;
  role: string;           // 'MANAGER' | 'ATTENDANT' | 'CASHIER'
  is_active: boolean;
  hire_date?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface DbOperatorAuthRow {
  user_id: string;
  employee_id: string;
  station_id: string;
  created_at?: string;
}

export interface DbSalesTransactionRow {
  id: string;
  station_id: string;
  file_name: string;
  transaction_ts: string;
  product_code: string;
  product_name: string;
  quantity: number | string;
  unit_price: number | string;
  total_amount: number | string;
  payment_method?: string | null;
  shift_date: string;
  turno?: number | null;
  area_code?: number | null;
  daily_closing_id?: string | null;
  raw_line?: string | null;
  ingested_at?: string;
}

export interface DbCardPaymentRow {
  id: string;
  station_id: string;
  file_name: string;
  payment_ts?: string | null;
  payment_type: string;
  account_name?: string | null;
  amount: number | string;
  reference_code?: string | null;
  shift_date?: string | null;
  daily_closing_id?: string | null;
  raw_line?: string | null;
  ingested_at?: string;
}

export interface DbTankLevelRow {
  id: string;
  station_id: string;
  file_name: string;
  recorded_at: string;
  shift_date?: string | null;
  tank_id: string;         // 'TQ1', 'TQ2', ..., 'TQN' (dynamic)
  product_code: string;
  product_name: string;
  level_liters: number | string;
  capacity_liters?: number | string | null;
  sold_liters?: number | string | null;
  sold_amount?: number | string | null;
  raw_line?: string | null;
  ingested_at?: string;
}

export interface DbDailyClosingRow {
  id: string;
  station_id: string;
  shift_date: string;
  turno?: number | null;
  forecourt_total?: number | string | null;
  shop_total?: number | string | null;
  transactions_total?: number | string | null;
  reconciliation_diff?: number | string | null;
  reconciliation_ok: boolean;
  p_file_name?: string | null;
  s_file_name?: string | null;
  status: string;         // 'PENDING' | 'RECONCILED' | 'DISCREPANCY'
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbAlertRow {
  id: string;
  station_id?: string | null;
  level: string;          // 'CRITICAL' | 'WARNING' | 'INFO'
  type: string;
  title: string;
  message: string;
  related_date?: string | null;
  related_file?: string | null;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface DbStationKnowledgeRow {
  id: string;
  station_id: string;
  knowledge_blob: {
    schema_version: number;
    products: Record<string, {
      canonical_name: string;
      product_type: string;
      aliases: string[];
      occurrence_count?: number;
    }>;
    payment_accounts: Record<string, {
      canonical_name: string;
      account_type: string;
      aliases: string[];
      occurrence_count?: number;
    }>;
    anomaly_baselines: {
      daily_fuel_liters_p50: number;
      cash_variance_tolerance_pct: number;
      min_tank_alert_liters: number;
      critical_tank_liters: number;
    };
    unknown_product_codes: string[];
    unknown_account_names: string[];
  };
  version: number;
  last_updated: string;
}

export interface DbNotificationRow {
  id: string;
  recipient_email: string;
  title: string;
  message: string;
  type: string;
  related_id?: string | null;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface DbAllowedEmailRow {
  id: string;
  email: string;
  is_superadmin: boolean;
  created_at?: string;
}
