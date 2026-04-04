/**
 * Station-OS — Mappers DB ↔ App
 *
 * Convention:
 *  dbTo*  → Supabase row (snake_case) → App interface (camelCase)
 *  *ToDb  → App interface (camelCase) → Supabase payload (snake_case)
 *
 * Rules (from CLAUDE.md):
 *  - Optional fields: ?? undefined on read, ?? null on write
 *  - Numbers: Number(row.field) to handle DB string→number coercion
 *  - Conditional payload: only include optional columns if defined (avoids schema errors)
 */

import {
  Station,
  Employee,
  SalesTransaction,
  CardPayment,
  TankLevel,
  TankId,
  DailyClosing,
  ClosingStatus,
  Alert,
  AlertLevel,
  AlertType,
  AppNotification,
  NotificationType,
  PaymentMethod,
  EmployeeRole,
  StationKnowledge,
  KnowledgeProduct,
  KnowledgeAccount,
  ProductType,
  AccountType,
  AllowedEmail,
  OwnerPreferences,
} from '../types';

import {
  DbStationRow,
  DbEmployeeRow,
  DbSalesTransactionRow,
  DbCardPaymentRow,
  DbTankLevelRow,
  DbDailyClosingRow,
  DbAlertRow,
  DbNotificationRow,
  DbStationKnowledgeRow,
  DbAllowedEmailRow,
  DbOwnerPreferencesRow,
} from '../types/dbRows';

// ─── STATION ─────────────────────────────────────────────────────────────────

export const dbToStation = (row: DbStationRow): Station => ({
  id:          row.id,
  name:        row.name,
  address:     row.address,
  coordinates: row.coordinates,
  city:        row.city ?? undefined,
  province:    row.province ?? undefined,
  phone:       row.phone ?? undefined,
  managerName: row.manager_name ?? undefined,
  isActive:    row.is_active,
  ownerEmail:  row.owner_email ?? undefined,
  stationCode: row.station_code ?? undefined,
  watchPath:   row.watch_path ?? undefined,
  notes:       row.notes ?? undefined,
  createdAt:   row.created_at,
  updatedAt:   row.updated_at,
});

export const stationToDb = (station: Station): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    id:          station.id,
    name:        station.name,
    address:     station.address,
    coordinates: station.coordinates,
    city:        station.city ?? null,
    province:    station.province ?? null,
    phone:       station.phone ?? null,
    manager_name: station.managerName ?? null,
    is_active:   station.isActive,
    notes:       station.notes ?? null,
  };
  if (station.ownerEmail  !== undefined) payload.owner_email  = station.ownerEmail;
  if (station.stationCode !== undefined) payload.station_code = station.stationCode;
  if (station.watchPath   !== undefined) payload.watch_path   = station.watchPath;
  return payload;
};

// ─── EMPLOYEE ────────────────────────────────────────────────────────────────

export const dbToEmployee = (row: DbEmployeeRow): Employee => ({
  id:         row.id,
  stationId:  row.station_id,
  name:       row.name,
  email:      row.email ?? undefined,
  role:       row.role as EmployeeRole,
  isActive:   row.is_active,
  hireDate:   row.hire_date ?? undefined,
  notes:      row.notes ?? undefined,
  createdAt:  row.created_at,
});

export const employeeToDb = (emp: Employee): Record<string, unknown> => ({
  id:         emp.id,
  station_id: emp.stationId,
  name:       emp.name,
  email:      emp.email ? emp.email.trim().toLowerCase() : null,
  role:       emp.role,
  is_active:  emp.isActive,
  hire_date:  emp.hireDate ?? null,
  notes:      emp.notes ?? null,
});

// ─── SALES TRANSACTION ───────────────────────────────────────────────────────

export const dbToSalesTransaction = (row: DbSalesTransactionRow): SalesTransaction => ({
  id:              row.id,
  stationId:       row.station_id,
  fileName:        row.file_name,
  transactionTs:   row.transaction_ts,
  productCode:     row.product_code,
  productName:     row.product_name,
  quantity:        Number(row.quantity),
  unitPrice:       Number(row.unit_price),
  totalAmount:     Number(row.total_amount),
  paymentMethod:   row.payment_method as PaymentMethod ?? undefined,
  shiftDate:       row.shift_date,
  turno:           row.turno ?? undefined,
  areaCode:        row.area_code ?? undefined,
  dailyClosingId:  row.daily_closing_id ?? undefined,
  rawLine:         row.raw_line ?? undefined,
  ingestedAt:      row.ingested_at,
});

