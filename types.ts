// ─────────────────────────────────────────────
// RUFIANES — Tipos de la aplicación (camelCase)
// ─────────────────────────────────────────────

// ── USUARIOS ──

export interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'ADMIN' | 'BARBER';
  barberId?: string;       // presente cuando role === 'BARBER'
  barbershopId?: string;   // barbería de origen del barbero
}

// ── BARBERÍAS ──

export interface DayHours {
  open: string;    // "HH:mm"
  close: string;   // "HH:mm"
  isOpen: boolean;
}

export type WeekSchedule = {
  mon: DayHours;
  tue: DayHours;
  wed: DayHours;
  thu: DayHours;
  fri: DayHours;
  sat: DayHours;
  sun: DayHours;
};

export const DEFAULT_WEEK_SCHEDULE: WeekSchedule = {
  mon: { open: '09:00', close: '20:00', isOpen: false },
  tue: { open: '09:00', close: '20:00', isOpen: true },
  wed: { open: '09:00', close: '20:00', isOpen: true },
  thu: { open: '09:00', close: '20:00', isOpen: true },
  fri: { open: '09:00', close: '20:00', isOpen: true },
  sat: { open: '09:00', close: '20:00', isOpen: true },
  sun: { open: '09:00', close: '20:00', isOpen: false },
};

export interface Barbershop {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lat, lng]
  neighborhood?: string;
  phone?: string;
  imageUrl?: string;
  isActive: boolean;
  managerName?: string;
  notes?: string;
  chairCount?: number;
  openingHours?: WeekSchedule;
  createdAt?: string;
  updatedAt?: string;
}

// ── BARBEROS ──

export interface Barber {
  id: string;
  barbershopId: string;
  name: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  specialties: string[];
  commissionPct: number;   // 0–100
  isActive: boolean;
  hireDate?: string;
  notes?: string;
  createdAt?: string;
}

// ── SERVICIOS ──

export interface Service {
  id: string;
  barbershopId?: string;   // null = global para todas las barberías
  name: string;
  description?: string;
  basePrice: number;
  durationMins: number;
  isActive: boolean;
  createdAt?: string;
}

// ── CLIENTES ──

export interface Client {
  id: string;
  barbershopId?: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt?: string;
}

// ── SESIONES DE CORTE ──

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface HaircutSession {
  id: string;
  barbershopId: string;
  barberId: string;
  clientId?: string;
  clientName?: string;        // denormalizado para entrada rápida
  serviceId?: string;
  serviceName: string;        // snapshot del nombre al momento del corte
  price: number;
  commissionPct: number;      // snapshot del % al momento del corte
  commissionAmt: number;      // price * commissionPct / 100
  paymentMethod: PaymentMethod;
  startedAt: string;          // ISO timestamp
  endedAt?: string;
  durationMins?: number;
  shiftClosingId?: string;    // asignado al cerrar el turno
  notes?: string;
  createdAt?: string;
}

// ── CIERRE DE TURNO ──

export interface ShiftExpense {
  description: string;
  amount: number;
}

export interface ShiftClosing {
  id: string;
  barbershopId: string;
  barberId: string;
  shiftDate: string;          // YYYY-MM-DD
  startedAt?: string;
  closedAt: string | null;
  totalCuts: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalRevenue: number;
  totalCommission: number;
  expensesCash: number;
  expensesDetail: ShiftExpense[];
  netCashToHand?: number;     // totalCash - expensesCash
  notes?: string;
  status: 'OPEN' | 'CLOSED';
  createdAt?: string;
}

// ── NOTIFICACIONES ──

export type NotificationType =
  | 'SHIFT_CLOSED'
  | 'SHIFT_PENDING'
  | 'BARBER_ADDED'
  | 'GENERAL';

export interface ShiftClosingMetadata {
  barbershopId: string;
  barbershopName: string;
  barberId: string;
  barberName: string;
  shiftDate: string;
  totalCuts: number;
  totalRevenue: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  totalCommission: number;
  expensesCash: number;
  netCashToHand: number;
  expensesDetail: { description: string; amount: number }[];
}

export interface AppNotification {
  id: string;
  recipientEmail: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string;
  read: boolean;
  createdAt: string;
  metadata?: ShiftClosingMetadata;
}

// ── ANALYTICS (computados en cliente, no almacenados) ──

export interface BarberDayMetrics {
  barberId: string;
  barberName: string;
  date: string;
  totalCuts: number;
  totalRevenue: number;
  totalCommission: number;
  avgDurationMins?: number;
  avgPricePerCut?: number;
  cashRevenue: number;
  cardRevenue: number;
  transferRevenue: number;
}

export interface BarbershopMetrics {
  barbershopId: string;
  barbershopName: string;
  totalCuts: number;
  totalRevenue: number;
  totalCommission: number;
  activeBarbers: number;
  avgCutsPerDay: number;
  topBarberId?: string;
  topBarberName?: string;
}

export interface PeriodSummary {
  totalCuts: number;
  totalRevenue: number;
  totalCommission: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  avgCutsPerDay: number;
  avgRevenuePerCut: number;
  busyDay?: string;
  topBarberId?: string;
}

export interface BarbershopFinancials {
  barbershopId: string;
  barbershopName: string;
  totalShifts: number;
  totalCuts: number;
  totalRevenue: number;
  totalCommissions: number;    // lo que los barberos se llevan diariamente
  totalExpenses: number;       // gastos operativos del turno
  netOwnerRevenue: number;     // revenue - commissions - expenses
  barberBreakdown: {
    barberId: string;
    barberName: string;
    cuts: number;
    revenue: number;
    commission: number;
    shifts: { shiftDate: string; startedAt?: string; closedAt?: string | null }[];
  }[];
  expensesDetail: { description: string; amount: number }[];
}

export interface NetworkFinancialSummary {
  totalRevenue: number;
  totalCommissions: number;
  totalExpenses: number;
  netOwnerRevenue: number;
  totalCuts: number;
  totalShifts: number;
}
