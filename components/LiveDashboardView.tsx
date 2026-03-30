import React, { useMemo } from 'react';
import { Activity, Scissors, DollarSign, TrendingUp, Receipt, MapPin, Clock, Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { Barbershop, Barber, HaircutSession, ShiftClosing } from '../types';
import { PAYMENT_METHOD_LABELS } from '../constants';

interface DailySummary { cuts: number; revenue: number; activeBarbers: number; }

interface LiveDashboardViewProps {
  barbershops: Barbershop[];
  barbers: Barber[];
  sessions: HaircutSession[];
  shiftClosings: ShiftClosing[];
  getDailySummary: (barbershopId: string) => DailySummary;
  onViewOnMap: (shop: Barbershop) => void;
}

const fmt = (n: number) => `$${n.toLocaleString('es-AR')}`;

const PaymentIcon: React.FC<{ method: string }> = ({ method }) => {
  if (method === 'CASH') return <Banknote className="w-3.5 h-3.5 text-emerald-500" />;
  if (method === 'CARD') return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
  return <ArrowLeftRight className="w-3.5 h-3.5 text-violet-500" />;
};

const LiveDashboardView: React.FC<LiveDashboardViewProps> = ({
  barbershops, barbers, sessions, shiftClosings, getDailySummary, onViewOnMap,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const todaySessions = useMemo(() =>
    sessions.filter(s => s.startedAt.slice(0, 10) === today)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessions, today]
  );

  const todayClosings = useMemo(() =>
    shiftClosings.filter(c => c.shiftDate === today),
    [shiftClosings, today]
  );

  const globalStats = useMemo(() => ({
    cuts: todaySessions.length,
    revenue: todaySessions.reduce((s, x) => s + x.price, 0),
    commission: todaySessions.reduce((s, x) => s + x.commissionAmt, 0),
    expenses: todayClosings.reduce((s, c) => s + c.expensesCash, 0),
    cash: todaySessions.filter(s => s.paymentMethod === 'CASH').reduce((s, x) => s + x.price, 0),
    card: todaySessions.filter(s => s.paymentMethod === 'CARD').reduce((s, x) => s + x.price, 0),
    transfer: todaySessions.filter(s => s.paymentMethod === 'TRANSFER').reduce((s, x) => s + x.price, 0),
  }), [todaySessions, todayClosings]);

  const activeShops = barbershops.filter(b => b.isActive);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-y-auto">

      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">En Vivo</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · actualización en tiempo real
            </p>
          </div>
          {/* Indicador live */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">LIVE</span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* Stats globales hoy */}
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Red Rufianes — Hoy</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-4">
              <Scissors className="w-5 h-5 text-amber-500 mb-2" />
              <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{globalStats.cuts}</p>
              <p className="text-xs text-amber-600 font-semibold mt-0.5">Cortes hoy</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4">
              <DollarSign className="w-5 h-5 text-emerald-500 mb-2" />
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {globalStats.revenue >= 1000 ? `$${(globalStats.revenue / 1000).toFixed(1)}k` : fmt(globalStats.revenue)}
              </p>
              <p className="text-xs text-emerald-600 font-semibold mt-0.5">Revenue</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-4">
              <TrendingUp className="w-5 h-5 text-indigo-500 mb-2" />
              <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400">
                {globalStats.commission >= 1000 ? `$${(globalStats.commission / 1000).toFixed(1)}k` : fmt(globalStats.commission)}
              </p>
              <p className="text-xs text-indigo-600 font-semibold mt-0.5">Comisiones</p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl p-4">
              <Receipt className="w-5 h-5 text-red-500 mb-2" />
              <p className="text-2xl font-black text-red-700 dark:text-red-400">{fmt(globalStats.expenses)}</p>
              <p className="text-xs text-red-600 font-semibold mt-0.5">Gastos</p>
            </div>
          </div>
        </div>

        {/* Desglose por método de pago */}
        {globalStats.cuts > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-white/10">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Método de pago</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{fmt(globalStats.cash)}</p>
                <p className="text-xs text-emerald-600 font-medium mt-0.5">Efectivo</p>
              </div>
              <div className="text-center">
                <p className="text-base font-black text-blue-600 dark:text-blue-400">{fmt(globalStats.card)}</p>
                <p className="text-xs text-blue-600 font-medium mt-0.5">Tarjeta</p>
              </div>
              <div className="text-center">
                <p className="text-base font-black text-violet-600 dark:text-violet-400">{fmt(globalStats.transfer)}</p>
                <p className="text-xs text-violet-600 font-medium mt-0.5">Transferencia</p>
              </div>
            </div>
          </div>
        )}

        {/* Grid de barberías */}
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Estado por barbería</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeShops.map(shop => {
              const summary = getDailySummary(shop.id);
              const openShift = todayClosings.find(c => c.barbershopId === shop.id && c.status === 'OPEN');
              const closedShifts = todayClosings.filter(c => c.barbershopId === shop.id && c.status === 'CLOSED');
              const shopBarbers = barbers.filter(b => b.barbershopId === shop.id && b.isActive);

              const shiftBadge = openShift
                ? { label: 'Turno abierto', cls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' }
                : closedShifts.length > 0
                  ? { label: `${closedShifts.length} turno${closedShifts.length > 1 ? 's' : ''} cerrado${closedShifts.length > 1 ? 's' : ''}`, cls: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' }
                  : { label: 'Sin turno hoy', cls: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400' };

              return (
                <div
                  key={shop.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100 dark:border-white/10 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 dark:text-white truncate">{shop.name}</p>
                      {shop.neighborhood && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <p className="text-xs text-gray-400 dark:text-slate-500">{shop.neighborhood}</p>
                        </div>
                      )}
                    </div>
                    <span className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${shiftBadge.cls}`}>
                      {shiftBadge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <p className="text-lg font-black text-gray-900 dark:text-white">{summary.cuts}</p>
                      <p className="text-[10px] text-gray-400 font-medium">cortes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {summary.revenue >= 1000 ? `$${(summary.revenue / 1000).toFixed(1)}k` : fmt(summary.revenue)}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium">revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-black text-gray-700 dark:text-slate-300">{summary.activeBarbers}</p>
                      <p className="text-[10px] text-gray-400 font-medium">barberos</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-1">
                      {shopBarbers.slice(0, 4).map(b => (
                        <div
                          key={b.id}
                          title={b.name}
                          className="w-6 h-6 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-black text-white"
                        >
                          {b.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {shopBarbers.length > 4 && (
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-gray-500">
                          +{shopBarbers.length - 4}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onViewOnMap(shop)}
                      className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                    >
                      Ver en mapa →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Turnos activos ahora */}
        {todayClosings.filter(c => c.status === 'OPEN').length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Turnos activos ahora</p>
            <div className="space-y-2">
              {todayClosings.filter(c => c.status === 'OPEN').map(shift => {
                const barber = barbers.find(b => b.id === shift.barberId);
                const shop = barbershops.find(s => s.id === shift.barbershopId);
                const shiftSessions = todaySessions.filter(s => s.barberId === shift.barberId);
                const shiftRevenue = shiftSessions.reduce((sum, s) => sum + s.price, 0);
                const startTime = shift.startedAt
                  ? new Date(shift.startedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                  : '—';

                return (
                  <div key={shift.id} className="bg-amber-50 dark:bg-amber-500/10 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-black text-white">
                        {barber?.name.charAt(0).toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{barber?.name ?? 'Barbero'}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{shop?.name ?? 'Barbería'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{shiftSessions.length} cortes · {fmt(shiftRevenue)}</p>
                      <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>desde {startTime}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feed de sesiones en vivo */}
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
            Últimas sesiones{todaySessions.length > 0 && ` (${todaySessions.length} hoy)`}
          </p>
          {todaySessions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-gray-100 dark:border-white/10">
              <Scissors className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
              <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">Sin actividad por ahora</p>
              <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">Los cortes aparecerán aquí en tiempo real</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
              {todaySessions.slice(0, 20).map((session, idx) => {
                const barber = barbers.find(b => b.id === session.barberId);
                const shop = barbershops.find(s => s.id === session.barbershopId);
                const time = new Date(session.startedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={session.id}
                    className={`flex items-center gap-3 px-4 py-3 ${idx < todaySessions.slice(0, 20).length - 1 ? 'border-b border-gray-50 dark:border-white/5' : ''}`}
                  >
                    <span className="text-xs text-gray-400 dark:text-slate-500 font-mono w-10 shrink-0">{time}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{session.serviceName}</span>
                        {session.clientName && (
                          <span className="text-xs text-gray-400 dark:text-slate-500 truncate">· {session.clientName}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{barber?.name ?? '—'} · {shop?.name ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PaymentIcon method={session.paymentMethod} />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(session.price)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default LiveDashboardView;
