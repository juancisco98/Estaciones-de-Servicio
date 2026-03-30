import React, { useState, useMemo } from 'react';
import {
  Wallet, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  Scissors, DollarSign, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { BarbershopFinancials, NetworkFinancialSummary } from '../types';

interface FinancesViewProps {
  getFinancialsByBarbershop: (dateFrom?: string, dateTo?: string) => BarbershopFinancials[];
  getNetworkFinancials: (dateFrom?: string, dateTo?: string) => NetworkFinancialSummary;
}

const fmt = (n: number) =>
  `$${Math.abs(n).toLocaleString('es-AR')}`;

const fmtCompact = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `$${(Math.abs(n) / 1_000_000).toFixed(2)}M`
    : Math.abs(n) >= 1_000
    ? `$${(Math.abs(n) / 1_000).toFixed(1)}k`
    : fmt(n);

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const FinancesView: React.FC<FinancesViewProps> = ({
  getFinancialsByBarbershop,
  getNetworkFinancials,
}) => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());

  // Rango del mes seleccionado
  const { dateFrom, dateTo } = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      dateFrom: `${selectedMonth}-01`,
      dateTo: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [selectedMonth]);

  const financials = getFinancialsByBarbershop(dateFrom, dateTo);
  const summary    = getNetworkFinancials(dateFrom, dateTo);

  const monthLabel = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  })();

  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  };

  const toggleShop = (id: string) => {
    setExpandedShops(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalEgresos = summary.totalCommissions + summary.totalExpenses;
  const netPositive  = summary.netOwnerRevenue >= 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── HEADER ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white">Finanzas</h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">Resumen financiero de la red</p>
            </div>
          </div>

          {/* Navegador de mes */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/10 rounded-2xl px-2 py-1.5 shadow-sm">
            <button
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-gray-900 dark:text-white px-2 min-w-[130px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              disabled={selectedMonth >= currentMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── RESUMEN GLOBAL ────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
          {/* Ingresó */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              Ingresó este mes
            </p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-black text-gray-900 dark:text-white">
                  {fmtCompact(summary.totalRevenue)}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                    <Scissors className="w-3.5 h-3.5" />
                    {summary.totalCuts} cortes
                  </span>
                  <span className="text-gray-300 dark:text-slate-700">·</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {summary.totalShifts} turnos cerrados
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* Salió */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 space-y-2.5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              Salió este mes
            </p>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-sm text-gray-600 dark:text-slate-300">
                  Comisiones barberos <span className="text-xs text-gray-400 dark:text-slate-500">(pagadas diario)</span>
                </span>
              </div>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                −{fmt(summary.totalCommissions)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-sm text-gray-600 dark:text-slate-300">Gastos operativos</span>
              </div>
              <span className="text-sm font-bold text-red-500 dark:text-red-400">
                −{fmt(summary.totalExpenses)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-white/5">
              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">Total egresos</span>
              <span className="text-sm font-black text-red-600 dark:text-red-400">
                −{fmt(totalEgresos)}
              </span>
            </div>
          </div>

          {/* Ganancia neta */}
          <div className={`px-5 py-5 ${netPositive ? 'bg-emerald-50 dark:bg-emerald-500/5' : 'bg-red-50 dark:bg-red-500/5'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                  Ganancia neta del dueño
                </p>
                <p className={`text-4xl font-black ${netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {netPositive ? '' : '−'}{fmtCompact(summary.netOwnerRevenue)}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                  Revenue − Comisiones − Gastos
                </p>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                netPositive
                  ? 'bg-emerald-100 dark:bg-emerald-500/15'
                  : 'bg-red-100 dark:bg-red-500/15'
              }`}>
                {netPositive
                  ? <TrendingUp className="w-6 h-6 text-emerald-500" />
                  : <TrendingDown className="w-6 h-6 text-red-500" />
                }
              </div>
            </div>
          </div>
        </div>

        {/* ── NOTA ANTI-FUGAS ───────────────────────────────────────── */}
        {summary.totalCuts === 0 && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Sin cortes registrados en {monthLabel}. Asegurate que los barberos hayan cerrado sus turnos para que los gastos aparezcan.
            </p>
          </div>
        )}

        {/* ── POR BARBERÍA ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">
            Desglose por barbería
          </p>

          {financials.map(shop => {
            const isExpanded   = expandedShops.has(shop.barbershopId);
            const shopNet      = shop.netOwnerRevenue;
            const shopPositive = shopNet >= 0;
            const hasExpenses  = shop.expensesDetail.length > 0;
            const hasActivity  = shop.totalCuts > 0 || shop.totalShifts > 0;

            return (
              <div
                key={shop.barbershopId}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden"
              >
                {/* Card header — siempre visible */}
                <button
                  onClick={() => toggleShop(shop.barbershopId)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Scissors className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-black text-sm text-gray-900 dark:text-white truncate">{shop.barbershopName}</p>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500">
                        {shop.totalCuts} cortes · {shop.totalShifts} turnos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-black px-2.5 py-1 rounded-xl ${
                      shopPositive
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
                    }`}>
                      {shopPositive ? '' : '−'}{fmtCompact(shopNet)}
                    </span>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                    }
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-white/5">

                    {/* Flujo de dinero */}
                    <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-gray-100 dark:border-white/5">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Revenue</p>
                        <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{fmtCompact(shop.totalRevenue)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Comisiones</p>
                        <p className="text-base font-black text-amber-600 dark:text-amber-400">−{fmtCompact(shop.totalCommissions)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Gastos</p>
                        <p className="text-base font-black text-red-500 dark:text-red-400">−{fmtCompact(shop.totalExpenses)}</p>
                      </div>
                    </div>

                    {/* Barberos */}
                    {hasActivity && shop.barberBreakdown.filter(b => b.cuts > 0 || b.shifts.length > 0).length > 0 && (
                      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                          Barberos
                        </p>
                        <div className="space-y-3">
                          {shop.barberBreakdown.filter(b => b.cuts > 0 || b.shifts.length > 0).map((b, idx) => (
                            <div key={b.barberId} className="flex items-start gap-3">
                              <span className="text-[10px] font-black text-gray-300 dark:text-slate-600 w-4 text-center shrink-0 pt-0.5">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{b.barberName}</p>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                      <p className="text-xs font-bold text-gray-900 dark:text-white">{fmt(b.revenue)}</p>
                                      <p className="text-[10px] text-gray-400 dark:text-slate-500">{b.cuts} cortes</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{fmt(b.commission)}</p>
                                      <p className="text-[10px] text-gray-400 dark:text-slate-500">comisión</p>
                                    </div>
                                  </div>
                                </div>
                                {/* Progress bar de revenue relativo */}
                                {shop.totalRevenue > 0 && (
                                  <div className="mt-1.5 h-1 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-400 dark:bg-amber-500 rounded-full"
                                      style={{ width: `${Math.round((b.revenue / shop.totalRevenue) * 100)}%` }}
                                    />
                                  </div>
                                )}
                                {/* Horarios de turno */}
                                {b.shifts.length > 0 && (
                                  <div className="mt-1.5 space-y-0.5">
                                    {b.shifts.map((sh, si) => {
                                      const dateLabel = new Date(sh.shiftDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' });
                                      const startHour = sh.startedAt
                                        ? new Date(sh.startedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                                        : '--:--';
                                      const closeHour = sh.closedAt
                                        ? new Date(sh.closedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                                        : '--:--';
                                      return (
                                        <p key={si} className="text-[10px] font-mono text-gray-400 dark:text-slate-500">
                                          {dateLabel} · {startHour} → {closeHour}
                                        </p>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Gastos del mes */}
                    {hasExpenses && (
                      <div className="px-5 py-4">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                          Gastos registrados
                        </p>
                        <div className="space-y-1.5">
                          {shop.expensesDetail.map((e, i) => (
                            <div key={i} className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                <span className="text-sm text-gray-600 dark:text-slate-300">{e.description}</span>
                              </div>
                              <span className="text-sm font-bold text-red-500 dark:text-red-400">−{fmt(e.amount)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-white/5 mt-2">
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">Total gastos</span>
                            <span className="text-sm font-black text-red-600 dark:text-red-400">−{fmt(shop.totalExpenses)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {!hasActivity && (
                      <div className="px-5 py-5 text-center">
                        <p className="text-sm text-gray-400 dark:text-slate-500">Sin actividad en {monthLabel}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── FÓRMULA ANTI-FUGAS ────────────────────────────────────── */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-gray-100 dark:border-white/5 rounded-2xl px-5 py-4">
          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
            Verificación de caja
          </p>
          <div className="space-y-1.5 font-mono text-sm">
            <div className="flex justify-between text-gray-700 dark:text-slate-300">
              <span>Revenue generado</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{fmt(summary.totalRevenue)}</span>
            </div>
            <div className="flex justify-between text-gray-700 dark:text-slate-300">
              <span>− Comisiones pagadas</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">−{fmt(summary.totalCommissions)}</span>
            </div>
            <div className="flex justify-between text-gray-700 dark:text-slate-300">
              <span>− Gastos operativos</span>
              <span className="text-red-500 font-bold">−{fmt(summary.totalExpenses)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-white/10 font-bold">
              <span className="text-gray-900 dark:text-white">= Debería estar en tu bolsillo</span>
              <span className={netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}>
                {netPositive ? '' : '−'}{fmt(summary.netOwnerRevenue)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FinancesView;
