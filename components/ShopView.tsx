import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Station, SalesTransaction, User } from '../types';
import StationFilter from './StationFilter';
import { getArgentinaToday } from '../utils/dateUtils';

interface ShopViewProps {
    stations: Station[];
    dailyClosings?: unknown[];  // kept for prop compat, not used
    salesTransactions: SalesTransaction[];
    currentUser: User | null;
    activeStationId?: string | null;
    onStationChange?: (id: string | null) => void;
}

const fmt = (n?: number) => n != null ? `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '-';

interface ProductGroup {
    productName: string;
    totalAmount: number;
    count: number;
}

const MAX_FUEL_CODE = 20;

interface DaySummary {
    key: string;
    stationId: string;
    shiftDate: string;
    shopTotal: number;
    productCount: number;
    txCount: number;
}

const DayBreakdown: React.FC<{ transactions: SalesTransaction[] }> = ({ transactions }) => {
    const products = useMemo(() => {
        const map = new Map<string, ProductGroup>();
        for (const t of transactions) {
            const code = Number(t.productCode);
            if (code > 0 && code <= MAX_FUEL_CODE) continue;

            const key = t.productName;
            const existing = map.get(key);
            if (existing) {
                existing.totalAmount += t.totalAmount;
                existing.count += t.quantity;
            } else {
                map.set(key, {
                    productName: t.productName,
                    totalAmount: t.totalAmount,
                    count: t.quantity,
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [transactions]);

    const total = products.reduce((s, p) => s + p.totalAmount, 0);

    return (
        <div className="border-t border-gray-100 dark:border-white/5 px-5 py-4">
            {products.length > 0 ? (
                <>
                    <div className="flex items-center gap-2 mb-2">
                        <ShoppingBag className="w-4 h-4 text-violet-500" />
                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400">Productos vendidos</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmt(total)}</span>
                    </div>
                    <div className="space-y-1">
                        {products.map(p => (
                            <div key={p.productName} className="flex items-center text-xs px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                                <span className="font-medium text-gray-700 dark:text-gray-300 flex-1">{p.productName}</span>
                                <span className="text-gray-400 dark:text-slate-500 mr-4">x{p.count}</span>
                                <span className="font-bold text-gray-900 dark:text-white w-24 text-right">{fmt(p.totalAmount)}</span>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">Sin productos de tienda para este dia</p>
            )}
        </div>
    );
};

const ShopView: React.FC<ShopViewProps> = ({ stations, salesTransactions, currentUser, activeStationId, onStationChange }) => {
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(getArgentinaToday);
    const [dateTo, setDateTo] = useState(getArgentinaToday);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(activeStationId ?? null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    const handleStationChange = (id: string | null) => {
        setSelectedStationId(id);
        onStationChange?.(id);
    };

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    // Group NON-FUEL sales by (stationId, shiftDate)
    const daySummaries = useMemo(() => {
        let txs = salesTransactions.filter(t => {
            const code = Number(t.productCode);
            return !(code > 0 && code <= MAX_FUEL_CODE);  // exclude fuel
        });
        txs = txs.filter(t => t.shiftDate >= dateFrom && t.shiftDate <= dateTo);
        if (selectedStationId) txs = txs.filter(t => t.stationId === selectedStationId);

        const map = new Map<string, DaySummary>();
        for (const t of txs) {
            const key = `${t.stationId}:${t.shiftDate}`;
            const existing = map.get(key);
            if (existing) {
                existing.shopTotal += t.totalAmount;
                existing.txCount += 1;
            } else {
                map.set(key, {
                    key,
                    stationId: t.stationId,
                    shiftDate: t.shiftDate,
                    shopTotal: t.totalAmount,
                    productCount: 0,
                    txCount: 1,
                });
            }
        }

        // Count distinct products per day
        for (const [key, summary] of map) {
            const dayTxs = txs.filter(t => `${t.stationId}:${t.shiftDate}` === key);
            summary.productCount = new Set(dayTxs.map(t => t.productName)).size;
        }

        let results = Array.from(map.values());

        if (search.trim()) {
            const q = search.toLowerCase();
            results = results.filter(d =>
                (stationMap.get(d.stationId) ?? '').toLowerCase().includes(q) ||
                d.shiftDate.includes(q)
            );
        }

        return results.sort((a, b) => b.shiftDate.localeCompare(a.shiftDate) || a.stationId.localeCompare(b.stationId));
    }, [salesTransactions, selectedStationId, dateFrom, dateTo, search, stationMap]);

    const totalShop = daySummaries.reduce((sum, d) => sum + d.shopTotal, 0);

    const getTransactionsForDay = (stationId: string, shiftDate: string) =>
        salesTransactions.filter(t => t.stationId === stationId && t.shiftDate === shiftDate);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-5 pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-5">
                    <ShoppingBag className="w-6 h-6 text-violet-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Mini Mercado</h1>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 ml-auto">
                        {daySummaries.length} dias | Total: {fmt(totalShop)}
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
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-violet-400"
                        />
                        <span className="text-gray-400 text-sm">-</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-violet-400"
                        />
                    </div>
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-violet-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {daySummaries.length === 0 ? (
                    <div className="py-24 text-center">
                        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-700 mb-4" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium text-base">Sin datos de mini mercado para el periodo</p>
                    </div>
                ) : (
                    daySummaries.map(day => {
                        const isExpanded = expandedKey === day.key;
                        return (
                            <div
                                key={day.key}
                                className="bg-white dark:bg-slate-900 rounded-xl border border-white/80 dark:border-white/8 overflow-hidden"
                                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.07)' }}
                            >
                                <button
                                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                                    onClick={() => setExpandedKey(isExpanded ? null : day.key)}
                                >
                                    <ShoppingBag className="w-5 h-5 text-violet-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {stationMap.get(day.stationId) ?? day.stationId}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono ml-2">{day.shiftDate}</span>
                                        <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">({day.productCount} productos, {day.txCount} ventas)</span>
                                    </div>
                                    <div className="text-right shrink-0 mr-2">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(day.shopTotal)}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500">Total Tienda</p>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>
                                {isExpanded && (
                                    <DayBreakdown transactions={getTransactionsForDay(day.stationId, day.shiftDate)} />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ShopView;