export const salesTransactionToDb = (tx: SalesTransaction): Record<string, unknown> => ({
  id:               tx.id,
  station_id:       tx.stationId,
  file_name:        tx.fileName,
  transaction_ts:   tx.transactionTs,
  product_code:     tx.productCode,
  product_name:     tx.productName,
  quantity:         tx.quantity,
  unit_price:       tx.unitPrice,
  total_amount:     tx.totalAmount,
  payment_method:   tx.paymentMethod ?? null,
  shift_date:       tx.shiftDate,
  turno:            tx.turno ?? null,
  area_code:        tx.areaCode ?? null,
  daily_closing_id: tx.dailyClosingId ?? null,
  raw_line:         tx.rawLine ?? null,
});

// ─── CARD PAYMENT ─────────────────────────────────────────────────────────────

export const dbToCardPayment = (row: DbCardPaymentRow): CardPayment => ({
  id:             row.id,
  stationId:      row.station_id,
  fileName:       row.file_name,
  paymentTs:      row.payment_ts ?? undefined,
  paymentType:    row.payment_type as PaymentMethod,
  accountName:    row.account_name ?? undefined,
  amount:         Number(row.amount),
  referenceCode:  row.reference_code ?? undefined,
  shiftDate:      row.shift_date ?? undefined,
  dailyClosingId: row.daily_closing_id ?? undefined,
  rawLine:        row.raw_line ?? undefined,
  ingestedAt:     row.ingested_at,
});

export const cardPaymentToDb = (cp: CardPayment): Record<string, unknown> => ({
  id:              cp.id,
  station_id:      cp.stationId,
  file_name:       cp.fileName,
  payment_ts:      cp.paymentTs ?? null,
  payment_type:    cp.paymentType,
  account_name:    cp.accountName ?? null,
  amount:          cp.amount,
  reference_code:  cp.referenceCode ?? null,
  shift_date:      cp.shiftDate ?? null,
  daily_closing_id: cp.dailyClosingId ?? null,
  raw_line:        cp.rawLine ?? null,
});

// ─── TANK LEVEL ───────────────────────────────────────────────────────────────

export const dbToTankLevel = (row: DbTankLevelRow): TankLevel => ({
  id:             row.id,
  stationId:      row.station_id,
  fileName:       row.file_name,
  recordedAt:     row.recorded_at,
  shiftDate:      row.shift_date ?? undefined,
  tankId:         row.tank_id as TankId,
  productCode:    row.product_code,
  productName:    row.product_name,
  levelLiters:    Number(row.level_liters),
  capacityLiters: row.capacity_liters != null ? Number(row.capacity_liters) : undefined,
  soldLiters:     row.sold_liters != null ? Number(row.sold_liters) : undefined,
  soldAmount:     row.sold_amount != null ? Number(row.sold_amount) : undefined,
  rawLine:        row.raw_line ?? undefined,
  ingestedAt:     row.ingested_at,
});

export const tankLevelToDb = (tl: TankLevel): Record<string, unknown> => ({
  id:              tl.id,
  station_id:      tl.stationId,
  file_name:       tl.fileName,
  recorded_at:     tl.recordedAt,
  shift_date:      tl.shiftDate ?? null,
  tank_id:         tl.tankId,
  product_code:    tl.productCode,
  product_name:    tl.productName,
  level_liters:    tl.levelLiters,
  capacity_liters: tl.capacityLiters ?? null,
  sold_liters:     tl.soldLiters ?? null,
  sold_amount:     tl.soldAmount ?? null,
  raw_line:        tl.rawLine ?? null,
});

// ─── DAILY CLOSING ────────────────────────────────────────────────────────────

