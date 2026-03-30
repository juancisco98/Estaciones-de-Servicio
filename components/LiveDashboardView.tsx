import React, { useMemo } from 'react';
import { Activity, AlertTriangle, Fuel, DollarSign, Gauge, TrendingUp, MapPin } from 'lucide-react';
import { Station, Alert, DailyClosing, StationMetrics } from '../types';
import { CLOSING_STATUS_COLORS, CLOSING_STATUS_LABELS } from '../constants';

interface LiveDashboardViewProps {
    stations: Station[];
    alerts: Alert[];
    dailyClosings: DailyClosing[];
    getStationMetrics: (stationId: string, dateFrom: string, dateTo: string) => StationMetrics;
    onViewOnMap: (station: Station) => void;
}

const today = new Date().toISOString().slice(0, 10);

const KpiCard: React.FC<{ label: string; value: string | number; sub?: string; icon: React.ReactNode; colorClass: string; glowColor?: string }> = ({
    label, value, sub, icon, colorClass, glowColor,
}) => (
    <div
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 flex items-start gap-3.5 lift cursor-default
                   border border-white/80 dark:border-white/8
                   transition-all duration-200"
        style={{
            boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)',
        }}
    >
        <div
            className={`p-2.5 rounded-xl shrink-0 ${colorClass}`}
            style={glowColor ? { boxShadow: `0 4px 12px ${glowColor}` } : {}}
        >
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
            <p className="text-xl font-black text-gray-900 dark:text-white leading-tight mt-0.5">{value}</p>
            {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
        </div>
    </div>
);

