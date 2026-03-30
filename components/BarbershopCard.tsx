import React from 'react';
import { X, Scissors, MapPin, Users, TrendingUp, Phone } from 'lucide-react';
import { Barbershop, Barber, HaircutSession } from '../types';

interface DailySummary {
  cuts: number;
  revenue: number;
  activeBarbers: number;
}

interface BarbershopCardProps {
  barbershop: Barbershop | null;
  barbers: Barber[];
  sessions: HaircutSession[];
  getDailySummary: (barbershopId: string) => DailySummary;
  onClose: () => void;
  onViewBarbers: () => void;
}

const BarbershopCard: React.FC<BarbershopCardProps> = ({
  barbershop, barbers, sessions, getDailySummary, onClose, onViewBarbers,
}) => {
  if (!barbershop) return null;

  const summary = getDailySummary(barbershop.id);
  const shopBarbers = barbers.filter(b => b.barbershopId === barbershop.id && b.isActive);

  // Cortes de cada barbero hoy
  const today = new Date().toISOString().slice(0, 10);
  const barberCutsToday = shopBarbers.map(b => {
    const cuts = sessions.filter(s => s.barberId === b.id && s.startedAt.slice(0, 10) === today);
    return {
      barber: b,
      cuts: cuts.length,
      revenue: cuts.reduce((sum, s) => sum + s.price, 0),
    };
  }).sort((a, b) => b.cuts - a.cuts);

  return (
    <div className="
      fixed z-[1000] bg-white dark:bg-slate-900 shadow-2xl border dark:border-white/10 flex flex-col
      bottom-0 left-0 right-0 rounded-t-3xl max-h-[75vh]
      lg:absolute lg:bottom-auto lg:left-auto lg:top-4 lg:right-4 lg:w-80 lg:rounded-3xl lg:max-h-[calc(100vh-80px)]
    ">
      {/* Mobile drag indicator */}
      <div className="lg:hidden flex justify-center pt-2 pb-1 shrink-0">
        <div className="w-10 h-1 bg-gray-200 dark:bg-slate-700 rounded-full" />
      </div>

      {/* Header */}
      <div className="px-5 pt-3 pb-4 lg:p-5 border-b dark:border-white/10 shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-lg text-gray-900 dark:text-white leading-tight">{barbershop.name}</h2>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{barbershop.neighborhood ?? barbershop.address}</p>
            </div>
            {barbershop.phone && (
              <div className="flex items-center gap-1 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <p className="text-xs text-gray-500 dark:text-slate-400">{barbershop.phone}</p>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 ml-2 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-5 space-y-4">
        {/* Métricas de hoy */}
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Hoy</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{summary.cuts}</p>
              <p className="text-[10px] text-amber-500 font-semibold mt-0.5">cortes</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                ${summary.revenue >= 1000 ? `${(summary.revenue / 1000).toFixed(1)}k` : summary.revenue}
              </p>
              <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">revenue</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-3 text-center">
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{summary.activeBarbers}</p>
              <p className="text-[10px] text-indigo-500 font-semibold mt-0.5">barberos</p>
            </div>
          </div>
        </div>

        {/* Barberos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Barberos activos</p>
            <span className="text-xs text-gray-400">{shopBarbers.length}</span>
          </div>
          {barberCutsToday.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-3">Sin barberos activos</p>
          ) : (
            <div className="space-y-2">
              {barberCutsToday.map(({ barber, cuts, revenue }) => (
                <div key={barber.id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-slate-300">
                      {barber.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{barber.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{cuts} cortes</p>
                    {revenue > 0 && <p className="text-[10px] text-gray-400">${revenue.toLocaleString('es-AR')}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t dark:border-white/10 shrink-0">
        <button
          onClick={onViewBarbers}
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all"
        >
          Ver todos los barberos
        </button>
      </div>
    </div>
  );
};

export default BarbershopCard;
