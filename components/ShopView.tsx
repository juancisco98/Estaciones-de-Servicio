import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Station, DailyClosing, SalesTransaction } from '../types';
import VeTransactionList from './VeTransactionList';
import StationFilter from './StationFilter';
import TurnoFilter, { Turno, getTurnoFromTs, getTurnoFromClosingTs } from './TurnoFilter';
import { getArgentinaToday } from '../utils/dateUtils';

interface ShopViewProps {
    stations: Station[];
    dailyClosings: DailyClosing[];
    salesTransactions: SalesTransaction[];
    activeStationId?: string | null;
    onStationChange?: (id: string | null) => void;
}

const fmt = (n?: number) => n != null ? `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '-';

interface DayRow {
    key: string;
    stationId: string;
    shiftDate: string;
    turno?: number;
    closingTs?: string;
    totalsSnapshot?: Record<string, number>;
    total: number;
    productCount: number;
    txCount: number;
    source: 'S' | 'VE';
}

const _SUMMARY_LABELS = new Set(['TOTAL SALE', 'TOTAL ENTRA', 'TOTAL COMBUSTIBLES']);

const SnapshotBreakdown: React.FC<{ snapshot: Record<string, number> }> = ({ snapshot }) => {
    const entries = Object.entries(snapshot)
        .filter(([label]) => !_SUMMARY_LABELS.has(label))
        .filter(([, amount]) => amount !== 0)
        .sort(([, a], [, b]) => (b as number) - (a as number));

    return (
        <div className="border-t border-gray-100 dark:border-white/5 px-5 py-4 space-y-1">
            {entries.map(([label, amount]) => (
                <div key={label} className="flex items-center text-xs px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                    <span className="font-medium text-gray-700 dark:text-gray-300 flex-1">{label}</span>
                    <span className="font-bold text-gray-900 dark:text-white w-28 text-right">{fmt(amount as number)}</span>
                </div>
            ))}
            {entries.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">Sin detalle en archivo</p>
            )}
        </div>
    );
};

const ShopView: React.FC<ShopViewProps> = ({ stations, dailyClosings, salesTransactions, activeStationId, onStationChange }) => {
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(getArgentinaToday);
    const [dateTo, setDateTo] = useState(getArgentinaToday);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(activeStationId ?? null);
    const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    const handleStationChange = (id: string | null) => {
        setSelectedStationId(id);
        onStationChange?.(id);
    };

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    // Build rows ONLY from S files (daily_closings with shopTotal)
    const dayRows = useMemo(() => {
        let results: DayRow[] = dailyClosings
            .filter(c => c.shopTotal != null)
            .filter(c => c.shiftDate >= dateFrom && c.shiftDate <= dateTo)
            .filter(c => !selectedStationId || c.stationId === selectedStationId)
            .filter(c => !selectedTurno || !c.sClosingTs || getTurnoFromClosingTs(c.sClosingTs) === selectedTurno)
            .map(c => ({
                key: `S:${c.stationId}:${c.shiftDate}:${c.turno ?? 0}`,
                stationId: c.stationId,
                shiftDate: c.shiftDate,
                turno: c.turno ?? undefined,
                closingTs: c.sClosingTs,
                totalsSnapshot: c.sTotalsSnapshot,
                total: c.shopTotal!,
                productCount: 0,
                txCount: 0,
                source: 'S' as const,
            }));

        if (search.trim()) {
            const q = search.toLowerCase();
            results = results.filter(d =>
                (stationMap.get(d.stationId) ?? '').toLowerCase().includes(q) ||
                d.shiftDate.includes(q)
            );
        }

        return results.sort((a, b) => b.shiftDate.localeCompare(a.shiftDate) || (a.turno ?? 0) - (b.turno ?? 0));
    }, [dailyClosings, selectedStationId, selectedTurno, dateFrom, dateTo, search, stationMap]);

    const totalShop = dayRows.reduce((sum, d) => sum + d.total, 0);

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
                    <TurnoFilter selected={selectedTurno} onChange={setSelectedTurno} />
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
                                        {row.closingTs && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 ml-2">
                                                {getTurnoFromClosingTs(row.closingTs) === 'MANANA' ? 'Mañana' : getTurnoFromClosingTs(row.closingTs) === 'TARDE' ? 'Tarde' : 'Noche'}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-300 dark:text-slate-600 ml-2">
                                            (archivo S)
                                        </span>
                                    </div>
                                    <div className="text-right shrink-0 mr-2">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(row.total)}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500">{row.productCount} productos</p>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>
                                {isExpanded && (
                                    <>
                                        {row.totalsSnapshot && <SnapshotBreakdown snapshot={row.totalsSnapshot} />}
                                        <VeTransactionList
                                            title="DETALLE VENTAS MINI MERCADO (VE)"
                                            transactions={salesTransactions.filter(t =>
                                                t.stationId === row.stationId &&
                                                t.shiftDate === row.shiftDate &&
                                                t.areaCode === 0 &&
                                                (!row.closingTs || getTurnoFromTs(t.transactionTs) === getTurnoFromClosingTs(row.closingTs))
                                            )}
                                        />
                                    </>
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
