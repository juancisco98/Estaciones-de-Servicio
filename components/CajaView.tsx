import React, { useState, useMemo } from 'react';
import { Banknote, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Station, CashClosing } from '../types';
import StationFilter from './StationFilter';
import TurnoFilter, { Turno, getTurnoFromClosingTs } from './TurnoFilter';
import { getArgentinaToday } from '../utils/dateUtils';

interface CajaViewProps {
    stations: Station[];
    cashClosings: CashClosing[];
    activeStationId?: string | null;
    onStationChange?: (id: string | null) => void;
}

const fmt = (n?: number) => n != null ? `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}` : '-';

const CajaView: React.FC<CajaViewProps> = ({ stations, cashClosings, activeStationId, onStationChange }) => {
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

    const rows = useMemo(() => {
        let results = cashClosings
            .filter(c => c.shiftDate >= dateFrom && c.shiftDate <= dateTo)
            .filter(c => !selectedStationId || c.stationId === selectedStationId)
            .filter(c => !selectedTurno || !c.closingTs || getTurnoFromClosingTs(c.closingTs) === selectedTurno);

        if (search.trim()) {
            const q = search.toLowerCase();
            results = results.filter(c =>
                (stationMap.get(c.stationId) ?? '').toLowerCase().includes(q) ||
                c.shiftDate.includes(q)
            );
        }

        return results.sort((a, b) => b.shiftDate.localeCompare(a.shiftDate) || (a.turno ?? 0) - (b.turno ?? 0));
    }, [cashClosings, selectedStationId, selectedTurno, dateFrom, dateTo, search, stationMap]);

    const totalCaja = rows.reduce((s, c) => s + (c.cajaTotal ?? 0), 0);
    const totalCheque = rows.reduce((s, c) => s + (c.chequeTotal ?? 0), 0);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <div className="shrink-0 p-5 pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-5">
                    <Banknote className="w-6 h-6 text-emerald-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Caja</h1>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 ml-auto">
                        {rows.length} registros | Caja: {fmt(totalCaja)} | Cheques: {fmt(totalCheque)}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <StationFilter stations={stations} selectedStationId={selectedStationId} onChange={handleStationChange} className="min-w-[200px]" />
                    <TurnoFilter selected={selectedTurno} onChange={setSelectedTurno} />
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-emerald-400" />
                        <span className="text-gray-400 text-sm">-</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-emerald-400" />
                    </div>
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-emerald-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500" />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {rows.length === 0 ? (
                    <div className="py-24 text-center">
                        <Banknote className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-700 mb-4" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium text-base">Sin datos de caja para el periodo</p>
                    </div>
                ) : (
                    rows.map(row => {
                        const key = `${row.stationId}:${row.shiftDate}:${row.turno ?? 0}`;
                        const isExpanded = expandedKey === key;
                        return (
                            <div key={key} className="bg-white dark:bg-slate-900 rounded-xl border border-white/80 dark:border-white/8 overflow-hidden"
                                style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.07)' }}>
                                <button className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                                    onClick={() => setExpandedKey(isExpanded ? null : key)}>
                                    <Banknote className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {stationMap.get(row.stationId) ?? row.stationId}
                                        </span>
                                        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono ml-2">{row.shiftDate}</span>
                                        {row.closingTs && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 ml-2">
                                                {getTurnoFromClosingTs(row.closingTs) === 'MANANA' ? 'Mañana' : getTurnoFromClosingTs(row.closingTs) === 'TARDE' ? 'Tarde' : 'Noche'}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-gray-300 dark:text-slate-600 ml-2">(archivo A)</span>
                                    </div>
                                    <div className="text-right shrink-0 mr-2">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(row.cajaTotal)}</p>
                                        {(row.chequeTotal ?? 0) > 0 && (
                                            <p className="text-[10px] text-emerald-500">Cheques: {fmt(row.chequeTotal)}</p>
                                        )}
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>
                                {isExpanded && (
                                    <div className="border-t border-gray-100 dark:border-white/5 px-5 py-4 space-y-1">
                                        <div className="flex items-center text-xs px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                                            <span className="font-bold text-emerald-700 dark:text-emerald-400 flex-1">CAJA (Efectivo)</span>
                                            <span className="font-bold text-gray-900 dark:text-white w-32 text-right">{fmt(row.cajaTotal)}</span>
                                        </div>
                                        <div className="flex items-center text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                                            <span className="font-bold text-gray-700 dark:text-gray-300 flex-1">CHEQUE</span>
                                            <span className="font-bold text-gray-900 dark:text-white w-32 text-right">{fmt(row.chequeTotal)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CajaView;