export const dbToDailyClosing = (row: DbDailyClosingRow): DailyClosing => ({
  id:                   row.id,
  stationId:            row.station_id,
  shiftDate:            row.shift_date,
  turno:                row.turno ?? undefined,
  closingTs:            row.closing_ts ?? undefined,
  totalsSnapshot:       row.totals_snapshot ?? undefined,
  forecourtTotal:       row.forecourt_total    != null ? Number(row.forecourt_total)    : undefined,
  shopTotal:            row.shop_total         != null ? Number(row.shop_total)         : undefined,
  transactionsTotal:    row.transactions_total != null ? Number(row.transactions_total) : undefined,
  reconciliationDiff:   row.reconciliation_diff != null ? Number(row.reconciliation_diff) : undefined,
  reconciliationOk:     row.reconciliation_ok,
  pFileName:            row.p_file_name ?? undefined,
  sFileName:            row.s_file_name ?? undefined,
  status:               row.status as ClosingStatus,
  notes:                row.notes ?? undefined,
  createdAt:            row.created_at,
  updatedAt:            row.updated_at,
});

export const dailyClosingToDb = (dc: DailyClosing): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    id:                  dc.id,
    station_id:          dc.stationId,
    shift_date:          dc.shiftDate,
    reconciliation_ok:   dc.reconciliationOk,
    status:              dc.status,
    notes:               dc.notes ?? null,
  };
  if (dc.forecourtTotal    !== undefined) payload.forecourt_total    = dc.forecourtTotal;
  if (dc.shopTotal         !== undefined) payload.shop_total         = dc.shopTotal;
  if (dc.transactionsTotal !== undefined) payload.transactions_total = dc.transactionsTotal;
  if (dc.reconciliationDiff !== undefined) payload.reconciliation_diff = dc.reconciliationDiff;
  if (dc.turno             !== undefined) payload.turno              = dc.turno;
  if (dc.closingTs         !== undefined) payload.closing_ts         = dc.closingTs;
  if (dc.totalsSnapshot    !== undefined) payload.totals_snapshot    = dc.totalsSnapshot;
  if (dc.pFileName         !== undefined) payload.p_file_name        = dc.pFileName;
  if (dc.sFileName         !== undefined) payload.s_file_name        = dc.sFileName;
  return payload;
};

// ─── ALERT ────────────────────────────────────────────────────────────────────

export const dbToAlert = (row: DbAlertRow): Alert => ({
  id:          row.id,
  stationId:   row.station_id ?? undefined,
  level:       row.level as AlertLevel,
  type:        row.type as AlertType,
  title:       row.title,
  message:     row.message,
  relatedDate: row.related_date ?? undefined,
  relatedFile: row.related_file ?? undefined,
  resolved:    row.resolved,
  resolvedAt:  row.resolved_at ?? undefined,
  resolvedBy:  row.resolved_by ?? undefined,
  metadata:    row.metadata ?? undefined,
  createdAt:   row.created_at,
});

export const alertToDb = (alert: Alert): Record<string, unknown> => ({
  id:           alert.id,
  station_id:   alert.stationId ?? null,
  level:        alert.level,
  type:         alert.type,
  title:        alert.title,
  message:      alert.message,
  related_date: alert.relatedDate ?? null,
  related_file: alert.relatedFile ?? null,
  resolved:     alert.resolved,
  resolved_at:  alert.resolvedAt ?? null,
  resolved_by:  alert.resolvedBy ?? null,
  metadata:     alert.metadata ?? null,
});

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────

export const dbToNotification = (row: DbNotificationRow): AppNotification => ({
  id:             row.id,
  recipientEmail: row.recipient_email,
  title:          row.title,
  message:        row.message,
  type:           row.type as NotificationType,
  relatedId:      row.related_id ?? undefined,
  read:           row.read,
  createdAt:      row.created_at,
  metadata:       row.metadata ?? undefined,
});

export const notificationToDb = (n: AppNotification): Record<string, unknown> => ({
  id:              n.id,
  recipient_email: n.recipientEmail,
  type:            n.type,
  title:           n.title,
  message:         n.message,
  related_id:      n.relatedId ?? null,
  read:            n.read,
  created_at:      n.createdAt,
  metadata:        n.metadata ?? null,
});

