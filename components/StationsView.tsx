import React, { useState, useMemo } from 'react';
import { Plus, Search, MapPin, Gauge, Users, AlertTriangle, Power, Edit2, ChevronRight } from 'lucide-react';
import { Station, Employee, Alert, User } from '../types';
import { useAlerts } from '../hooks/useAlerts';

interface StationsViewProps {
    stations: Station[];
    employees: Employee[];
    alerts: Alert[];
    onSaveStation: (station: Omit<Station, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<boolean>;
    onDeactivateStation: (id: string) => Promise<boolean>;
    onViewOnMap: (station: Station) => void;
    currentUser?: User | null;
}

const StatusDot: React.FC<{ active: boolean }> = ({ active }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
);

const StationsView: React.FC<StationsViewProps> = ({
    stations,
    employees,
    alerts,
    onSaveStation,
    onDeactivateStation,
    onViewOnMap,
    currentUser,
}) => {
    const [search, setSearch]       = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const { getStationAlertMap }    = useAlerts();
    const alertMap                  = getStationAlertMap();

    const employeeCountByStation = useMemo(() => {
        const map = new Map<string, number>();
        for (const e of employees) {
            if (e.isActive) map.set(e.stationId, (map.get(e.stationId) ?? 0) + 1);
        }
        return map;
    }, [employees]);

    const filtered = useMemo(() => {
        let list = stations;
        if (!showInactive) list = list.filter(s => s.isActive);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(s =>
                s.name.toLowerCase().includes(q) ||
                (s.address ?? '').toLowerCase().includes(q) ||
                (s.stationCode ?? '').toLowerCase().includes(q) ||
                (s.city ?? '').toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => {
            const la = alertMap.get(a.id);
            const lb = alertMap.get(b.id);
            const order = (l?: string) => l === 'CRITICAL' ? 0 : l === 'WARNING' ? 1 : l === 'INFO' ? 2 : 3;
            const diff = order(la) - order(lb);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name);
        });
    }, [stations, showInactive, search, alertMap]);

    const isAdmin = currentUser?.role === 'ADMIN';

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 pb-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-amber-500" />
                        <h1 className="text-xl font-black text-gray-900 dark:text-white">Estaciones</h1>
                        <span className="text-xs font-bold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            {stations.filter(s => s.isActive).length} activas
                        </span>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => onSaveStation({ name: '', address: '', coordinates: [-34.6037, -58.3816], isActive: true })}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-bold transition-all active:scale-95"
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                boxShadow: '0 4px 12px rgba(245,158,11,0.35), 0 2px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.20)',
                            }}
                        >
                            <Plus className="w-4 h-4" />
                            Nueva
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar por nombre, código o ciudad..."
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-amber-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 cursor-pointer select-none whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={e => setShowInactive(e.target.checked)}
                            className="rounded accent-amber-500"
                        />
                        Ver inactivas
                    </label>
                </div>
            </div>

            {/* Station grid */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map(station => {
                        const alertLevel    = alertMap.get(station.id);
                        const empCount      = employeeCountByStation.get(station.id) ?? 0;
                        const borderColor   =
                            alertLevel === 'CRITICAL' ? 'border-red-300 dark:border-red-500/40' :
                            alertLevel === 'WARNING'  ? 'border-orange-300 dark:border-orange-500/40' :
                            'border-white/80 dark:border-white/8';

                        return (
                            <div
                                key={station.id}
                                className={`bg-white dark:bg-slate-900 rounded-2xl border ${borderColor} p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 cursor-default`}
                                style={{
                                    boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)',
                                }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <StatusDot active={station.isActive} />
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">{station.name}</p>
                                            {station.stationCode && (
                                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">{station.stationCode}</p>
                                            )}
                                        </div>
                                    </div>
                                    {alertLevel && (
                                        <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                            alertLevel === 'CRITICAL' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                                            alertLevel === 'WARNING'  ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' :
                                            'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                        }`}>
                                            <AlertTriangle className="w-3 h-3" />
                                            {alertLevel}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{station.address}{station.city ? `, ${station.city}` : ''}</span>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
                                    <div className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        <span>{empCount} empleados</span>
                                    </div>
                                    {station.phone && (
                                        <span className="text-gray-300 dark:text-slate-700">·</span>
                                    )}
                                    {station.phone && <span>{station.phone}</span>}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-1 border-t border-gray-50 dark:border-white/5">
                                    <button
                                        onClick={() => onViewOnMap(station)}
                                        className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                                    >
                                        <MapPin className="w-3 h-3" />
                                        Ver mapa
                                    </button>
                                    {isAdmin && (
                                        <>
                                            <span className="text-gray-200 dark:text-slate-700">·</span>
                                            <button
                                                onClick={() => onSaveStation({ ...station, id: station.id })}
                                                className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                                Editar
                                            </button>
                                            <span className="text-gray-200 dark:text-slate-700">·</span>
                                            <button
                                                onClick={() => onDeactivateStation(station.id)}
                                                className="flex items-center gap-1 text-xs font-semibold text-red-500 dark:text-rose-400 hover:underline"
                                            >
                                                <Power className="w-3 h-3" />
                                                {station.isActive ? 'Desactivar' : 'Activar'}
                                            </button>
                                        </>
                                    )}
                                    <div className="flex-1" />
                                    <button
                                        onClick={() => onViewOnMap(station)}
                                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {filtered.length === 0 && (
                    <div className="py-20 text-center">
                        <Gauge className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-700 mb-3" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium">No se encontraron estaciones</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StationsView;
