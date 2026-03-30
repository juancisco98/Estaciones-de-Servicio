import React, { useState, useMemo } from 'react';
import {
  Scissors, CheckCircle, LogOut, Clock, DollarSign, TrendingUp,
  Calendar, Search, ChevronLeft, ChevronRight, Sun, Moon, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { User, HaircutSession, ShiftClosing, Service, Barber, Barbershop } from '../types';
import { PAYMENT_METHOD_LABELS } from '../constants';
import { useTheme } from '../context/ThemeContext';
import RegisterSessionModal from './RegisterSessionModal';
import ShiftClosingModal from './ShiftClosingModal';

interface BarberPortalProps {
  currentUser: User;
  sessions: HaircutSession[];
  shiftClosings: ShiftClosing[];
  services: Service[];
  barbers: Barber[];
  barbershops: Barbershop[];
  getActiveShift: (barberId: string) => ShiftClosing | null;
  openShift: (barbershopId: string, barberId: string) => Promise<ShiftClosing>;
  closeShift: (closing: ShiftClosing) => Promise<void>;
  registerSession: (session: HaircutSession) => Promise<void>;
  getServicesForShop: (barbershopId: string) => Service[];
  onLogout: () => void;
}

const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

const PaymentBadge: React.FC<{ method: string }> = ({ method }) => {
  const styles: Record<string, string> = {
    CASH:     'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    CARD:     'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
    TRANSFER: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles[method] ?? 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
      {PAYMENT_METHOD_LABELS[method]}
    </span>
  );
};

// ─── Color map para KPIs ─────────────────────────────────────────────────────
const KPI = {
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    icon: 'text-amber-500',
    value: 'text-amber-700 dark:text-amber-400',
    label: 'text-amber-600 dark:text-amber-500',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    icon: 'text-emerald-500',
    value: 'text-emerald-700 dark:text-emerald-400',
    label: 'text-emerald-600 dark:text-emerald-500',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    icon: 'text-indigo-500',
    value: 'text-indigo-700 dark:text-indigo-400',
    label: 'text-indigo-600 dark:text-indigo-500',
  },
};

