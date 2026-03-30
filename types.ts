// ─────────────────────────────────────────────────────────────────
// Station-OS — App types (camelCase)
// Mirrors: supabase/migrations/20260401_station_os_schema.sql
// ─────────────────────────────────────────────────────────────────

// ── USERS ──

export interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'ADMIN';
}

// ── STATIONS ──

export interface Station {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lat, lng]
  city?: string;
  province?: string;
  phone?: string;
  managerName?: string;
  isActive: boolean;
  ownerEmail?: string;   // tenant key — owner's email
  stationCode?: string;  // e.g. "EST_001"
  watchPath?: string;    // e.g. "C:\SVAPP"
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── EMPLOYEES ──

export type EmployeeRole = 'MANAGER' | 'ATTENDANT' | 'CASHIER';

export interface Employee {
  id: string;
  stationId: string;
  name: string;
  email?: string;
  role: EmployeeRole;
  isActive: boolean;
  hireDate?: string;
  notes?: string;
  createdAt?: string;
}

// ── SALES TRANSACTIONS (from VE*.TXT) ──

export type PaymentMethod = 'CASH' | 'CARD' | 'ACCOUNT' | 'MODO' | 'MERCADOPAGO';

export interface SalesTransaction {
  id: string;
  stationId: string;
  fileName: string;          // original VE*.TXT (audit trail)
  transactionTs: string;     // ISO 8601 timestamp
  productCode: string;
  productName: string;       // normalized via station_knowledge
  quantity: number;          // liters or units (negative = anomaly)
  unitPrice: number;         // nominal price per liter/unit
  totalAmount: number;       // actual amount charged (authoritative for reconciliation)
  paymentMethod?: PaymentMethod;
  shiftDate: string;         // YYYY-MM-DD
  dailyClosingId?: string;   // assigned after reconciliation
  rawLine?: string;          // original unparsed line (audit trail)
  ingestedAt?: string;
}

// ── CARD PAYMENTS (from C*.TXT) ──

export interface CardPayment {
  id: string;
  stationId: string;
  fileName: string;
  paymentTs?: string;
  paymentType: PaymentMethod;
  accountName?: string;      // normalized company/person name
  amount: number;            // can be negative (adjustment/debt)
  referenceCode?: string;    // raw account_code from C file
  shiftDate?: string;
  dailyClosingId?: string;
  rawLine?: string;
  ingestedAt?: string;
}

// ── TANK LEVELS (from T*.TXT) ──

export type TankId = 'TQ1' | 'TQ2' | 'TQ3' | 'TQ4' | 'TQ5';

export interface TankLevel {
  id: string;
  stationId: string;
  fileName: string;
  recordedAt: string;        // ISO 8601 timestamp
  shiftDate?: string;
  tankId: TankId;
  productCode: string;
  productName: string;
  levelLiters: number;       // current stock ← key for inventory alerting
  capacityLiters?: number;
  rawLine?: string;
  ingestedAt?: string;
}

// ── DAILY CLOSINGS (from P*.TXT + S*.TXT) ──

export type ClosingStatus = 'PENDING' | 'RECONCILED' | 'DISCREPANCY';

export interface DailyClosing {
  id: string;
  stationId: string;
  shiftDate: string;          // YYYY-MM-DD
  forecourtTotal?: number;    // TOTAL SALE from P*.TXT
  shopTotal?: number;         // TOTAL SALE from S*.TXT
  transactionsTotal?: number; // SUM(sales_transactions.total_amount)
  reconciliationDiff?: number;
  reconciliationOk: boolean;
  pFileName?: string;
  sFileName?: string;
  status: ClosingStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── ALERTS ──

export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export type AlertType =
  | 'CASH_DISCREPANCY'
  | 'NEGATIVE_VALUE'
  | 'MISSING_FILE'
  | 'LOW_TANK_LEVEL'
  | 'CRITICAL_TANK_LEVEL'
  | 'RECONCILIATION_FAIL'
  | 'UNKNOWN_PRODUCT'
  | 'VOLUME_ANOMALY'
  | 'MISSING_TRANSACTIONS';

export interface Alert {
  id: string;
  stationId?: string;
  level: AlertLevel;
  type: AlertType;
  title: string;
  message: string;
  relatedDate?: string;
  relatedFile?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ── NOTIFICATIONS ──

export type NotificationType =
  | 'RECONCILIATION_FAIL'
  | 'LOW_TANK'
  | 'UNKNOWN_PRODUCT'
  | 'GENERAL';

export interface AppNotification {
  id: string;
  recipientEmail: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

// ── STATION KNOWLEDGE ──

export type ProductType = 'FUEL' | 'LUBRICANT' | 'SHOP_ITEM' | 'SERVICE';
export type AccountType = 'CORPORATE' | 'PERSONAL' | 'GOVERNMENT';

export interface KnowledgeProduct {
  canonicalName: string;
  productType: ProductType;
  aliases: string[];
  occurrenceCount?: number;
}

export interface KnowledgeAccount {
  canonicalName: string;
  accountType: AccountType;
  aliases: string[];
  occurrenceCount?: number;
}

export interface KnowledgeBaselines {
  dailyFuelLitersP50: number;
  cashVarianceTolerancePct: number;
  minTankAlertLiters: number;
  criticalTankLiters: number;
}

export interface KnowledgeBlob {
  schemaVersion: number;
  products: Record<string, KnowledgeProduct>;
  paymentAccounts: Record<string, KnowledgeAccount>;
  anomalyBaselines: KnowledgeBaselines;
  unknownProductCodes: string[];
  unknownAccountNames: string[];
}

export interface StationKnowledge {
  id: string;
  stationId: string;
  knowledgeBlob: KnowledgeBlob;
  version: number;
  lastUpdated: string;
}

// ── ANALYTICS (computed client-side) ──

/** Day-by-day breakdown for a single station — used in sparkline/area charts. */
export interface StationDayMetrics {
  stationId: string;
  date: string;               // YYYY-MM-DD
  totalRevenue: number;
  fuelLiters: number;
  transactionCount: number;
  cashRevenue: number;
  cardRevenue: number;
  accountRevenue: number;
}

/** Aggregated metrics for one station over a period — used in station cards & rankings. */
export interface StationMetrics {
  stationId: string;
  totalTransactions: number;
  totalRevenue: number;
  fuelLiters: number;
  cashRevenue: number;
  cardRevenue: number;
  accountRevenue: number;
  digitalRevenue: number;
  activeDays: number;
  avgRevenuePerDay: number;
  avgTransactionsPerDay: number;
  topProductCode?: string;
  topProductName?: string;
  currentStockLiters: number;
  alertLevel: AlertLevel | null;
  lowTankCount: number;
  lastClosingStatus?: ClosingStatus;
  lastClosingDate?: string;
}

/** Network-wide KPI summary — used in the top bar of LiveDashboardView. */
export interface NetworkSummary {
  totalRevenue: number;
  totalTransactions: number;
  totalFuelLiters: number;
  totalCash: number;
  totalCard: number;
  totalAccount: number;
  totalDigital: number;
  activeStations: number;
  criticalStations: number;
  warningStations: number;
  discrepancyCount: number;
  pendingCount: number;
  topStationId?: string;
  avgRevenuePerStation: number;
}

/** Single-station summary for a selected period — used in detail view headers. */
export interface PeriodSummary {
  totalTransactions: number;
  totalRevenue: number;
  totalFuelLiters: number;
  avgRevenuePerDay: number;
  avgTransactionsPerDay: number;
  activeDays: number;
  unresolvedAlertCount: number;
  criticalAlertCount: number;
}
