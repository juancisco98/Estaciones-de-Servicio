import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Fuel, DollarSign, Gauge } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { Station, StationMetrics, StationDayMetrics, NetworkSummary, PeriodSummary } from '../types';
import { getArgentinaToday } from '../utils/dateUtils';

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
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const gridColor = isDark ? '#334155' : '#f0f0f0';
    const tickColor = isDark ? '#94a3b8' : '#6b7280';
    const tooltipBg = isDark ? '#1e293b' : '#ffffff';
    const tooltipBorder = isDark ? '#334155' : '#e5e7eb';
    const [period, setPeriod]         = useState<Period>('week');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo]     = useState('');
    const [selectedStationId, setSelectedStationId] = useState<string>('');

    const today = getArgentinaToday();

    const { dateFrom, dateTo } = useMemo(() => {
        if (period === 'today') return { dateFrom: today, dateTo: today };
        if (period === 'week') {
            const d = new Date(today + 'T12:00:00');
            d.setDate(d.getDate() - 6);
            return { dateFrom: d.toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' }), dateTo: today };
        }
        if (period === 'month') {
            return { dateFrom: today.slice(0, 8) + '01', dateTo: today };
        }
        return { dateFrom: customFrom || today, dateTo: customTo || today };
    }, [period, customFrom, customTo, today]);

    const networkSummary = useMemo(() => getNetworkSummary(dateFrom, dateTo), [getNetworkSummary, dateFrom, dateTo]);

    const stationMetrics = useMemo(() =>
        stations
            .filter(s => s.isActive)
            .filter(s => !selectedStationId || s.id === selectedStationId)
            .map(s => ({ ...getStationMetrics(s.id, dateFrom, dateTo), stationName: s.name }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue),
    [stations, getStationMetrics, dateFrom, dateTo, selectedStationId]);

    const chartStationId = selectedStationId || (stationMetrics.find(m => m.totalTransactions > 0)?.stationId ?? '');
    const timeSeries     = useMemo(() =>
        chartStationId ? getDailyTimeSeries(chartStationId, dateFrom, dateTo) : [],
    [getDailyTimeSeries, chartStationId, dateFrom, dateTo]);

    const barChartData = stationMetrics
        .filter(m => m.totalRevenue > 0)
        .slice(0, 10)
        .map(m => ({ name: m.stationName.slice(0, 12), revenue: m.totalRevenue, liters: m.fuelLiters }));

    const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#06b6d4'];
    const pieData = [
        { name: 'Efectivo', value: networkSummary.totalCash },
        { name: 'Tarjeta', value: networkSummary.totalCard },
        { name: 'Cta. Corriente', value: networkSummary.totalAccount },
        { name: 'Digital (QR)', value: networkSummary.totalDigital },
    ].filter(d => d.value > 0);

    const multiStation = barChartData.length >= 3;

    const periodLabel = period === 'today' ? 'Hoy'
        : period === 'week'  ? 'Últimos 7 días'
        : period === 'month' ? 'Este mes'
        : 'Período personalizado';

    const activeStations = stations.filter(s => s.isActive);
    const selectedStationName = selectedStationId
        ? stations.find(s => s.id === selectedStationId)?.name ?? ''
        : `Red completa (${activeStations.length} estaciones)`;

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-y-auto">
            <div className="p-6 pb-5 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-6 h-6 text-amber-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Analytics</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(['today', 'week', 'month', 'custom'] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className="px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-all duration-150 active:scale-95"
                            style={period === p ? {
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: 'white',
                                boxShadow: '0 4px 12px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.20)',
                            } : {
                                background: '',
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
                                className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none" />
                            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none" />
                        </div>
                    )}
                    <select
                        value={selectedStationId}
                        onChange={e => setSelectedStationId(e.target.value)}
                        className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400 mt-2"
                    >
                        <option value="">Todas las estaciones</option>
                        {stations.filter(s => s.isActive).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="p-6 space-y-6">
                <div>
                    <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                        {periodLabel} — {selectedStationName}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Ventas totales',      value: fmt(networkSummary.totalRevenue),      icon: DollarSign, colorClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                            { label: 'Combustible',         value: `${(networkSummary.totalFuelLiters / 1000).toFixed(1)}K L`, icon: Fuel, colorClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                            { label: 'Transacciones',       value: networkSummary.totalTransactions.toLocaleString('es-AR'), icon: TrendingUp, colorClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                            { label: 'Estaciones activas',  value: networkSummary.activeStations,         icon: Gauge, colorClass: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
                        ].map(({ label, value, icon: Icon, colorClass }) => (
                            <div key={label} className={`rounded-2xl p-5 ${colorClass.split(' ').slice(0, 2).join(' ')}`}>
                                <Icon className={`w-6 h-6 mb-2 ${colorClass.split(' ').slice(2).join(' ')}`} />
                                <p className={`text-3xl font-black ${colorClass.split(' ').slice(2).join(' ')}`}>{value}</p>
                                <p className="text-xs font-semibold mt-0.5 text-gray-500 dark:text-slate-400">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                    <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Desglose por método de pago</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Efectivo',      value: networkSummary.totalCash,    bgClass: 'bg-emerald-50 dark:bg-emerald-500/10', valueClass: 'text-emerald-700 dark:text-emerald-400', labelClass: 'text-emerald-600 dark:text-emerald-300' },
                            { label: 'Tarjeta',       value: networkSummary.totalCard,    bgClass: 'bg-blue-50 dark:bg-blue-500/10',       valueClass: 'text-blue-700 dark:text-blue-400',       labelClass: 'text-blue-600 dark:text-blue-300' },
                            { label: 'Cta. Corriente', value: networkSummary.totalAccount, bgClass: 'bg-violet-50 dark:bg-violet-500/10',   valueClass: 'text-violet-700 dark:text-violet-400',   labelClass: 'text-violet-600 dark:text-violet-300' },
                            { label: 'Digital (QR)',   value: networkSummary.totalDigital, bgClass: 'bg-cyan-50 dark:bg-cyan-500/10',       valueClass: 'text-cyan-700 dark:text-cyan-400',       labelClass: 'text-cyan-600 dark:text-cyan-300' },
                        ].map(({ label, value, bgClass, valueClass, labelClass }) => (
                            <div key={label} className={`${bgClass} rounded-xl p-4 text-center`}>
                                <p className={`text-lg font-black ${valueClass}`}>{fmt(value)}</p>
                                <p className={`text-xs ${labelClass} font-semibold mt-0.5`}>{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
                {pieData.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Distribucion por metodo de pago</h3>
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <ResponsiveContainer width={200} height={200}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[['Efectivo', 'Tarjeta', 'Cta. Corriente', 'Digital (QR)'].indexOf(pieData[i].name)] ?? PIE_COLORS[0]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => [fmt(value)]}
                                        contentStyle={{ borderRadius: '12px', border: `1px solid ${tooltipBorder}`, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', backgroundColor: tooltipBg, color: isDark ? '#e2e8f0' : '#111827' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-2">
                                {pieData.map((d, i) => {
                                    const total = pieData.reduce((s, x) => s + x.value, 0);
                                    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
                                    const colorIdx = ['Efectivo', 'Tarjeta', 'Cta. Corriente', 'Digital (QR)'].indexOf(d.name);
                                    return (
                                        <div key={d.name} className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[colorIdx] ?? PIE_COLORS[0] }} />
                                            <span className="text-sm text-gray-600 dark:text-slate-300 flex-1">{d.name}</span>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(d.value)}</span>
                                            <span className="text-xs text-gray-400 dark:text-slate-500 w-12 text-right">{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                {multiStation && barChartData.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-4">Ventas por estacion</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={barChartData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: tickColor }} />
                                <YAxis tick={{ fontSize: 10, fill: tickColor }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip
                                    formatter={(value: number) => [fmt(value), 'Ventas']}
                                    contentStyle={{ borderRadius: '12px', border: `1px solid ${tooltipBorder}`, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', backgroundColor: tooltipBg, color: isDark ? '#e2e8f0' : '#111827' }}
                                />
                                <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {timeSeries.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">Evolucion diaria</h3>
                            <select
                                value={chartStationId}
                                onChange={e => setSelectedStationId(e.target.value)}
                                className="text-xs rounded-xl bg-gray-100 dark:bg-slate-800 border-0 text-gray-600 dark:text-gray-300 px-4 py-2.5 min-h-[44px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                            >
                                {activeStations.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Ventas diarias en pesos</p>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={timeSeries} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: tickColor }} tickFormatter={d => { const [, m, day] = d.split('-'); return `${day}/${m}`; }} />
                                <YAxis tick={{ fontSize: 10, fill: tickColor }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip
                                    labelFormatter={d => { const [, m, day] = String(d).split('-'); return `${day}/${m}`; }}
                                    formatter={(value: number, name: string) => [
                                        name === 'totalRevenue' ? fmt(value) : `${value.toLocaleString('es-AR')} L`,
                                        name === 'totalRevenue' ? 'Ventas' : 'Combustible',
                                    ]}
                                    contentStyle={{ borderRadius: '12px', border: `1px solid ${tooltipBorder}`, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', backgroundColor: tooltipBg, color: isDark ? '#e2e8f0' : '#111827' }}
                                />
                                <Area type="monotone" dataKey="totalRevenue" stroke="#f59e0b" fill="url(#revenueGrad)" strokeWidth={2} dot={timeSeries.length <= 14} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {multiStation && <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
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
                                        <td colSpan={6} className="py-12 text-center text-gray-400 dark:text-slate-500 text-base">Sin actividad en el período seleccionado</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
