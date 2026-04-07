import React, { useState, useMemo } from 'react';
import { CreditCard, Search, TrendingUp, Download } from 'lucide-react';
import { Station, User, CardPayment } from '../types';
import { PAYMENT_METHOD_LABELS } from '../constants';
import { useCardPayments } from '../hooks/useCardPayments';
import StationFilter from './StationFilter';
import TurnoFilter, { Turno, getTurnoFromClosingTs } from './TurnoFilter';
import { getArgentinaToday } from '../utils/dateUtils';
import { exportToCsv } from '../utils/exportCsv';

interface CardPaymentsViewProps {
    stations: Station[];
    currentUser: User | null;
    activeStationId?: string | null;
    onStationChange?: (id: string | null) => void;
}

const PAYMENT_TYPE_COLORS: Record<string, string> = {
    CARD:        'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
    ACCOUNT:     'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400',
    MODO:        'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
    MERCADOPAGO: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400',
};

const CardPaymentsView: React.FC<CardPaymentsViewProps> = ({ stations, currentUser, activeStationId, onStationChange }) => {
    const { cardPayments } = useCardPayments();
    const [selectedStationId, setSelectedStationId] = useState<string | null>(activeStationId ?? null);

    const handleStationChange = (id: string | null) => {
        setSelectedStationId(id);
        onStationChange?.(id);
    };
    const [dateFrom, setDateFrom] = useState(getArgentinaToday);
    const [dateTo, setDateTo]     = useState(getArgentinaToday);
    const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
    const [filterType, setFilterType] = useState<string>('');
    const [search, setSearch]     = useState('');

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    const filtered = useMemo(() => {
        let list = cardPayments;
        if (selectedStationId) list = list.filter(p => p.stationId === selectedStationId);
        list = list.filter(p => p.shiftDate && p.shiftDate >= dateFrom && p.shiftDate <= dateTo);
        if (selectedTurno) list = list.filter(p => p.paymentTs && getTurnoFromClosingTs(p.paymentTs) === selectedTurno);
        if (filterType) list = list.filter(p => p.paymentType === filterType);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                (p.accountName ?? '').toLowerCase().includes(q) ||
                (p.referenceCode ?? '').toLowerCase().includes(q) ||
                (stationMap.get(p.stationId) ?? '').toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => (b.paymentTs ?? '').localeCompare(a.paymentTs ?? ''));
    }, [cardPayments, selectedStationId, selectedTurno, dateFrom, dateTo, filterType, search, stationMap]);

    const totalAmount = filtered.reduce((s, p) => s + p.amount, 0);

    // Breakdown by type
    const breakdown = useMemo(() => {
        const map = new Map<string, { total: number; count: number }>();
        for (const p of filtered) {
            const existing = map.get(p.paymentType);
            if (existing) { existing.total += p.amount; existing.count++; }
            else map.set(p.paymentType, { total: p.amount, count: 1 });
        }
        return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
    }, [filtered]);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-5 pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-5">
                    <CreditCard className="w-6 h-6 text-violet-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Cuentas Corrientes</h1>
                    <button
                        onClick={() => exportToCsv<CardPayment>(
                            `cuentas_corrientes_${dateFrom}_${dateTo}.csv`,
                            [
                                { header: 'Fecha', value: (p: CardPayment) => p.shiftDate ?? '' },
                                { header: 'Estacion', value: (p: CardPayment) => stationMap.get(p.stationId) ?? '' },
                                { header: 'Tipo', value: (p: CardPayment) => PAYMENT_METHOD_LABELS[p.paymentType] ?? p.paymentType },
                                { header: 'Cuenta/Nombre', value: (p: CardPayment) => p.accountName ?? '' },
                                { header: 'Monto', value: (p: CardPayment) => p.amount },
                                { header: 'Referencia', value: (p: CardPayment) => p.referenceCode ?? '' },
                                { header: 'Archivo', value: (p: CardPayment) => p.fileName },
                            ],
                            filtered,
                        )}
                        disabled={filtered.length === 0}
                        className="ml-auto p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Exportar CSV"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <StationFilter
                        stations={stations}
                        selectedStationId={selectedStationId}
                        onChange={handleStationChange}
                        className="min-w-[200px]"
                    />
                    <TurnoFilter selected={selectedTurno} onChange={setSelectedTurno} />

                    <div className="flex items-center gap-1">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-gray-400 text-sm">—</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400"
                        />
                    </div>

                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400"
                    >
                        <option value="">Todos los tipos</option>
                        <option value="CARD">Tarjeta</option>
                        <option value="ACCOUNT">Cuenta Corriente</option>
                        <option value="MODO">MODO QR</option>
                        <option value="MERCADOPAGO">Mercado Pago</option>
                    </select>

                    <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Cuenta, referencia, estación..."
                            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-amber-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                    </div>
                </div>
            </div>

            {/* Summary bar */}
            <div className="shrink-0 px-5 py-3 bg-violet-50 dark:bg-violet-500/5 border-b border-violet-100 dark:border-violet-500/10">
                <div className="flex items-center gap-6 text-sm font-semibold flex-wrap">
                    <span className="text-gray-600 dark:text-gray-300">
                        <span className="text-gray-400 dark:text-slate-500 font-medium">Registros: </span>
                        <strong>{filtered.length.toLocaleString('es-AR')}</strong>
                    </span>
                    <span className="text-violet-700 dark:text-violet-400">
                        <span className="font-medium">Total: </span>
                        <strong>${totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong>
                    </span>
                    {breakdown.map(([type, data]) => (
                        <span key={type} className="text-gray-500 dark:text-slate-400 text-xs">
                            {PAYMENT_METHOD_LABELS[type] ?? type}: <strong>${data.total.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong> ({data.count})
                        </span>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {filtered.length === 0 ? (
                    <div className="py-24 text-center">
                        <TrendingUp className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-700 mb-4" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium text-base">Sin pagos para el período</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-white/10">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">Fecha</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Estación</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Cuenta / Nombre</th>
                                <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Monto</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider hidden md:table-cell">Referencia</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider hidden lg:table-cell">Archivo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {filtered.map(p => {
                                const isNegative = p.amount < 0;
                                return (
                                    <tr
                                        key={p.id}
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
                                            isNegative ? 'bg-red-50/50 dark:bg-red-500/5' : ''
                                        }`}
                                    >
                                        <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-slate-400 font-mono">
                                            {p.shiftDate ? new Date(p.shiftDate + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-[140px] truncate">
                                            {stationMap.get(p.stationId) ?? '—'}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${PAYMENT_TYPE_COLORS[p.paymentType] ?? 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>
                                                {PAYMENT_METHOD_LABELS[p.paymentType] ?? p.paymentType}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-xs font-semibold text-gray-900 dark:text-white max-w-[200px] truncate">
                                            {p.accountName || '—'}
                                        </td>
                                        <td className={`px-5 py-4 text-right text-xs font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                            ${p.amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-gray-400 dark:text-slate-500 font-mono hidden md:table-cell truncate max-w-[120px]">
                                            {p.referenceCode || '—'}
                                        </td>
                                        <td className="px-5 py-4 text-[10px] text-gray-400 dark:text-slate-500 font-mono hidden lg:table-cell truncate max-w-[100px]">
                                            {p.fileName}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default CardPaymentsView;
