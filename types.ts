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

export interface AllowedEmail {
  id: string;
  email: string;
  isSuperadmin: boolean;
  createdAt?: string;
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
  lastHeartbeat?: string;  // ISO timestamp of last edge agent heartbeat
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
  turno?: number;            // shift number from VE file
  areaCode?: number;         // 1=playa (forecourt), 0=salon (shop)
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

export type TankId = string;  // dynamic: TQ1, TQ2, ..., TQN

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
  soldLiters?: number;       // liters sold this shift (from T*.TXT)
  soldAmount?: number;       // revenue from fuel sold this shift (from T*.TXT)
  rawLine?: string;
  ingestedAt?: string;
}

// ── DAILY CLOSINGS (from P*.TXT + S*.TXT) ──

export type ClosingStatus = 'PENDING' | 'RECONCILED' | 'DISCREPANCY';

export interface DailyClosing {
  id: string;
  stationId: string;
  shiftDate: string;          // YYYY-MM-DD
  turno?: number;             // shift number from P/S file
  closingTs?: string;         // DEPRECATED — use pClosingTs/sClosingTs
  pClosingTs?: string;        // P file mtime — determines playa turno
  sClosingTs?: string;        // S file mtime — determines shop turno
  totalsSnapshot?: Record<string, number>; // DEPRECATED
  pTotalsSnapshot?: Record<string, number>; // P file labels (VENTAS DE COMBUSTIBLES, etc.)
  sTotalsSnapshot?: Record<string, number>; // S file labels (VENTAS SALON, etc.)
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

// ── RUBRO SALES (from RP*.TXT + RS*.TXT) ──

export type RubroSourceType = 'RP' | 'RS';

export interface RubroSale {
  id: string;
  stationId: string;
  shiftDate: string;
  turno: number;
  sourceType: RubroSourceType;
  rubroId: string;
  rubroName: string;
  quantity: number;
  amount: number;
  fileName: string;
  rawLine?: string;
  ingestedAt?: string;
}

// ── CASH CLOSINGS (A files) ──

export interface CashClosing {
  id: string;
  stationId: string;
  shiftDate: string;
  turno?: number;
  cajaTotal?: number;
  chequeTotal?: number;
  closingTs?: string;
  aFileName?: string;
  createdAt?: string;
}

// ── OWNER PREFERENCES ──

export interface OwnerPreferences {
  id: string;
  ownerEmail: string;
  stationId?: string;               // null = global for all stations
  notifyTankLow: boolean;
  notifyTankCritical: boolean;
  notifyNegativeValue: boolean;
  notifyReconciliation: boolean;
  tankWarningLiters: number;
  tankCriticalLiters: number;
  shiftMorningStart: number;        // hour (0-23)
  shiftAfternoonStart: number;
  shiftNightStart: number;
  createdAt?: string;
  updatedAt?: string;
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
}