const StationRow: React.FC<{
    station: Station;
    metrics: StationMetrics;
    alertCount: number;
    closingStatus?: string;
    onViewOnMap: (s: Station) => void;
}> = ({ station, metrics, alertCount, closingStatus, onViewOnMap }) => {
    const dotClass =
        metrics.alertLevel === 'CRITICAL' ? 'bg-red-500 animate-pulse' :
        metrics.alertLevel === 'WARNING'  ? 'bg-orange-500' :
        metrics.alertLevel === 'INFO'     ? 'bg-blue-500' :
        'bg-emerald-500';

    const badgeClass =
        metrics.alertLevel === 'CRITICAL' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
        metrics.alertLevel === 'WARNING'  ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' :
        'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400';

    const statusColor = closingStatus ? (CLOSING_STATUS_COLORS[closingStatus] ?? 'gray') : null;

    return (
        <div className="flex items-center gap-4 px-4 py-3 hover:bg-amber-50/40 dark:hover:bg-white/[0.03] transition-all duration-150 border-b border-gray-50/80 dark:border-white/5 last:border-0 group">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />

            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{station.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{station.stationCode ?? station.address}</p>
            </div>

            <div className="text-right hidden sm:block w-28">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                    ${metrics.totalRevenue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{metrics.totalTransactions} tx</p>
            </div>

            <div className="text-right hidden md:block w-28">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {metrics.fuelLiters.toLocaleString('es-AR', { maximumFractionDigits: 0 })} L
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                    Stock: {metrics.currentStockLiters.toLocaleString('es-AR', { maximumFractionDigits: 0 })} L
                </p>
            </div>

            {statusColor && (
                <span className={`hidden lg:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-${statusColor}-100 dark:bg-${statusColor}-500/20 text-${statusColor}-700 dark:text-${statusColor}-400`}>
                    {CLOSING_STATUS_LABELS[closingStatus!] ?? closingStatus}
                </span>
            )}

            {alertCount > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                    {alertCount}
                </span>
            )}

            <button
                onClick={() => onViewOnMap(station)}
                className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-gray-400 hover:text-amber-500 transition-colors"
                title="Ver en mapa"
            >
                <MapPin className="w-4 h-4" />
            </button>
        </div>
    );
};

const LiveDashboardView: React.FC<LiveDashboardViewProps> = ({
    stations,
    alerts,
    dailyClosings,
    getStationMetrics,
    onViewOnMap,
}) => {
    const activeStations = stations.filter(s => s.isActive);

    const metricsMap = useMemo(() => {
        const map = new Map<string, StationMetrics>();
        for (const s of activeStations) {
            map.set(s.id, getStationMetrics(s.id, today, today));
        }
        return map;
    }, [activeStations, getStationMetrics]);

    const unresolvedAlerts  = alerts.filter(a => !a.resolved);
    const criticalAlerts    = unresolvedAlerts.filter(a => a.level === 'CRITICAL');
    const totalRevenue      = Array.from(metricsMap.values()).reduce((s, m) => s + m.totalRevenue, 0);
    const totalFuelLiters   = Array.from(metricsMap.values()).reduce((s, m) => s + m.fuelLiters, 0);
    const totalTransactions = Array.from(metricsMap.values()).reduce((s, m) => s + m.totalTransactions, 0);
    const discrepancies     = dailyClosings.filter(c => c.status === 'DISCREPANCY').length;

    const sortedStations = useMemo(() => [...activeStations].sort((a, b) => {
        const ma = metricsMap.get(a.id);
        const mb = metricsMap.get(b.id);
        const levelOrder = (l: string | null | undefined) =>
            l === 'CRITICAL' ? 0 : l === 'WARNING' ? 1 : l === 'INFO' ? 2 : 3;
        const diff = levelOrder(ma?.alertLevel) - levelOrder(mb?.alertLevel);
        if (diff !== 0) return diff;
        return (mb?.totalRevenue ?? 0) - (ma?.totalRevenue ?? 0);
    }), [activeStations, metricsMap]);

    const latestClosings = useMemo(() => {
        const map = new Map<string, string>();
        for (const c of dailyClosings) {
            const ex = map.get(c.stationId);
            if (!ex || c.shiftDate > ex) map.set(c.stationId, c.status);
        }
        return map;
    }, [dailyClosings]);

    const alertCountByStation = useMemo(() => {
        const map = new Map<string, number>();
        for (const a of unresolvedAlerts) {
            if (a.stationId) map.set(a.stationId, (map.get(a.stationId) ?? 0) + 1);
        }
        return map;
    }, [unresolvedAlerts]);

    return (
        <div className="h-full flex flex-col bg-slate-50/80 dark:bg-slate-950 overflow-hidden">
            {/* KPI header */}
            <div className="shrink-0 p-4 pb-3">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-sm shadow-amber-400/30">
                        <Activity className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h1 className="text-lg font-black text-gray-900 dark:text-white">En Vivo — Hoy</h1>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-gray-100 dark:border-white/10">
                        {today}
                    </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard
                        label="Ventas del día"
                        value={`$${(totalRevenue / 1000).toFixed(0)}K`}
                        sub={`${totalTransactions} transacciones`}
                        icon={<DollarSign className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />}
                        colorClass="bg-emerald-100 dark:bg-emerald-500/20"
                        glowColor="rgba(16,185,129,0.15)"
                    />
                    <KpiCard
                        label="Combustible"
                        value={`${(totalFuelLiters / 1000).toFixed(1)}K L`}
                        sub="litros despachados"
                        icon={<Fuel className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />}
                        colorClass="bg-amber-100 dark:bg-amber-500/20"
                        glowColor="rgba(245,158,11,0.15)"
                    />
                    <KpiCard
                        label="Alertas activas"
                        value={unresolvedAlerts.length}
                        sub={criticalAlerts.length > 0 ? `${criticalAlerts.length} críticas` : 'Sin críticas'}
                        icon={<AlertTriangle className={`w-4.5 h-4.5 ${criticalAlerts.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`} />}
                        colorClass={criticalAlerts.length > 0 ? 'bg-red-100 dark:bg-red-500/20' : 'bg-orange-100 dark:bg-orange-500/20'}
                        glowColor={criticalAlerts.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.12)'}
                    />
                    <KpiCard
                        label="Estaciones activas"
                        value={activeStations.length}
                        sub={discrepancies > 0 ? `${discrepancies} discrepancias` : 'Conciliación OK'}
                        icon={<Gauge className={`w-4.5 h-4.5 ${discrepancies > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} />}
                        colorClass={discrepancies > 0 ? 'bg-red-100 dark:bg-red-500/20' : 'bg-blue-100 dark:bg-blue-500/20'}
                        glowColor={discrepancies > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.12)'}
                    />
                </div>
            </div>

            {/* Station table */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div
                    className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden
                               border border-white/80 dark:border-white/8"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.80)' }}
                >
                    <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100/80 dark:border-white/8 bg-gray-50/80 dark:bg-white/[0.03]">
                        <div className="w-2.5 shrink-0" />
                        <div className="flex-1 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Estación</div>
                        <div className="hidden sm:block w-28 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-right">Ventas hoy</div>
                        <div className="hidden md:block w-28 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-right">Combustible</div>
                        <div className="hidden lg:block w-24 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider text-right">Cierre</div>
                        <div className="w-16" />
                    </div>

                    {sortedStations.length === 0 ? (
                        <div className="py-16 text-center">
                            <TrendingUp className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-700 mb-3" />
                            <p className="text-gray-400 dark:text-slate-500 font-medium">Sin estaciones activas</p>
                        </div>
                    ) : (
                        sortedStations.map(station => (
                            <StationRow
                                key={station.id}
                                station={station}
                                metrics={metricsMap.get(station.id)!}
                                alertCount={alertCountByStation.get(station.id) ?? 0}
                                closingStatus={latestClosings.get(station.id)}
                                onViewOnMap={onViewOnMap}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveDashboardView;
