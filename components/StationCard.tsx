import React from 'react';
import { X, MapPin, Fuel, ShoppingCart, ChevronRight, User } from 'lucide-react';
import { Station, Employee, SalesTransaction } from '../types';
import { getArgentinaToday } from '../utils/dateUtils';

interface StationCardProps {
    station: Station;
    employees: Employee[];
    salesTransactions: SalesTransaction[];
    onClose: () => void;
    onViewDetails: () => void;
}

const StationCard: React.FC<StationCardProps> = ({
    station,
    employees,
    salesTransactions,
    onClose,
    onViewDetails,
}) => {
    const today        = getArgentinaToday();
    const todayTx      = salesTransactions.filter(t => t.shiftDate === today);
    const todayRevenue = todayTx.reduce((s, t) => s + t.totalAmount, 0);
    const todayLiters  = todayTx.filter(t => Number(t.productCode) <= 20).reduce((s, t) => s + t.quantity, 0);

    return (
        <>
            <div
                className="absolute inset-0 z-[400] lg:hidden"
                onClick={onClose}
            />
            <div className="absolute bottom-4 left-4 right-4 lg:bottom-auto lg:top-24 lg:right-5 lg:left-auto lg:w-96 z-[500] pointer-events-auto animate-slide-up">
                <div
                    className="bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl overflow-hidden
                               flex flex-col max-h-[80vh] lg:max-h-[calc(100vh-7rem)]
                               border border-white/70 dark:border-white/10"
                    style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.80)' }}
                >
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
                    <div className="overflow-y-auto flex-1 p-5 space-y-4">
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
