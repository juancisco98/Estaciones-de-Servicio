// ─────────────────────────────────────────────────────────────────
// Station-OS — Application constants
// ─────────────────────────────────────────────────────────────────

// Google Auth Allowlist — Admins (network owners)
export const ALLOWED_EMAILS = [
  'juan.sada98@gmail.com',
];

// Map center — Argentina (adjust once real station locations are loaded)
export const MAP_CENTER: [number, number] = [-34.6037, -58.3816];
export const MAP_ZOOM_DEFAULT = 10;   // wider view for 60-station network coverage
export const MAP_RESIZE_DELAY_MS = 200;

// Date/locale helpers
export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DAY_NAMES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];

// Payment methods (matches DB enum + edge_agent mapping)
export const PAYMENT_METHODS = ['CASH', 'CARD', 'ACCOUNT', 'MODO', 'MERCADOPAGO'] as const;
export type PaymentMethodType = typeof PAYMENT_METHODS[number];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH:       'Efectivo',
  CARD:       'Tarjeta',
  ACCOUNT:    'Cuenta Corriente',
  MODO:       'MODO QR',
  MERCADOPAGO: 'Mercado Pago',
};

export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH:       'emerald',
  CARD:       'blue',
  ACCOUNT:    'violet',
  MODO:       'cyan',
  MERCADOPAGO: 'sky',
};

// Closing status
export const CLOSING_STATUS_LABELS: Record<string, string> = {
  PENDING:     'Pendiente',
  RECONCILED:  'Conciliado',
  DISCREPANCY: 'Discrepancia',
};

export const CLOSING_STATUS_COLORS: Record<string, string> = {
  PENDING:     'amber',
  RECONCILED:  'green',
  DISCREPANCY: 'red',
};

// Product types (from station_knowledge)
export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  FUEL:       'Combustible',
  LUBRICANT:  'Lubricante',
  SHOP_ITEM:  'Tienda',
  SERVICE:    'Servicio',
};

export const PRODUCT_TYPE_COLORS: Record<string, string> = {
  FUEL:      'amber',
  LUBRICANT: 'teal',
  SHOP_ITEM: 'violet',
  SERVICE:   'blue',
};

// Employee roles
export const EMPLOYEE_ROLE_LABELS: Record<string, string> = {
  MANAGER:   'Encargado',
  ATTENDANT: 'Playero',
  CASHIER:   'Cajero',
};

// Tank IDs are dynamic (read from DB) — no hardcoded list

// Tank alert thresholds (liters) — also stored in station_knowledge per station
export const TANK_WARNING_LITERS  = 800;
export const TANK_CRITICAL_LITERS = 300;

// Reconciliation tolerance (0.1% = 0.001)
export const RECONCILIATION_TOLERANCE = 0.001;

// Analytics — load window (days back)
export const TRANSACTIONS_LOAD_DAYS = 90;

// Real-time channel names
export const RT_CHANNELS = {
  SALES:         'sales_transactions_realtime',
  TANKS:         'tank_levels_realtime',
  CLOSINGS:      'daily_closings_realtime',
  CARD_PAYMENTS: 'card_payments_realtime',
  CASH_CLOSINGS: 'cash_closings_realtime',
  STATIONS:      'stations_realtime',
  NOTIFICATIONS: 'notifications_realtime',
} as const;
