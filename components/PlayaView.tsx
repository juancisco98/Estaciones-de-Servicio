import React, { useState, useMemo } from 'react';
import { Fuel, Search, ChevronDown, ChevronUp, Droplets } from 'lucide-react';
import { Station, DailyClosing, SalesTransaction, User } from '../types';
import StationFilter from './StationFilter';

interface PlayaViewProps {
    stations: Station[];
    dailyClosings: DailyClosing[];
    salesTransactions: SalesTransaction[];
    currentUser: User | null;
    activeStationId?: string | null;
    onStationChange?: (id: string | null) => void;
}

const fmt = (n?: number) => n != null ? `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '-';
const fmtQty = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

const MAX_FUEL_CODE = 20;

interface ProductGroup {
    productName: string;
    productCode: string;
    totalAmount: number;
    totalQuantity: number;
    count: number;
}

const DayBreakdown: React.FC<{ transactions: SalesTransaction[] }> = ({ transactions }) => {
    const { combustibles, varios } = useMemo(() => {
        const fuelMap = new Map<string, ProductGroup>();
        const variosMap = new Map<string, ProductGroup>();

        for (const t of transactions) {
            const isFuel = Number(t.productCode) <= MAX_FUEL_CODE && Number(t.productCode) > 0;
            const map = isFuel ? fuelMap : variosMap;
            const key = t.productName;
            const existing = map.get(key);
            if (existing) {
                existing.totalAmount += t.totalAmount;
                existing.totalQuantity += t.quantity;
                existing.count += 1;
            } else {
                map.set(key, {
                    productName: t.productName,
                    productCode: t.productCode,
                    totalAmount: t.totalAmount,
                    totalQuantity: t.quantity,
                    count: 1,
                });
            }
        }

        return {
            combustibles: Array.from(fuelMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
            varios: Array.from(variosMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
        };
    }, [transactions]);

    const totalCombustibles = combustibles.reduce((s, p) => s + p.totalAmount, 0);
    const totalVarios = varios.reduce((s, p) => s + p.totalAmount, 0);

    return (
        <div className="border-t border-gray-100 dark:border-white/5 px-5 py-4 space-y-4">
            {combustibles.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Fuel className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Combustibles</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmt(totalCombustibles)}</span>
                    </div>
                    <div className="space-y-1">
                        {combustibles.map(p => (
                            <div key={p.productName} className="flex items-center text-xs px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                                <span className="font-medium text-gray-700 dark:text-gray-300 flex-1">{p.productName}</span>
                                <span className="text-gray-400 dark:text-slate-500 mr-4">{fmtQty(p.totalQuantity)} lts</span>
                                <span className="font-bold text-gray-900 dark:text-white w-24 text-right">{fmt(p.totalAmount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {varios.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Droplets className="w-4 h-4 text-teal-500" />
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400">Varios (aceites, lubricantes, etc.)</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmt(totalVarios)}</span>
                    </div>
                    <div className="space-y-1">
                        {varios.map(p => (
                            <div key={p.productName} className="flex items-center text-xs px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                                <span className="font-medium text-gray-700 dark:text-gray-300 flex-1">{p.productName}</span>
                                <span className="text-gray-400 dark:text-slate-500 mr-4">x{p.count}</span>
                                <span className="font-bold text-gray-900 dark:text-white w-24 text-right">{fmt(p.totalAmount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {combustibles.length === 0 && varios.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">Sin ventas detalladas para este dia</p>
            )}
        </div>
    );
};

const PlayaView: React.FC<PlayaViewProps> = ({ stations, dailyClosings, salesTransactions, currentUser, activeStationId, onStationChange }) => {
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
    const [selectedStationId, setSelectedStationId] = useState<string | null>(activeStationId ?? null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleStationChange = (id: string | null) => {
        setSelectedStationId(id);
        onStationChange?.(id);
    };

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    const filtered = useMemo(() => {
        let list = dailyClosings.filter(c => c.forecourtTotal != null);
        if (selectedStationId) list = list.filter(c => c.stationId === selectedStationId);
        list = list.filter(c => c.shiftDate >= dateFrom && c.shiftDate <= dateTo);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                (stationMap.get(c.stationId) ?? '').toLowerCase().includes(q) ||
                c.shiftDate.includes(q)
            );
        }
        return list.sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));
    }, [dailyClosings, selectedStationId, dateFrom, dateTo, search, stationMap]);

    const totalPlaya = filtered.reduce((sum, c) => sum + (c.forecourtTotal ?? 0), 0);

    const getTransactionsForDay = (stationId: string, shiftDate: string) =>
        salesTransactions.filter(t => t.stationId === stationId && t.shiftDate === shiftDate);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-5 pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-5">
                    <Fuel className="w-6 h-6 text-amber-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Playa</h1>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 ml-auto">
                        {filtered.length} cierres | Total: {fmt(totalPlaya)}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <StationFilter
                        stations={stations}
                        selectedStationId={selectedStationId}
                        onChange={handleStationChange}
                        className="min-w-[200px]"
                    />
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-gray-400 text-sm">-</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400"
                        />
                    </div>
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-amber-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {filtered.length === 0 ? (
                    <div className="py-24 text-center">
                        <Fuel className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-700 mb-4" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium text-base">Sin datos de playa para el periodo</p>
                    </div>
                ) : (
                    filtered.map(closing => {
                        const isExpanded = expandedId === closing.id;
                        return (
                            <div
                                key={closing.id}
                                className="bg-white dark:bg-slate-900 rounded-xl border border-white/80 dark:border-white/8 overflow-hidden"
                                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.07)' }}
                            >
                                <button
                                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                                    onClick={() => setExpandedId(isExpanded ? null : closing.id)}
                                >
                                    <Fuel className="w-5 h-5 text-amber-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {stationMap.get(closing.stationId) ?? closing.stationId}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono ml-2">{closing.shiftDate}</span>
                                        {closing.pFileName && (
                                            <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">({closing.pFileName})</span>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0 mr-2">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(closing.forecourtTotal)}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500">Total Playa</p>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>
                                {isExpanded && (
                                    <DayBreakdown transactions={getTransactionsForDay(closing.stationId, closing.shiftDate)} />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PlayaView;
