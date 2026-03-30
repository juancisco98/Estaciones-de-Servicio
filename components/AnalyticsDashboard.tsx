import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Fuel, DollarSign, Gauge } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Station, StationMetrics, StationDayMetrics, NetworkSummary, PeriodSummary } from '../types';

type Period = 'today' | 'week' | 'month' | 'custom';

interface AnalyticsDashboardProps {
    stations: Station[];
    getStationMetrics: (stationId: string, dateFrom: string, dateTo: string) => StationMetrics;
    getDailyTimeSeries: (stationId: string, dateFrom: string, dateTo: string) => StationDayMetrics[];
    getNetworkSummary: (dateFrom: string, dateTo: string) => NetworkSummary;
    getPeriodSummary: (stationId: string, dateFrom: string, dateTo: string) => PeriodSummary;
}

const fmt = (v: number) => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
    ? `$${(v / 1000).toFixed(0)}K`
    : `$${v.toLocaleString('es-AR')}`;

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
    stations,
    getStationMetrics,
    getDailyTimeSeries,
    getNetworkSummary,
    getPeriodSummary,
}) => {
    const [period, setPeriod]         = useState<Period>('week');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo]     = useState('');
    const [selectedStationId, setSelectedStationId] = useState<string>('');

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
        return { dateFrom: customFrom || today, dateTo: customTo || today };
    }, [period, customFrom, customTo, today]);

    const networkSummary = useMemo(() => getNetworkSummary(dateFrom, dateTo), [getNetworkSummary, dateFrom, dateTo]);

    const stationMetrics = useMemo(() =>
        stations
            .filter(s => s.isActive)
            .map(s => ({ ...getStationMetrics(s.id, dateFrom, dateTo), stationName: s.name }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue),
    [stations, getStationMetrics, dateFrom, dateTo]);

    // Time series for selected station or first with data
    const chartStationId = selectedStationId || (stationMetrics.find(m => m.totalTransactions > 0)?.stationId ?? '');
    const timeSeries     = useMemo(() =>
        chartStationId ? getDailyTimeSeries(chartStationId, dateFrom, dateTo) : [],
    [getDailyTimeSeries, chartStationId, dateFrom, dateTo]);

    const barChartData = stationMetrics
        .filter(m => m.totalRevenue > 0)
        .slice(0, 10)
        .map(m => ({ name: m.stationName.slice(0, 12), revenue: m.totalRevenue, liters: m.fuelLiters }));

    const periodLabel = period === 'today' ? 'Hoy'
        : period === 'week'  ? 'Últimos 7 días'
        : period === 'month' ? 'Este mes'
        : 'Período personalizado';

    const activeStations = stations.filter(s => s.isActive);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-y-auto">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-6 h-6 text-amber-500" />
                    <h1 className="text-xl font-black text-gray-900 dark:text-white">Analytics</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(['today', 'week', 'month', 'custom'] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95"
                            style={period === p ? {
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: 'white',
                                boxShadow: '0 4px 12px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.20)',
                            } : {
                                background: 'rgba(255,255,255,0.72)',
                                backdropFilter: 'blur(8px)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.80)',
                            }}
                        >
                            <span className={period !== p ? 'text-gray-600 dark:text-slate-300' : ''}>
                                {p === 'today' ? 'Hoy' : p === 'week' ? 'Esta semana' : p === 'month' ? 'Este mes' : 'Personalizado'}
                            </span>
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
                {/* Network KPIs */}
                <div>
                    <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                        {periodLabel} — Red completa ({activeStations.length} estaciones)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Ventas totales',      value: fmt(networkSummary.totalRevenue),      icon: DollarSign, colorClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                            { label: 'Combustible',         value: `${(networkSummary.totalFuelLiters / 1000).toFixed(1)}K L`, icon: Fuel, colorClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                            { label: 'Transacciones',       value: networkSummary.totalTransactions.toLocaleString('es-AR'), icon: TrendingUp, colorClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                            { label: 'Estaciones activas',  value: networkSummary.activeStations,         icon: Gauge, colorClass: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
                        ].map(({ label, value, icon: Icon, colorClass }) => (
                            <div key={label} className={`rounded-2xl p-4 ${colorClass.split(' ').slice(0, 2).join(' ')}`}>
                                <Icon className={`w-5 h-5 mb-2 ${colorClass.split(' ').slice(2).join(' ')}`} />
                                <p className={`text-xl font-black ${colorClass.split(' ').slice(2).join(' ')}`}>{value}</p>
                                <p className="text-xs font-semibold mt-0.5 text-gray-500 dark:text-slate-400">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Payment breakdown */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Desglose por método de pago</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Efectivo',     value: networkSummary.totalCash,    color: 'emerald' },
                            { label: 'Tarjeta',      value: networkSummary.totalCard,    color: 'blue' },
                            { label: 'Cta. Corriente', value: networkSummary.totalAccount, color: 'violet' },
                            { label: 'Digital (QR)', value: networkSummary.totalDigital, color: 'cyan' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`bg-${color}-50 dark:bg-${color}-500/10 rounded-xl p-3 text-center`}>
                                <p className={`text-base font-black text-${color}-700 dark:text-${color}-400`}>{fmt(value)}</p>
                                <p className={`text-xs text-${color}-600 dark:text-${color}-300 font-semibold mt-0.5`}>{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Revenue bar chart */}
                {barChartData.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Ventas por estación</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={barChartData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-slate-700" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip
                                    formatter={(value: number) => [fmt(value), 'Ventas']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                                />
                                <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Daily time series */}
                {timeSeries.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">Evolución diaria</h3>
                            <select
                                value={chartStationId}
                                onChange={e => setSelectedStationId(e.target.value)}
                                className="text-xs rounded-lg bg-gray-100 dark:bg-slate-800 border-0 text-gray-600 dark:text-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                            >
                                {activeStations.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={timeSeries} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-slate-700" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip
                                    formatter={(value: number, name: string) => [
                                        name === 'totalRevenue' ? fmt(value) : `${value.toLocaleString('es-AR')} L`,
                                        name === 'totalRevenue' ? 'Ventas' : 'Combustible',
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
                                />
                                <Area type="monotone" dataKey="totalRevenue" stroke="#f59e0b" fill="url(#revenueGrad)" strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Station ranking table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Ranking de estaciones</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">
                                    <th className="text-left pb-3">#</th>
                                    <th className="text-left pb-3">Estación</th>
                                    <th className="text-right pb-3">Ventas</th>
                                    <th className="text-right pb-3 hidden sm:table-cell">Combustible</th>
                                    <th className="text-right pb-3 hidden md:table-cell">Transacciones</th>
                                    <th className="text-right pb-3 hidden lg:table-cell">Prom. diario</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {stationMetrics.filter(m => m.totalTransactions > 0).map((m, idx) => {
                                    const pct = stationMetrics[0].totalRevenue > 0 ? (m.totalRevenue / stationMetrics[0].totalRevenue) * 100 : 0;
                                    return (
                                        <tr key={m.stationId}>
                                            <td className="py-3 font-black text-sm text-gray-300 dark:text-slate-600 pr-3">
                                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                            </td>
                                            <td className="py-3">
                                                <p className="font-semibold text-gray-900 dark:text-white">{m.stationName}</p>
                                                <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1 mt-1">
                                                    <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${pct}%` }} />
                                                </div>
                                            </td>
                                            <td className="py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{fmt(m.totalRevenue)}</td>
                                            <td className="py-3 text-right text-amber-600 dark:text-amber-400 hidden sm:table-cell">
                                                {m.fuelLiters.toLocaleString('es-AR', { maximumFractionDigits: 0 })} L
                                            </td>
                                            <td className="py-3 text-right text-gray-500 dark:text-slate-400 hidden md:table-cell">{m.totalTransactions}</td>
                                            <td className="py-3 text-right text-gray-500 dark:text-slate-400 hidden lg:table-cell">{fmt(m.avgRevenuePerDay)}</td>
                                        </tr>
                                    );
                                })}
                                {stationMetrics.every(m => m.totalTransactions === 0) && (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-slate-500">Sin actividad en el período seleccionado</td>
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