// ─── STATION KNOWLEDGE ────────────────────────────────────────────────────────

export const dbToStationKnowledge = (row: DbStationKnowledgeRow): StationKnowledge => {
  const blob = row.knowledge_blob ?? {} as Partial<DbStationKnowledgeRow['knowledge_blob']>;
  return {
    id:        row.id,
    stationId: row.station_id,
    version:   row.version,
    lastUpdated: row.last_updated,
    knowledgeBlob: {
      schemaVersion: blob.schema_version ?? 1,
      products: Object.fromEntries(
        Object.entries(blob.products ?? {}).map(([code, p]) => [
          code,
          {
            canonicalName:   p.canonical_name,
            productType:     p.product_type as ProductType,
            aliases:         p.aliases ?? [],
            occurrenceCount: p.occurrence_count,
          } satisfies KnowledgeProduct,
        ])
      ),
      paymentAccounts: Object.fromEntries(
        Object.entries(blob.payment_accounts ?? {}).map(([code, a]) => [
          code,
          {
            canonicalName:   a.canonical_name,
            accountType:     a.account_type as AccountType,
            aliases:         a.aliases ?? [],
            occurrenceCount: a.occurrence_count,
          } satisfies KnowledgeAccount,
        ])
      ),
      anomalyBaselines: {
        dailyFuelLitersP50:       blob.anomaly_baselines?.daily_fuel_liters_p50 ?? 4500,
        cashVarianceTolerancePct: blob.anomaly_baselines?.cash_variance_tolerance_pct ?? 0.1,
        minTankAlertLiters:       blob.anomaly_baselines?.min_tank_alert_liters ?? 800,
        criticalTankLiters:       blob.anomaly_baselines?.critical_tank_liters ?? 300,
      },
      unknownProductCodes: blob.unknown_product_codes ?? [],
      unknownAccountNames: blob.unknown_account_names ?? [],
    },
  };
};

// ─── ALLOWED EMAIL ───────────────────────────────────────────────────────────

// ─── OWNER PREFERENCES ──────────────────────────────────────────────────────

export const dbToOwnerPreferences = (row: DbOwnerPreferencesRow): OwnerPreferences => ({
  id:                    row.id,
  ownerEmail:            row.owner_email,
  stationId:             row.station_id ?? undefined,
  notifyTankLow:         row.notify_tank_low,
  notifyTankCritical:    row.notify_tank_critical,
  notifyNegativeValue:   row.notify_negative_value,
  notifyReconciliation:  row.notify_reconciliation,
  tankWarningLiters:     row.tank_warning_liters,
  tankCriticalLiters:    row.tank_critical_liters,
  shiftMorningStart:     row.shift_morning_start,
  shiftAfternoonStart:   row.shift_afternoon_start,
  shiftNightStart:       row.shift_night_start,
  createdAt:             row.created_at,
  updatedAt:             row.updated_at,
});

export const ownerPreferencesToDb = (p: OwnerPreferences): Record<string, unknown> => ({
  id:                      p.id,
  owner_email:             p.ownerEmail,
  station_id:              p.stationId ?? null,
  notify_tank_low:         p.notifyTankLow,
  notify_tank_critical:    p.notifyTankCritical,
  notify_negative_value:   p.notifyNegativeValue,
  notify_reconciliation:   p.notifyReconciliation,
  tank_warning_liters:     p.tankWarningLiters,
  tank_critical_liters:    p.tankCriticalLiters,
  shift_morning_start:     p.shiftMorningStart,
  shift_afternoon_start:   p.shiftAfternoonStart,
  shift_night_start:       p.shiftNightStart,
});

// ─── ALLOWED EMAIL ───────────────────────────────────────────────────────────

export const dbToAllowedEmail = (row: DbAllowedEmailRow): AllowedEmail => ({
  id:           row.id,
  email:        row.email,
  isSuperadmin: row.is_superadmin,
  createdAt:    row.created_at,
});

export const allowedEmailToDb = (ae: AllowedEmail): Record<string, unknown> => ({
  id:            ae.id,
  email:         ae.email.trim().toLowerCase(),
  is_superadmin: ae.isSuperadmin,
});