const BarberPortal: React.FC<BarberPortalProps> = ({
  currentUser, sessions, shiftClosings, barbers, barbershops,
  getActiveShift, openShift, closeShift, registerSession, getServicesForShop, onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();

  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');

  const [historyFilter, setHistoryFilter] = useState<'day' | 'month'>('day');
  const [historyDay, setHistoryDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [historyMonth, setHistoryMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const barberId   = currentUser.barberId!;
  const barbershopId = currentUser.barbershopId!;
  const barber     = barbers.find(b => b.id === barberId);
  const shop       = barbershops.find(s => s.id === barbershopId);
  const activeShift = getActiveShift(barberId);
  const today      = new Date().toISOString().slice(0, 10);
  const shopServices = getServicesForShop(barbershopId);

  // ── Sesiones ─────────────────────────────────────────────────────────────
  const todaySessions = useMemo(() =>
    sessions
      .filter((s: HaircutSession) => s.barberId === barberId && s.startedAt.slice(0, 10) === today)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions, barberId, today]
  );

  const historySessions = useMemo(() =>
    sessions.filter(s => {
      if (s.barberId !== barberId) return false;
      return historyFilter === 'day'
        ? s.startedAt.slice(0, 10) === historyDay
        : s.startedAt.slice(0, 7) === historyMonth;
    }).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions, barberId, historyFilter, historyDay, historyMonth]
  );

  const historyClosings = useMemo(() =>
    shiftClosings.filter(sc => {
      if (sc.barberId !== barberId || sc.status !== 'CLOSED') return false;
      return historyFilter === 'day'
        ? sc.shiftDate === historyDay
        : sc.shiftDate.slice(0, 7) === historyMonth;
    }).sort((a, b) => b.shiftDate.localeCompare(a.shiftDate)),
    [shiftClosings, barberId, historyFilter, historyDay, historyMonth]
  );

  // ── Métricas ──────────────────────────────────────────────────────────────
  const todayRevenue    = todaySessions.reduce((sum, s) => sum + s.price, 0);
  const todayCommission = todaySessions.reduce((sum, s) => sum + s.commissionAmt, 0);
  const historyRevenue    = historySessions.reduce((sum, s) => sum + s.price, 0);
  const historyCommission = historySessions.reduce((sum, s) => sum + s.commissionAmt, 0);
  const historyCash     = historySessions.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.price, 0);
  const historyCard     = historySessions.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.price, 0);
  const historyTransfer = historySessions.filter(s => s.paymentMethod === 'TRANSFER').reduce((sum, s) => sum + s.price, 0);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpenShift = async () => {
    setIsOpeningShift(true);
    try {
      await openShift(barbershopId, barberId);
      toast.success('Turno iniciado');
    } catch (err: any) {
      toast.error(`No se pudo iniciar el turno: ${err?.message ?? 'Error desconocido'}`);
    } finally {
      setIsOpeningShift(false);
    }
  };

  const shiftDay = (delta: number) => {
    const d = new Date(historyDay);
    d.setDate(d.getDate() + delta);
    setHistoryDay(d.toISOString().slice(0, 10));
  };
  const shiftMonth = (delta: number) => {
    const [y, m] = historyMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setHistoryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const dayLabel   = new Date(historyDay + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const monthLabel = new Date(historyMonth + '-01T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const fmtCompact = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(n);

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (!barber) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white flex flex-col">

      {/* ── HEADER (sticky, glass morphism) ──────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-2xl border-b border-gray-100 dark:border-white/10 shrink-0">
        <div className="px-4 sm:px-5 h-14 flex items-center justify-between max-w-2xl mx-auto w-full">

          {/* Left: logo + identity */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-500/20 shrink-0">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black text-gray-900 dark:text-white">{shop?.name ?? 'Rufianes'}</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">{barber.name} · {barber.commissionPct}% comisión</p>
            </div>
          </div>

          {/* Right: theme toggle + logout */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onLogout}
              className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── SCROLL CONTENT ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="max-w-2xl mx-auto w-full px-4 sm:px-5 pt-4 space-y-3">

          {/* ── Shift status ─────────────────────────────────────────────── */}
          {!activeShift ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-white/5 shadow-sm text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-gray-300 dark:text-slate-600" />
              </div>
              <p className="font-black text-gray-900 dark:text-white text-lg mb-1">Sin turno activo</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
                Iniciá tu turno para empezar a registrar cortes
              </p>
              <button
                onClick={handleOpenShift}
                disabled={isOpeningShift}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-bold text-base transition-all disabled:opacity-50 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
              >
                {isOpeningShift ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Clock className="w-5 h-5" />
                )}
                {isOpeningShift ? 'Iniciando...' : 'Iniciar turno'}
              </button>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-emerald-700 dark:text-emerald-400 text-sm font-bold">Turno activo</span>
              </div>
              {activeShift.startedAt && (
                <span className="text-gray-500 dark:text-slate-400 text-xs">
                  Desde {new Date(activeShift.startedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {/* ── KPI cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Cortes', value: String(todaySessions.length), Icon: Scissors, c: 'amber' as const },
              { label: 'Revenue', value: fmtCompact(todayRevenue), Icon: DollarSign, c: 'emerald' as const },
              { label: 'Ganancia', value: fmtCompact(todayCommission), Icon: TrendingUp, c: 'indigo' as const },
            ].map(({ label, value, Icon, c }) => (
              <div key={label} className={`${KPI[c].bg} rounded-2xl p-3 sm:p-4 text-center`}>
                <Icon className={`w-4 h-4 ${KPI[c].icon} mx-auto mb-1.5`} />
                <p className={`text-xl font-black ${KPI[c].value} leading-none`}>{value}</p>
                <p className={`text-[10px] ${KPI[c].label} font-semibold mt-1`}>{label}</p>
              </div>
            ))}
          </div>

          {/* ── Tab content ──────────────────────────────────────────────── */}

          {/* ─── TAB: HOY ─────────────────────────────────────────────────── */}
          {activeTab === 'today' && (
            <div className="space-y-2.5">

              {/* Section label */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                  Cortes de hoy
                </p>
                {todaySessions.length > 0 && (
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {todaySessions.length}
                  </span>
                )}
              </div>

              {todaySessions.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-white/5 shadow-sm text-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                    <Scissors className="w-7 h-7 text-amber-300 dark:text-amber-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">
                    {activeShift ? 'Todavía no registraste cortes hoy' : 'Iniciá el turno para comenzar'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Sessions list */}
                  <div className="space-y-2">
                    {todaySessions.map((s, idx) => (
                      <div
                        key={s.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3.5 border border-gray-100 dark:border-white/5 shadow-sm flex items-center gap-3"
                      >
                        {/* Number badge */}
                        <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">
                            {todaySessions.length - idx}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {s.clientName ?? 'Sin nombre'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{s.serviceName}</span>
                            <PaymentBadge method={s.paymentMethod} />
                          </div>
                        </div>

                        {/* Price + commission */}
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-900 dark:text-white text-sm">{fmt(s.price)}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">+{fmt(s.commissionAmt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Daily summary */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-slate-400">Revenue total</span>
                        <span className="font-black text-gray-900 dark:text-white">{fmt(todayRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-slate-400">Tu ganancia ({barber.commissionPct}%)</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">{fmt(todayCommission)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Cerrar turno — siempre visible cuando hay turno activo */}
              {activeShift && (
                <button
                  onClick={() => setShowCloseModal(true)}
                  className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 active:scale-[0.98] text-white font-bold text-sm transition-all border border-slate-700 dark:border-white/10 flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Cerrar turno
                </button>
              )}
            </div>
          )}

          {/* ─── TAB: HISTORIAL ───────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div className="space-y-3">

              {/* Selector día/mes */}
              <div className="flex gap-2 bg-gray-100 dark:bg-slate-900 p-1 rounded-xl">
                {(['day', 'month'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                      historyFilter === f
                        ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-slate-400'
                    }`}
                  >
                    {f === 'day' ? 'Por día' : 'Por mes'}
                  </button>
                ))}
              </div>

              {/* Navegador de fecha */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center gap-2 px-3 py-2.5">
                <button
                  onClick={() => historyFilter === 'day' ? shiftDay(-1) : shiftMonth(-1)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-400 transition-colors active:scale-90 shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex-1 text-center">
                  {historyFilter === 'day' ? (
                    <>
                      <input
                        type="date"
                        value={historyDay}
                        onChange={e => setHistoryDay(e.target.value)}
                        max={today}
                        className="bg-transparent text-gray-900 dark:text-white text-sm font-bold text-center focus:outline-none w-full cursor-pointer"
                      />
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 capitalize mt-0.5">{dayLabel}</p>
                    </>
                  ) : (
                    <>
                      <input
                        type="month"
                        value={historyMonth}
                        onChange={e => setHistoryMonth(e.target.value)}
                        max={today.slice(0, 7)}
                        className="bg-transparent text-gray-900 dark:text-white text-sm font-bold text-center focus:outline-none w-full cursor-pointer"
                      />
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 capitalize mt-0.5">{monthLabel}</p>
                    </>
                  )}
                </div>

                <button
                  onClick={() => historyFilter === 'day' ? shiftDay(1) : shiftMonth(1)}
                  disabled={historyFilter === 'day' ? historyDay >= today : historyMonth >= today.slice(0, 7)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-400 transition-colors active:scale-90 disabled:opacity-30 shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Period summary */}
              {historySessions.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-3">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                      Resumen del período
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-center mb-3">
                      <div>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{historySessions.length}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">cortes</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{fmtCompact(historyRevenue)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">revenue</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{fmtCompact(historyCommission)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">ganancia</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 dark:border-white/5 pt-3 grid grid-cols-3 gap-2">
                      {[
                        { label: 'Efectivo', value: historyCash, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                        { label: 'Tarjeta',   value: historyCard, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                        { label: 'Transfer.',  value: historyTransfer, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} className={`${bg} rounded-xl py-2.5 text-center`}>
                          <p className={`text-sm font-black ${color}`}>{fmtCompact(value)}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sessions list */}
              {historySessions.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-white/5 shadow-sm text-center">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-200 dark:text-slate-700" />
                  <p className="text-sm font-semibold text-gray-400 dark:text-slate-500">Sin cortes en este período</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                    Detalle de cortes
                  </p>
                  {historySessions.map(s => {
                    const time = new Date(s.startedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                    const date = historyFilter === 'month'
                      ? new Date(s.startedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                      : null;
                    return (
                      <div key={s.id} className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3.5 border border-gray-100 dark:border-white/5 shadow-sm flex items-center gap-3">
                        {/* Time / date badge */}
                        <div className="w-10 shrink-0 text-center">
                          {date && <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500">{date}</p>}
                          <p className="text-[11px] font-mono text-gray-400 dark:text-slate-500">{time}</p>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {s.clientName ?? 'Sin nombre'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{s.serviceName}</span>
                            <PaymentBadge method={s.paymentMethod} />
                          </div>
                        </div>

                        {/* Price + commission */}
                        <div className="text-right shrink-0">
                          <p className="font-black text-gray-900 dark:text-white text-sm">{fmt(s.price)}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">+{fmt(s.commissionAmt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Shift closings */}
              {historyClosings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                    Cierres de turno
                  </p>
                  {historyClosings.map(sc => (
                    <div key={sc.id} className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-4 border border-gray-100 dark:border-white/5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-black text-gray-900 dark:text-white capitalize">
                          {new Date(sc.shiftDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15 px-2.5 py-0.5 rounded-full">
                          Cerrado
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xl font-black text-gray-900 dark:text-white">{sc.totalCuts}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">cortes</p>
                        </div>
                        <div>
                          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{fmtCompact(sc.totalRevenue)}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">revenue</p>
                        </div>
                        <div>
                          <p className="text-xl font-black text-amber-600 dark:text-amber-400">{fmtCompact(sc.totalCommission)}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-0.5">ganancia</p>
                        </div>
                      </div>
                      {sc.expensesCash > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-white/5 flex justify-between text-xs">
                          <span className="text-gray-400 dark:text-slate-500">Gastos efectivo</span>
                          <span className="font-bold text-red-500">-{fmt(sc.expensesCash)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── FAB: Registrar corte ─────────────────────────────────────────── */}
      {activeShift && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-90 shadow-xl shadow-amber-500/40 flex items-center justify-center transition-all"
            aria-label="Registrar corte"
          >
            <Plus className="w-7 h-7 text-white" />
          </button>
        </div>
      )}

      {/* ── BOTTOM NAVIGATION ────────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-gray-100 dark:border-white/10">
        <div className="flex max-w-2xl mx-auto">
          {([
            { id: 'today',   label: 'Hoy',       Icon: Scissors },
            { id: 'history', label: 'Historial',  Icon: Calendar },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all active:scale-95 ${
                activeTab === id
                  ? 'text-amber-500'
                  : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeTab === id ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[10px] font-bold">{label}</span>
              {activeTab === id && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-b-full" />
              )}
            </button>
          ))}
        </div>
        {/* Safe area spacer */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {showRegisterModal && barber && (
        <RegisterSessionModal
          barber={barber}
          services={shopServices}
          onSave={registerSession}
          onClose={() => setShowRegisterModal(false)}
        />
      )}

      {showCloseModal && activeShift && (
        <ShiftClosingModal
          closing={activeShift}
          todaySessions={todaySessions}
          onClose={closeShift}
          onDismiss={() => setShowCloseModal(false)}
        />
      )}
    </div>
  );
};

export default BarberPortal;
