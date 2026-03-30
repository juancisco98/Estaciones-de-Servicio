import React, { useState, useMemo } from 'react';
import { Droplets, AlertTriangle, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Station, User } from '../types';
import { useTankLevels } from '../hooks/useTankLevels';
import { TANK_WARNING_LITERS, TANK_CRITICAL_LITERS } from '../constants';

interface TankLevelsViewProps {
    stations: Station[];
    currentUser: User | null;
}

const TankBar: React.FC<{ levelLiters: number; capacityLiters?: number; alertLevel: 'OK' | 'WARNING' | 'CRITICAL' }> = ({
    levelLiters, capacityLiters, alertLevel,
}) => {
    const capacity = capacityLiters ?? 50000;
    const pct      = Math.min(100, Math.max(0, (levelLiters / capacity) * 100));
    const barGradient =
        alertLevel === 'CRITICAL' ? 'linear-gradient(90deg, #ef4444, #dc2626)' :
        alertLevel === 'WARNING'  ? 'linear-gradient(90deg, #f97316, #ea580c)' :
        'linear-gradient(90deg, #34d399, #10b981)';

    const glowColor =
        alertLevel === 'CRITICAL' ? 'rgba(239,68,68,0.35)'  :
        alertLevel === 'WARNING'  ? 'rgba(249,115,22,0.35)' :
        'rgba(16,185,129,0.30)';

    return (
        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.10)' }}>
            <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: barGradient, boxShadow: `0 1px 4px ${glowColor}` }}
            />
        </div>
    );
};

const StationTankPanel: React.FC<{ station: Station }> = ({ station }) => {
    const { getLatestByStation, getTankAlertLevel } = useTankLevels();
    const [expanded, setExpanded] = useState(false);
    const latest = getLatestByStation(station.id);

    if (latest.size === 0) return null;

    const tanks = Array.from(latest.entries()).sort(([a], [b]) => a.localeCompare(b));
    const criticalCount = tanks.filter(([, t]) => getTankAlertLevel(t.levelLiters) === 'CRITICAL').length;
    const warningCount  = tanks.filter(([, t]) => getTankAlertLevel(t.levelLiters) === 'WARNING').length;

    return (
        <div
            className={`bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border ${
                criticalCount > 0 ? 'border-red-200 dark:border-red-500/30' :
                warningCount  > 0 ? 'border-orange-200 dark:border-orange-500/30' :
                'border-white/80 dark:border-white/8'
            }`}
            style={{
                boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)',
            }}
        >
            {/* Station header */}
            <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                onClick={() => setExpanded(v => !v)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                        criticalCount > 0 ? 'bg-red-500 animate-pulse' :
                        warningCount  > 0 ? 'bg-orange-500' :
                        'bg-emerald-500'
                    }`} />
                    <div className="text-left">
                        <p className="font-bold text-sm text-gray-900 dark:text-white">{station.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{station.stationCode ?? station.address}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {criticalCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                            {criticalCount} críticos
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400">
                            {warningCount} bajos
                        </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-slate-500">{tanks.length} tanques</span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
            </button>

            {/* Tanks grid */}
            {expanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4 border-t border-gray-50 dark:border-white/5">
                    {tanks.map(([tankId, tank]) => {
                        const level     = getTankAlertLevel(tank.levelLiters);
                        const textColor = level === 'CRITICAL' ? 'text-red-600 dark:text-red-400' :
                                          level === 'WARNING'  ? 'text-orange-600 dark:text-orange-400' :
                                          'text-emerald-600 dark:text-emerald-400';
                        return (
                            <div key={tankId} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{tankId}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500">{tank.productName}</p>
                                    </div>
                                    {level !== 'OK' && (
                                        <AlertTriangle className={`w-4 h-4 shrink-0 ${level === 'CRITICAL' ? 'text-red-500 animate-pulse' : 'text-orange-500'}`} />
                                    )}
                                </div>
                                <TankBar levelLiters={tank.levelLiters} capacityLiters={tank.capacityLiters} alertLevel={level} />
                                <div className="flex items-center justify-between mt-1.5">
                                    <p className={`text-sm font-black ${textColor}`}>
                                        {tank.levelLiters.toLocaleString('es-AR', { maximumFractionDigits: 0 })} L
                                    </p>
                                    <p className="text-[10px] text-gray-400 dark:text-slate-500">
                                        {new Date(tank.recordedAt).toLocaleString('es-AR', { timeStyle: 'short', dateStyle: 'short' })}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const TankLevelsView: React.FC<TankLevelsViewProps> = ({ stations, currentUser }) => {
    const { getLowTanks, getCriticalTanks } = useTankLevels();

    const { lowCount, criticalCount } = useMemo(() => {
        let low = 0, critical = 0;
        for (const s of stations) {
            low      += getLowTanks(s.id).length;
            critical += getCriticalTanks(s.id).length;
        }
        return { lowCount: low, criticalCount: critical };
    }, [stations, getLowTanks, getCriticalTanks]);

    const activeStations = stations.filter(s => s.isActive);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 pb-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-3">
                    <Droplets className="w-5 h-5 text-blue-500" />
                    <h1 className="text-xl font-black text-gray-900 dark:text-white">Niveles de Tanques</h1>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Crítico ({"<"}{TANK_CRITICAL_LITERS} L):
                        <span className={`font-bold ${criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>{criticalCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        Advertencia ({"<"}{TANK_WARNING_LITERS} L):
                        <span className={`font-bold ${lowCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>{lowCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-slate-500">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>{activeStations.length} estaciones monitoreadas</span>
                    </div>
                </div>
            </div>

            {/* Station panels */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeStations.map(station => (
                    <StationTankPanel key={station.id} station={station} />
                ))}
                {activeStations.length === 0 && (
                    <div className="py-20 text-center">
                        <Droplets className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-700 mb-3" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium">Sin estaciones activas</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TankLevelsView;
