import React, { useState, useMemo } from 'react';
import { ShoppingBag, Search } from 'lucide-react';
import { Station, DailyClosing, User } from '../types';
import StationFilter from './StationFilter';

interface ShopViewProps {
    stations: Station[];
    dailyClosings: DailyClosing[];
    currentUser: User | null;
    activeStationId?: string | null;
    onStationChange?: (id: string | null) => void;
}

const fmt = (n?: number) => n != null ? `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '-';

const ShopView: React.FC<ShopViewProps> = ({ stations, dailyClosings, currentUser, activeStationId, onStationChange }) => {
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
    const [selectedStationId, setSelectedStationId] = useState<string | null>(activeStationId ?? null);

    const handleStationChange = (id: string | null) => {
        setSelectedStationId(id);
        onStationChange?.(id);
    };

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    const filtered = useMemo(() => {
        let list = dailyClosings.filter(c => c.shopTotal != null);
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

    const totalShop = filtered.reduce((sum, c) => sum + (c.shopTotal ?? 0), 0);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-5 pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-5">
                    <ShoppingBag className="w-6 h-6 text-violet-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Mini Mercado</h1>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 ml-auto">
                        {filtered.length} cierres | Total: {fmt(totalShop)}
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
                {filtered.length === 0 ? (
                    <div className="py-24 text-center">
                        <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-700 mb-4" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium text-base">Sin datos de mini mercado para el periodo</p>
                    </div>
                ) : (
                    filtered.map(closing => (
                        <div
                            key={closing.id}
                            className="bg-white dark:bg-slate-900 rounded-xl border border-white/80 dark:border-white/8 px-5 py-4 flex items-center gap-4"
                            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.07)' }}
                        >
                            <ShoppingBag className="w-5 h-5 text-violet-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {stationMap.get(closing.stationId) ?? closing.stationId}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-slate-500 font-mono ml-2">{closing.shiftDate}</span>
                                {closing.sFileName && (
                                    <span className="text-xs text-gray-400 dark:text-slate-500 ml-2">({closing.sFileName})</span>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(closing.shopTotal)}</p>
                                <p className="text-[10px] text-gray-400 dark:text-slate-500">Total Tienda</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ShopView;
