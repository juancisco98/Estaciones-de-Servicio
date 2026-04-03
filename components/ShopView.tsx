import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Station, DailyClosing, SalesTransaction, User } from '../types';
import StationFilter from './StationFilter';
import TurnoFilter from './TurnoFilter';
import { getArgentinaToday } from '../utils/dateUtils';

interface ShopViewProps {
    stations: Station[];
    dailyClosings: DailyClosing[];
    salesTransactions: SalesTransaction[];
    currentUser: User | null;
    activeStationId?: string | null;
    onStationChange?: (id: string | null) => void;
}

const fmt = (n?: number) => n != null ? `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '-';

const MAX_FUEL_CODE = 20;

interface ProductGroup {
    productName: string;
    totalAmount: number;
    count: number;
}

interface DayRow {
    key: string;
    stationId: string;
    shiftDate: string;
    turno?: number;
    total: number;
    productCount: number;
    txCount: number;
    source: 'S' | 'VE';
}

const DayBreakdown: React.FC<{ transactions: SalesTransaction[] }> = ({ transactions }) => {
    const products = useMemo(() => {
        const map = new Map<string, ProductGroup>();
        for (const t of transactions) {
            const code = Number(t.productCode);
            if (code <= MAX_FUEL_CODE) continue;  // only shop products (code > 20)

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

const ShopView: React.FC<ShopViewProps> = ({ stations, dailyClosings, salesTransactions, currentUser, activeStationId, onStationChange }) => {
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(getArgentinaToday);
    const [dateTo, setDateTo] = useState(getArgentinaToday);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(activeStationId ?? null);
    const [selectedTurno, setSelectedTurno] = useState<number | null>(null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    const handleStationChange = (id: string | null) => {
        setSelectedStationId(id);
        onStationChange?.(id);
    };

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    // Build rows: prefer daily_closings (S files) when available, fallback to VE
    const dayRows = useMemo(() => {
        // 1. Rows from daily_closings (S files)
        const sRows: DayRow[] = dailyClosings
            .filter(c => c.shopTotal != null)
            .filter(c => c.shiftDate >= dateFrom && c.shiftDate <= dateTo)
            .filter(c => !selectedStationId || c.stationId === selectedStationId)
            .filter(c => selectedTurno == null || c.turno === selectedTurno)
            .map(c => ({
                key: `S:${c.stationId}:${c.shiftDate}:${c.turno ?? 0}`,
                stationId: c.stationId,
                shiftDate: c.shiftDate,
                turno: c.turno ?? undefined,
                total: c.shopTotal!,
                productCount: 0,
                txCount: 0,
                source: 'S' as const,
            }));

        // Track which (station, date) combos have S data
        const hasSData = new Set(sRows.map(r => `${r.stationId}:${r.shiftDate}`));

        // 2. Fallback: VE transactions for days WITHOUT S files (only non-fuel)
        const veTxs = salesTransactions
            .filter(t => Number(t.productCode) > MAX_FUEL_CODE)
            .filter(t => t.shiftDate >= dateFrom && t.shiftDate <= dateTo)
            .filter(t => !selectedStationId || t.stationId === selectedStationId)
            .filter(t => selectedTurno == null || t.turno === selectedTurno)
            .filter(t => !hasSData.has(`${t.stationId}:${t.shiftDate}`));

        const veMap = new Map<string, DayRow>();
        const productSets = new Map<string, Set<string>>();
        for (const t of veTxs) {
            const turnoKey = t.turno ?? 0;
            const key = `VE:${t.stationId}:${t.shiftDate}:${turnoKey}`;
            const existing = veMap.get(key);
            if (existing) {
                existing.total += t.totalAmount;
                existing.txCount += 1;
            } else {
                veMap.set(key, {
                    key,
                    stationId: t.stationId,
                    shiftDate: t.shiftDate,
                    turno: t.turno ?? undefined,
                    total: t.totalAmount,
                    productCount: 0,
                    txCount: 1,
                    source: 'VE',
                });
                productSets.set(key, new Set());
            }
            productSets.get(key)!.add(t.productName);
        }
        for (const [key, row] of veMap) {
            row.productCount = productSets.get(key)?.size ?? 0;
        }

        // Enrich S rows with product count from VE
        for (const sRow of sRows) {
            const matchingTxs = salesTransactions.filter(t =>
                t.stationId === sRow.stationId &&
                t.shiftDate === sRow.shiftDate &&
                Number(t.productCode) > MAX_FUEL_CODE &&
                (sRow.turno == null || t.turno === sRow.turno)
            );
            sRow.productCount = new Set(matchingTxs.map(t => t.productName)).size;
            sRow.txCount = matchingTxs.length;
        }

        let results = [...sRows, ...Array.from(veMap.values())];

        if (search.trim()) {
            const q = search.toLowerCase();
            results = results.filter(d =>
                (stationMap.get(d.stationId) ?? '').toLowerCase().includes(q) ||
                d.shiftDate.includes(q)
            );
        }

        return results.sort((a, b) => b.shiftDate.localeCompare(a.shiftDate) || (a.turno ?? 0) - (b.turno ?? 0));
    }, [dailyClosings, salesTransactions, selectedStationId, selectedTurno, dateFrom, dateTo, search, stationMap]);

    const totalShop = dayRows.reduce((sum, d) => sum + d.total, 0);

    const availableTurnos = useMemo(() => {
        const set = new Set<number>();
        for (const t of salesTransactions) { if (t.turno != null) set.add(t.turno); }
        for (const c of dailyClosings) { if (c.turno != null) set.add(c.turno); }
        return Array.from(set);
    }, [salesTransactions, dailyClosings]);

    const getTransactionsForRow = (row: DayRow) =>
        salesTransactions.filter(t =>
            t.stationId === row.stationId &&
            t.shiftDate === row.shiftDate &&
            (row.turno == null || t.turno === row.turno)
        );

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <div className="shrink-0 p-5 pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-5">
                    <ShoppingBag className="w-6 h-6 text-violet-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Mini Mercado</h1>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 ml-auto">
                        {dayRows.length} registros | Total: {fmt(totalShop)}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <StationFilter stations={stations} selectedStationId={selectedStationId} onChange={handleStationChange} className="min-w-[200px]" />
                    <TurnoFilter turnos={availableTurnos} selected={selectedTurno} onChange={setSelectedTurno} />
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-violet-400" />
                        <span className="text-gray-400 text-sm">-</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-violet-400" />
                    </div>
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-violet-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500" />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {dayRows.length === 0 ? (
                    <div className="py-24 text-center">
                        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-700 mb-4" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium text-base">Sin datos de mini mercado para el periodo</p>
                    </div>
                ) : (
                    dayRows.map(row => {
                        const isExpanded = expandedKey === row.key;
                        return (
                            <div key={row.key} className="bg-white dark:bg-slate-900 rounded-xl border border-white/80 dark:border-white/8 overflow-hidden"
                                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.07)' }}>
                                <button className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                                    onClick={() => setExpandedKey(isExpanded ? null : row.key)}>
                                    <ShoppingBag className="w-5 h-5 text-violet-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {stationMap.get(row.stationId) ?? row.stationId}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono ml-2">{row.shiftDate}</span>
                                        {row.turno != null && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 ml-2">
                                                T{row.turno}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-300 dark:text-slate-600 ml-2">
                                            {row.source === 'S' ? '(archivo S)' : '(datos VE)'}
                                        </span>
                                    </div>
                                    <div className="text-right shrink-0 mr-2">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(row.total)}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500">{row.productCount} productos</p>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>
                                {isExpanded && <DayBreakdown transactions={getTransactionsForRow(row)} />}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ShopView;
