import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Scissors, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Barbershop, Barber, BarbershopMetrics, PeriodSummary } from '../types';

type Period = 'today' | 'week' | 'month' | 'custom';

const COLOR_MAP: Record<string, { bg: string; icon: string; value: string; label: string }> = {
  amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',    icon: 'text-amber-500',   value: 'text-amber-700 dark:text-amber-400',   label: 'text-amber-600' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-500', value: 'text-emerald-700 dark:text-emerald-400', label: 'text-emerald-600' },
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-500/10',  icon: 'text-indigo-500',  value: 'text-indigo-700 dark:text-indigo-400',  label: 'text-indigo-600' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-500/10',  icon: 'text-violet-500',  value: 'text-violet-700 dark:text-violet-400',  label: 'text-violet-600' },
  blue:    { bg: 'bg-blue-50 dark:bg-blue-500/10',      icon: 'text-blue-500',    value: 'text-blue-700 dark:text-blue-400',      label: 'text-blue-600' },
};

interface AnalyticsDashboardProps {
  barbershops: Barbershop[];
  barbers: Barber[];
  getRevenueByBarbershop: (dateFrom?: string, dateTo?: string) => BarbershopMetrics[];
  getTopBarbers: (dateFrom?: string, dateTo?: string, limit?: number) => { barberId: string; name: string; revenue: number; cuts: number }[];
  getPeriodSummary: (dateFrom?: string, dateTo?: string) => PeriodSummary;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  barbershops, barbers,
  getRevenueByBarbershop, getTopBarbers, getPeriodSummary,
}) => {
  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const { dateFrom, dateTo } = useMemo(() => {
    if (period === 'today') return { dateFrom: today, dateTo: today };
    if (period === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    if (period === 'month') {
      const d = new Date();
      return { dateFrom: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, dateTo: today };
    }
    return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
  }, [period, customFrom, customTo, today]);

  const summary = getPeriodSummary(dateFrom, dateTo);
  const shopMetrics = getRevenueByBarbershop(dateFrom, dateTo);
  const topBarbers = getTopBarbers(dateFrom, dateTo, 8);

  // Datos para el gráfico de barrerías
  const chartData = shopMetrics
    .filter(m => m.totalCuts > 0)
    .map(m => ({ name: m.barbershopName.replace('Rufianes ', ''), revenue: m.totalRevenue, cortes: m.totalCuts }));

  const periodLabel = period === 'today' ? 'Hoy' : period === 'week' ? 'Últimos 7 días' : period === 'month' ? 'Este mes' : 'Período personalizado';

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-black text-gray-900 dark:text-white">Analytics</h1>
          </div>
        </div>

        {/* Selector de período */}
        <div className="flex gap-2 flex-wrap">
          {(['today', 'week', 'month', 'custom'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                period === p
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {p === 'today' ? 'Hoy' : p === 'week' ? 'Esta semana' : p === 'month' ? 'Este mes' : 'Personalizado'}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex gap-2 mt-2 w-full">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none" />
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none" />
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPIs globales */}
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">{periodLabel} — Red Rufianes</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Cortes', value: summary.totalCuts, icon: Scissors, color: 'amber', format: (v: number) => String(v) },
              { label: 'Revenue', value: summary.totalRevenue, icon: DollarSign, color: 'emerald', format: (v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString('es-AR')}` },
              { label: 'Comisiones', value: summary.totalCommission, icon: TrendingUp, color: 'indigo', format: (v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString('es-AR')}` },
              { label: 'Prom. x corte', value: summary.avgRevenuePerCut, icon: BarChart3, color: 'violet', format: (v: number) => `$${v.toLocaleString('es-AR')}` },
            ].map(({ label, value, icon: Icon, color, format }) => (
              <div key={label} className={`${COLOR_MAP[color].bg} rounded-2xl p-4`}>
                <Icon className={`w-5 h-5 ${COLOR_MAP[color].icon} mb-2`} />
                <p className={`text-xl font-black ${COLOR_MAP[color].value}`}>{format(value)}</p>
                <p className={`text-xs ${COLOR_MAP[color].label} font-semibold mt-0.5`}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Desglose por método de pago */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-white/10">
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Desglose por método de pago</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Efectivo', value: summary.totalCash, color: 'emerald' },
              { label: 'Tarjeta', value: summary.totalCard, color: 'blue' },
              { label: 'Transferencia', value: summary.totalTransfer, color: 'violet' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`${COLOR_MAP[color].bg} rounded-xl p-3 text-center`}>
                <p className={`text-base font-black ${COLOR_MAP[color].value}`}>
                  ${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString('es-AR')}
                </p>
                <p className={`text-xs ${COLOR_MAP[color].label} font-semibold mt-0.5`}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico por barbería */}
        {chartData.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-white/10">
            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Revenue por barbería</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-slate-700" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Revenue']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ranking de barberos */}
        {topBarbers.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-white/10">
            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Ranking de barberos</h3>
            <div className="space-y-3">
              {topBarbers.map((b, idx) => {
                const pct = topBarbers[0].revenue > 0 ? (b.revenue / topBarbers[0].revenue) * 100 : 0;
                const barber = barbers.find(br => br.id === b.barberId);
                const shop = barbershops.find(s => s.id === barber?.barbershopId);
                return (
                  <div key={b.barberId} className="flex items-center gap-3">
                    <span className={`w-6 text-center font-black text-sm ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-700' : 'text-gray-300'}`}>
                      #{idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{b.name}</span>
                          {shop && <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">{shop.name}</span>}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">${b.revenue.toLocaleString('es-AR')}</span>
                          <span className="text-xs text-gray-400 ml-2">{b.cuts} cortes</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabla por barbería */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-white/10">
          <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Detalle por barbería</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                  <th className="text-left pb-3">Barbería</th>
                  <th className="text-right pb-3">Cortes</th>
                  <th className="text-right pb-3">Revenue</th>
                  <th className="text-right pb-3">Comisiones</th>
                  <th className="text-right pb-3">Barbero top</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {shopMetrics.filter(m => m.totalCuts > 0).map(m => (
                  <tr key={m.barbershopId}>
                    <td className="py-3 font-semibold text-gray-900 dark:text-white">{m.barbershopName}</td>
                    <td className="py-3 text-right text-gray-700 dark:text-slate-300">{m.totalCuts}</td>
                    <td className="py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">${m.totalRevenue.toLocaleString('es-AR')}</td>
                    <td className="py-3 text-right text-amber-600 dark:text-amber-400">${m.totalCommission.toLocaleString('es-AR')}</td>
                    <td className="py-3 text-right text-gray-500 dark:text-slate-400 text-xs">{m.topBarberName ?? '—'}</td>
                  </tr>
                ))}
                {shopMetrics.every(m => m.totalCuts === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 dark:text-slate-500">Sin actividad en el período seleccionado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
