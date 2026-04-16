

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
  last_heartbeat?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbEmployeeRow {
  id: string;
  station_id: string;
  name: string;
  email?: string | null;
  role: string;
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
  tank_id: string;
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
  closing_ts?: string | null;
  p_closing_ts?: string | null;
  s_closing_ts?: string | null;
  totals_snapshot?: Record<string, number> | null;
  p_totals_snapshot?: Record<string, number> | null;
  s_totals_snapshot?: Record<string, number> | null;
  forecourt_total?: number | string | null;
  shop_total?: number | string | null;
  transactions_total?: number | string | null;
  reconciliation_diff?: number | string | null;
  reconciliation_ok: boolean;
  p_file_name?: string | null;
  s_file_name?: string | null;
  status: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbRubroSaleRow {
  id: string;
  station_id: string;
  shift_date: string;
  turno: number;
  source_type: string;
  rubro_id: string;
  rubro_name: string;
  quantity: number | string;
  amount: number | string;
  file_name: string;
  raw_line?: string | null;
  ingested_at?: string;
}

export interface DbCashClosingRow {
  id: string;
  station_id: string;
  shift_date: string;
  turno?: number | null;
  caja_total?: number | string | null;
  cheque_total?: number | string | null;
  closing_ts?: string | null;
  a_file_name?: string | null;
  created_at?: string;
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

export interface DbOwnerPreferencesRow {
  id: string;
  owner_email: string;
  station_id?: string | null;
  notify_tank_low: boolean;
  notify_tank_critical: boolean;
  notify_negative_value: boolean;
  notify_reconciliation: boolean;
  tank_warning_liters: number;
  tank_critical_liters: number;
  shift_morning_start: number;
  shift_afternoon_start: number;
  shift_night_start: number;
  created_at?: string;
  updated_at?: string;
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
