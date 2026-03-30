import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Filter, Search, Clock } from 'lucide-react';
import { Alert, AlertLevel, AlertType, Station, User } from '../types';
import { ALERT_LEVEL_LABELS, ALERT_LEVEL_COLORS } from '../constants';

interface AlertsViewProps {
    alerts: Alert[];
    stations: Station[];
    onResolveAlert: (id: string) => void;
    currentUser: User | null;
}

const LEVEL_ORDER: Record<AlertLevel, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
    CASH_DISCREPANCY:    'Discrepancia de caja',
    NEGATIVE_VALUE:      'Valor negativo',
    MISSING_FILE:        'Archivo faltante',
    LOW_TANK_LEVEL:      'Tanque bajo',
    CRITICAL_TANK_LEVEL: 'Tanque crítico',
    RECONCILIATION_FAIL: 'Falla reconciliación',
    UNKNOWN_PRODUCT:     'Producto desconocido',
    VOLUME_ANOMALY:      'Anomalía de volumen',
    MISSING_TRANSACTIONS:'Transacciones faltantes',
};

const levelBadgeClass = (level: AlertLevel) => {
    const c = ALERT_LEVEL_COLORS[level];
    return `bg-${c}-100 dark:bg-${c}-500/20 text-${c}-700 dark:text-${c}-400`;
};

const AlertCard: React.FC<{
    alert: Alert;
    stationName?: string;
    onResolve: (id: string) => void;
    canResolve: boolean;
}> = ({ alert, stationName, onResolve, canResolve }) => {
    const borderClass =
        alert.level === 'CRITICAL' ? 'border-l-red-500' :
        alert.level === 'WARNING'  ? 'border-l-orange-500' :
        'border-l-blue-500';

    return (
        <div
            className={`bg-white dark:bg-slate-900 rounded-2xl border-l-4 ${borderClass} p-4 flex gap-4 transition-all duration-150 hover:translate-x-0.5`}
            style={{
                boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)',
            }}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${levelBadgeClass(alert.level)}`}>
                            {ALERT_LEVEL_LABELS[alert.level]}
                        </span>
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                        </span>
                        {stationName && (
                            <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400">{stationName}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-xs text-gray-400 dark:text-slate-500">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                </div>
                <p className="font-bold text-sm text-gray-900 dark:text-white">{alert.title}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">{alert.message}</p>
                {alert.relatedFile && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 font-mono">Archivo: {alert.relatedFile}</p>
                )}
                {alert.relatedDate && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Turno: {alert.relatedDate}</p>
                )}
            </div>
            {canResolve && !alert.resolved && (
                <button
                    onClick={() => onResolve(alert.id)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Resolver
                </button>
            )}
        </div>
    );
};

const AlertsView: React.FC<AlertsViewProps> = ({ alerts, stations, onResolveAlert, currentUser }) => {
    const [search, setSearch]             = useState('');
    const [filterLevel, setFilterLevel]   = useState<AlertLevel | 'ALL'>('ALL');
    const [showResolved, setShowResolved] = useState(false);

    const stationMap = useMemo(() =>
        new Map(stations.map(s => [s.id, s.name])),
    [stations]);

    const filtered = useMemo(() => {
        let list = [...alerts];
        if (!showResolved) list = list.filter(a => !a.resolved);
        if (filterLevel !== 'ALL') list = list.filter(a => a.level === filterLevel);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(a =>
                a.title.toLowerCase().includes(q) ||
                a.message.toLowerCase().includes(q) ||
                (a.stationId && (stationMap.get(a.stationId) ?? '').toLowerCase().includes(q))
            );
        }
        return list.sort((a, b) => {
            if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
            const ld = (LEVEL_ORDER[a.level] ?? 3) - (LEVEL_ORDER[b.level] ?? 3);
            if (ld !== 0) return ld;
            return b.createdAt.localeCompare(a.createdAt);
        });
    }, [alerts, showResolved, filterLevel, search, stationMap]);

    const unresolved = alerts.filter(a => !a.resolved);
    const critical   = unresolved.filter(a => a.level === 'CRITICAL');
    const warning    = unresolved.filter(a => a.level === 'WARNING');

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 pb-3 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <h1 className="text-xl font-black text-gray-900 dark:text-white">Alertas</h1>
                    <div className="flex items-center gap-2 ml-auto">
                        {critical.length > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                                {critical.length} Críticas
                            </span>
                        )}
                        {warning.length > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400">
                                {warning.length} Advertencias
                            </span>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar alerta o estación..."
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-amber-400 focus:ring-0 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5 text-gray-400" />
                        {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map(l => (
                            <button
                                key={l}
                                onClick={() => setFilterLevel(l)}
                                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all duration-150 active:scale-95"
                                style={filterLevel === l ? {
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    color: 'white',
                                    boxShadow: '0 2px 8px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.20)',
                                } : {
                                    background: 'rgba(255,255,255,0.72)',
                                    backdropFilter: 'blur(8px)',
                                    color: '',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.80)',
                                }}
                            >
                                <span className={filterLevel !== l ? 'text-gray-500 dark:text-slate-400' : ''}>
                                    {l === 'ALL' ? 'Todas' : ALERT_LEVEL_LABELS[l]}
                                </span>
                            </button>
                        ))}
                    </div>

                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showResolved}
                            onChange={e => setShowResolved(e.target.checked)}
                            className="rounded accent-amber-500"
                        />
                        Ver resueltas
                    </label>
                </div>
            </div>

            {/* Alert list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filtered.length === 0 ? (
                    <div className="py-20 text-center">
                        <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                        <p className="text-gray-400 dark:text-slate-500 font-semibold">No hay alertas activas</p>
                    </div>
                ) : (
                    filtered.map(alert => (
                        <AlertCard
                            key={alert.id}
                            alert={alert}
                            stationName={alert.stationId ? stationMap.get(alert.stationId) : undefined}
                            onResolve={onResolveAlert}
                            canResolve={currentUser?.role === 'ADMIN'}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default AlertsView;
