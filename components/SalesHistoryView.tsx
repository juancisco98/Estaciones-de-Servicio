import React, { useState, useMemo } from 'react';
import { ShoppingCart, Search, Filter, AlertTriangle, TrendingUp, Download } from 'lucide-react';
import { Station, SalesTransaction, User } from '../types';
import { PAYMENT_METHOD_LABELS } from '../constants';
import { getArgentinaToday } from '../utils/dateUtils';
import { exportToCsv } from '../utils/exportCsv';
import TurnoFilter, { Turno, getTurnoFromTs } from './TurnoFilter';

interface SalesHistoryViewProps {
    stations: Station[];
    salesTransactions: SalesTransaction[];
    currentUser: User | null;
    activeStationId?: string | null;
    onStationChange?: (id: string | null) => void;
}

const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ stations, salesTransactions, currentUser, activeStationId, onStationChange }) => {
    const [selectedStation, setSelectedStation] = useState<string>(
        activeStationId ?? currentUser?.stationId ?? (stations[0]?.id ?? '')
    );
    const [dateFrom, setDateFrom] = useState(getArgentinaToday);
    const [dateTo, setDateTo]     = useState(getArgentinaToday);
    const [selectedTurno, setSelectedTurno] = useState<Turno | null>(null);
    const [selectedSector, setSelectedSector] = useState<string>('');
    const [search, setSearch]     = useState('');

    const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

    const filtered = useMemo(() => {
        let list = salesTransactions;
        if (selectedStation) list = list.filter(t => t.stationId === selectedStation);
        list = list.filter(t => t.shiftDate >= dateFrom && t.shiftDate <= dateTo);
        if (selectedTurno) list = list.filter(t => getTurnoFromTs(t.transactionTs) === selectedTurno);
        if (selectedSector === 'PLAYA') list = list.filter(t => t.areaCode === 1);
        if (selectedSector === 'SHOP') list = list.filter(t => t.areaCode === 0);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.productName.toLowerCase().includes(q) ||
                t.productCode.includes(q) ||
                (t.paymentMethod ?? '').toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => b.transactionTs.localeCompare(a.transactionTs));
    }, [salesTransactions, selectedStation, dateFrom, dateTo, selectedTurno, selectedSector, search]);

    const totalRevenue   = filtered.reduce((s, t) => s + t.totalAmount, 0);
    const totalFuelLiters = filtered.filter(t => Number(t.productCode) <= 20).reduce((s, t) => s + t.quantity, 0);
    const anomalies      = filtered.filter(t => t.quantity < 0);

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 p-5 pb-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center gap-3 mb-5">
                    <ShoppingCart className="w-6 h-6 text-amber-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Historial de Ventas</h1>
                    <button
                        onClick={() => exportToCsv<SalesTransaction>(
                            `ventas_${dateFrom}_${dateTo}.csv`,
                            [
                                { header: 'Fecha/Hora', value: (t: SalesTransaction) => t.transactionTs.replace('T', ' ').slice(0, 16) },
                                { header: 'Estacion', value: (t: SalesTransaction) => stationMap.get(t.stationId) ?? '' },
                                { header: 'Producto', value: (t: SalesTransaction) => t.productName },
                                { header: 'Codigo', value: (t: SalesTransaction) => t.productCode },
                                { header: 'Cantidad', value: (t: SalesTransaction) => t.quantity },
                                { header: 'Total', value: (t: SalesTransaction) => t.totalAmount },
                                { header: 'Pago', value: (t: SalesTransaction) => PAYMENT_METHOD_LABELS[t.paymentMethod ?? ''] ?? t.paymentMethod ?? '' },
                                { header: 'Archivo', value: (t: SalesTransaction) => t.fileName },
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
                    {currentUser?.role === 'ADMIN' && (
                        <select
                            value={selectedStation}
                            onChange={e => { setSelectedStation(e.target.value); onStationChange?.(e.target.value || null); }}
                            className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400"
                        >
                            <option value="">Todas las estaciones</option>
                            {stations.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}

                    <TurnoFilter selected={selectedTurno} onChange={setSelectedTurno} />

                    <select
                        value={selectedSector}
                        onChange={e => setSelectedSector(e.target.value)}
                        className="text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400"
                    >
                        <option value="">Todos los sectores</option>
                        <option value="PLAYA">Playa</option>
                        <option value="SHOP">Mini Mercado</option>
                    </select>

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

                    <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Producto, código, método..."
                            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-amber-400 focus:outline-none text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
                        />
                    </div>
                </div>
            </div>

            {/* Summary bar */}
            <div className="shrink-0 px-5 py-3 bg-amber-50 dark:bg-amber-500/5 border-b border-amber-100 dark:border-amber-500/10">
                <div className="flex items-center gap-8 text-sm font-semibold flex-wrap">
                    <span className="text-gray-600 dark:text-gray-300">
                        <span className="text-gray-400 dark:text-slate-500 font-medium">Registros: </span>
                        <strong>{filtered.length.toLocaleString('es-AR')}</strong>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                        <span className="font-medium">Total: </span>
                        <strong>${totalRevenue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong>
                    </span>
                    <span className="text-amber-700 dark:text-amber-400">
                        <span className="font-medium">Combustible: </span>
                        <strong>{totalFuelLiters.toLocaleString('es-AR', { maximumFractionDigits: 0 })} L</strong>
                    </span>
                    {anomalies.length > 0 && (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <strong>{anomalies.length} anomalías</strong>
                        </span>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {filtered.length === 0 ? (
                    <div className="py-24 text-center">
                        <TrendingUp className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-700 mb-4" />
                        <p className="text-gray-400 dark:text-slate-500 font-medium text-base">Sin transacciones para el período</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-white/10" style={{
                            boxShadow: '0 1px 0 rgba(255,255,255,0.80)',
                        }}>
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">Fecha/Hora</th>
                                {currentUser?.role === 'ADMIN' && (
                                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Estación</th>
                                )}
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Producto</th>
                                <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Cantidad</th>
                                <th className="text-right px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Total</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider hidden md:table-cell">Pago</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider hidden lg:table-cell">Archivo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                            {filtered.map(t => {
                                const isAnomaly = t.quantity < 0;
                                return (
                                    <tr
                                        key={t.id}
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
                                            isAnomaly ? 'bg-red-50/50 dark:bg-red-500/5' : ''
                                        }`}
                                    >
                                        <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-slate-400 font-mono">
                                            {new Date(t.transactionTs).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        {currentUser?.role === 'ADMIN' && (
                                            <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-[120px] truncate">
                                                {stationMap.get(t.stationId) ?? t.stationId}
                                            </td>
                                        )}
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                {isAnomaly && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{t.productName}</p>
                                                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">{t.productCode}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-5 py-4 text-right text-xs font-semibold ${isAnomaly ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                            {t.quantity.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-5 py-4 text-right text-xs font-bold text-gray-900 dark:text-white">
                                            ${t.totalAmount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-gray-500 dark:text-slate-400 hidden md:table-cell">
                                            {t.paymentMethod ? (PAYMENT_METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod) : '—'}
                                        </td>
                                        <td className="px-5 py-4 text-[10px] text-gray-400 dark:text-slate-500 font-mono hidden lg:table-cell truncate max-w-[100px]">
                                            {t.fileName}
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

export default SalesHistoryView;
