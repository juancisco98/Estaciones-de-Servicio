import React, { useState, useMemo } from 'react';
import { ClipboardCheck, Search, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Station, DailyClosing, Alert, User, ClosingStatus } from '../types';
import { CLOSING_STATUS_LABELS, CLOSING_STATUS_COLORS } from '../constants';

interface ReconciliationViewProps {
    stations: Station[];
    dailyClosings: DailyClosing[];
    alerts: Alert[];
    onAddNotes: (id: string, notes: string) => Promise<boolean>;
    currentUser: User | null;
}

const StatusIcon: React.FC<{ status: ClosingStatus }> = ({ status }) => {
    if (status === 'RECONCILED')  return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === 'DISCREPANCY') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
};

const fmt = (n?: number) => n != null ? `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—';

const ClosingRow: React.FC<{
    closing: DailyClosing;
    stationName: string;
    isAdmin: boolean;
    onAddNotes: (id: string, notes: string) => Promise<boolean>;
}> = ({ closing, stationName, isAdmin, onAddNotes }) => {
    const [expanded, setExpanded] = useState(false);
    const [editNote, setEditNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const colorKey = CLOSING_STATUS_COLORS[closing.status] ?? 'gray';
    const absPercent = closing.reconciliationDiff != null && closing.transactionsTotal
        ? Math.abs(closing.reconciliationDiff / closing.transactionsTotal * 100)
        : null;

    const handleSaveNote = async () => {
        if (!editNote.trim()) return;
        setSavingNote(true);
        const ok = await onAddNotes(closing.id, editNote.trim());
        if (ok) setEditNote('');
        setSavingNote(false);
    };

    return (
        <div
            className={`bg-white dark:bg-slate-900 rounded-xl overflow-hidden border ${
                closing.status === 'DISCREPANCY' ? 'border-red-200 dark:border-red-500/30' :
                closing.status === 'RECONCILED'  ? 'border-emerald-100 dark:border-emerald-500/20' :
                'border-white/80 dark:border-white/8'
            }`}
            style={{
                boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.80)',
            }}
        >
            {/* Row summary */}
            <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                onClick={() => setExpanded(v => !v)}
            >
                <StatusIcon status={closing.status} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{stationName}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">{closing.shiftDate}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-${colorKey}-100 dark:bg-${colorKey}-500/20 text-${colorKey}-700 dark:text-${colorKey}-400`}>
                            {CLOSING_STATUS_LABELS[closing.status]}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{fmt(closing.transactionsTotal)}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500">Transacciones</p>
                    </div>
                    {closing.reconciliationDiff != null && (
                        <div className="text-right hidden md:block">
                            <p className={`text-xs font-bold ${Math.abs(closing.reconciliationDiff) > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {closing.reconciliationDiff > 0 ? '+' : ''}{fmt(closing.reconciliationDiff)}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500">
                                {absPercent != null ? `${absPercent.toFixed(2)}%` : 'Diferencia'}
                            </p>
                        </div>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
            </button>

            {/* Expanded detail */}
            {expanded && (
                <div className="border-t border-gray-50 dark:border-white/5 p-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                            <p className="text-gray-400 dark:text-slate-500 mb-0.5">Total Playa (P)</p>
                            <p className="font-bold text-gray-900 dark:text-white">{fmt(closing.forecourtTotal)}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 dark:text-slate-500 mb-0.5">Total Salón (S)</p>
                            <p className="font-bold text-gray-900 dark:text-white">{fmt(closing.shopTotal)}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 dark:text-slate-500 mb-0.5">Suma VE</p>
                            <p className="font-bold text-gray-900 dark:text-white">{fmt(closing.transactionsTotal)}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 dark:text-slate-500 mb-0.5">Diferencia</p>
                            <p className={`font-bold ${
                                closing.reconciliationDiff != null && Math.abs(closing.reconciliationDiff) > 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                                {fmt(closing.reconciliationDiff)}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 dark:text-slate-500">
                        {closing.pFileName && <p>Archivo P: <span className="font-mono text-gray-600 dark:text-gray-400">{closing.pFileName}</span></p>}
                        {closing.sFileName && <p>Archivo S: <span className="font-mono text-gray-600 dark:text-gray-400">{closing.sFileName}</span></p>}
                    </div>

                    {closing.notes && (
                        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Notas</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{closing.notes}</p>
                        </div>
                    )}

                    {isAdmin && (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={editNote}
                                onChange={e => setEditNote(e.target.value)}
                                placeholder="Agregar nota..."
                                className="flex-1 text-xs px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-amber-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                            />
                            <button
                                onClick={handleSaveNote}
                                disabled={savingNote || !editNote.trim()}
                                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-50 transition-colors flex items-center gap-1"
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Guardar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ReconciliationView: React.FC<ReconciliationViewProps> = ({
    stations,
    dailyClosings,
    alerts,
    onAddNotes,
    currentUser,
}) => {
    const [search, setSearch]       = useState('');
    const [filterStatus, setFilterStatus] = useState<ClosingStatus | 'ALL'>('ALL');
    const [dateFrom, setDateFrom]   = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const [dateTo, setDateTo]       = useState(new Date().toISOString().slice(0, 10));

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    const filtered = useMemo(() => {
        let list = dailyClosings;
        if (filterStatus !== 'ALL') list = list.filter(c => c.status === filterStatus);
        list = list.filter(c => c.shiftDate >= dateFrom && c.shiftDate <= dateTo);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                (stationMap.get(c.stationId) ?? '').toLowerCase().includes(q) ||
                c.shiftDate.includes(q)
            );
        }
        return list.sort((a, b) => {
            const statusOrder = (s: ClosingStatus) => s === 'DISCREPANCY' ? 0 : s === 'PENDING' ? 1 : 2;
            const diff = statusOrder(a.status) - statusOrder(b.status);
            if (diff !== 0) return diff;
            return b.shiftDate.localeCompare(a.shiftDate);
        });
    }, [dailyClosings, filterStatus, dateFrom, dateTo, search, stationMap]);

    const discrepancies = dailyClosings.filter(c => c.status === 'DISCREPANCY').length;
    const pending       = dailyClosings.filter(c => c.status === 'PENDING').length;
    const reconciled    = dailyClosings.filter(c => c.status === 'RECONCILED').length;

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-4 pb-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-4">
                    <ClipboardCheck className="w-5 h-5 text-amber-500" />
                    <h1 className="text-xl font-black text-gray-900 dark:text-white">Reconciliación</h1>
                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                        {discrepancies > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                                {discrepancies} discrepancias
                            </span>
                        )}
                        {pending > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                                {pending} pendientes
                            </span>
                        )}
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                            {reconciled} conciliados
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-3 py-2 focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-gray-400 text-sm">—</span>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-3 py-2 focus:outline-none focus:border-amber-400"
                        />
                    </div>

                    <div className="flex items-center gap-1">
                        {(['ALL', 'DISCREPANCY', 'PENDING', 'RECONCILED'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all duration-150 active:scale-95"
                                style={filterStatus === s ? {
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    color: 'white',
                                    boxShadow: '0 2px 8px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.20)',
                                } : {
                                    background: 'rgba(255,255,255,0.72)',
                                    backdropFilter: 'blur(8px)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.80)',
                                }}
                            >
                                <span className={filterStatus !== s ? 'text-gray-500 dark:text-slate-400' : ''}>
                                    {s === 'ALL' ? 'Todos' : CLOSING_STATUS_LABELS[s]}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar estación o fecha..."
                            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-amber-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                    </div>
                </div>
            </div>

            {/* Closings list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filtered.length === 0 ? (
                    <div className="py-20 text-center">
                        <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-700 mb-3" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium">Sin cierres para el período</p>
                    </div>
                ) : (
                    filtered.map(closing => (
                        <ClosingRow
                            key={closing.id}
                            closing={closing}
                            stationName={stationMap.get(closing.stationId) ?? closing.stationId}
                            isAdmin={currentUser?.role === 'ADMIN'}
                            onAddNotes={onAddNotes}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default ReconciliationView;
