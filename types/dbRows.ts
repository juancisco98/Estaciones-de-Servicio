/**
 * RUFIANES — Database row types matching Supabase snake_case schema.
 * Used in mapper functions (dbTo* / *ToDb).
 */

export interface DbBarbershopRow {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number];
  neighborhood?: string | null;
  phone?: string | null;
  image_url?: string | null;
  is_active: boolean;
  manager_name?: string | null;
  notes?: string | null;
  chair_count?: number | null;
  opening_hours?: Record<string, { open: string; close: string; is_open: boolean }> | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbBarberRow {
  id: string;
  barbershop_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
  specialties: string[];
  commission_pct: number | string;
  is_active: boolean;
  hire_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbServiceRow {
  id: string;
  barbershop_id?: string | null;
  name: string;
  description?: string | null;
  base_price: number | string;
  duration_mins: number;
  is_active: boolean;
  created_at?: string;
}

export interface DbClientRow {
  id: string;
  barbershop_id?: string | null;
  name: string;
  phone?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface DbHaircutSessionRow {
  id: string;
  barbershop_id: string;
  barber_id: string;
  client_id?: string | null;
  client_name?: string | null;
  service_id?: string | null;
  service_name: string;
  price: number | string;
  commission_pct: number | string;
  commission_amt: number | string;
  payment_method: string;
  started_at: string;
  ended_at?: string | null;
  duration_mins?: number | null;
  shift_closing_id?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface DbShiftClosingRow {
  id: string;
  barbershop_id: string;
  barber_id: string;
  shift_date: string;
  started_at?: string | null;
  closed_at: string | null;
  total_cuts: number;
  total_cash: number | string;
  total_card: number | string;
  total_transfer: number | string;
  total_revenue: number | string;
  total_commission: number | string;
  expenses_cash: number | string;
  expenses_detail: { description: string; amount: number }[];
  net_cash_to_hand?: number | string | null;
  notes?: string | null;
  status: string;
  created_at?: string;
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

export interface DbBarberAuthRow {
  user_id: string;
  barber_id: string;
  created_at?: string;
}
