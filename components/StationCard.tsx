import React from 'react';
import { X, MapPin, Fuel, AlertTriangle, ShoppingCart, ChevronRight, User } from 'lucide-react';
import { Station, Employee, SalesTransaction, Alert } from '../types';
import { ALERT_LEVEL_COLORS, ALERT_LEVEL_LABELS } from '../constants';

interface StationCardProps {
    station: Station;
    employees: Employee[];
    salesTransactions: SalesTransaction[];
    alerts: Alert[];
    onClose: () => void;
    onViewDetails: () => void;
}

const StationCard: React.FC<StationCardProps> = ({
    station,
    employees,
    salesTransactions,
    alerts,
    onClose,
    onViewDetails,
}) => {
    const today        = new Date().toISOString().slice(0, 10);
    const todayTx      = salesTransactions.filter(t => t.shiftDate === today);
    const todayRevenue = todayTx.reduce((s, t) => s + t.totalAmount, 0);
    const todayLiters  = todayTx.filter(t => Number(t.productCode) <= 20).reduce((s, t) => s + t.quantity, 0);
    const criticals    = alerts.filter(a => a.level === 'CRITICAL');
    const topAlert     = criticals[0] ?? alerts[0];

    return (
        <>
            {/* Overlay to close on click outside */}
            <div
                className="absolute inset-0 z-[400] lg:hidden"
                onClick={onClose}
            />

            {/* Card */}
            <div className="absolute bottom-4 left-4 right-4 lg:bottom-auto lg:top-24 lg:right-5 lg:left-auto lg:w-96 z-[500] pointer-events-auto animate-slide-up">
                <div
                    className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl overflow-hidden
                               flex flex-col max-h-[80vh] lg:max-h-[calc(100vh-7rem)]
                               border border-white/70 dark:border-white/10"
                    style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.80)' }}
                >

                    {/* Header */}
                    <div className="shrink-0 p-5 border-b border-gray-100/80 dark:border-white/8 bg-gray-50/50 dark:bg-white/[0.02]">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="font-black text-gray-900 dark:text-white text-lg leading-tight">{station.name}</h2>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                    <p className="text-sm text-gray-400 dark:text-slate-500 truncate">{station.address}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 shrink-0 w-10 h-10 flex items-center justify-center"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {station.stationCode && (
                            <span className="mt-2 inline-block text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                                {station.stationCode}
                            </span>
                        )}
                    </div>

                    {/* Body */}
                    <div className="overflow-y-auto flex-1 p-5 space-y-4">

                        {/* Today's stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <ShoppingCart className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Ventas hoy</span>
                                </div>
                                <p className="text-lg font-black text-gray-900 dark:text-white">
                                    ${todayRevenue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-slate-500">{todayTx.length} transacciones</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Fuel className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Combustible</span>
                                </div>
                                <p className="text-lg font-black text-gray-900 dark:text-white">
                                    {todayLiters.toLocaleString('es-AR', { maximumFractionDigits: 0 })} L
                                </p>
                                <p className="text-xs text-gray-400 dark:text-slate-500">litros hoy</p>
                            </div>
                        </div>

                        {/* Active alert */}
                        {topAlert && (
                            <div className={`rounded-xl p-3 ${
                                topAlert.level === 'CRITICAL'
                                    ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20'
                                    : topAlert.level === 'WARNING'
                                    ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20'
                                    : 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20'
                            }`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertTriangle className={`w-3.5 h-3.5 ${
                                        topAlert.level === 'CRITICAL' ? 'text-red-500' :
                                        topAlert.level === 'WARNING'  ? 'text-orange-500' : 'text-blue-500'
                                    }`} />
                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                        topAlert.level === 'CRITICAL' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' :
                                        topAlert.level === 'WARNING'  ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400' :
                                        'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                                    }`}>
                                        {ALERT_LEVEL_LABELS[topAlert.level]}
                                    </span>
                                    {alerts.length > 1 && (
                                        <span className="text-[10px] text-gray-400 dark:text-slate-500">+{alerts.length - 1} más</span>
                                    )}
                                </div>
                                <p className="text-xs font-semibold text-gray-800 dark:text-white">{topAlert.title}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{topAlert.message}</p>
                            </div>
                        )}

                        {/* Employees */}
                        {employees.length > 0 && (
                            <div>
                                <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Personal</p>
                                <div className="space-y-1">
                                    {employees.slice(0, 4).map(emp => (
                                        <div key={emp.id} className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                                <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                                            </div>
                                            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium flex-1 truncate">{emp.name}</span>
                                            <span className="text-[10px] text-gray-400 dark:text-slate-500">{emp.role}</span>
                                        </div>
                                    ))}
                                    {employees.length > 4 && (
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500 pl-8">+{employees.length - 4} más</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 p-4 border-t border-gray-100/80 dark:border-white/8 bg-gray-50/30 dark:bg-white/[0.02]">
                        <button
                            onClick={onViewDetails}
                            className="w-full flex items-center justify-center gap-2 py-3 min-h-[48px] rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98]"
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                boxShadow: '0 4px 14px rgba(245,158,11,0.35), 0 2px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.20)',
                            }}
                        >
                            Ver detalle completo
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default StationCard;
