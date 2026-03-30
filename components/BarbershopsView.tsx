import React, { useState } from 'react';
import { Plus, Store, MapPin, Scissors, Clock, ChevronRight } from 'lucide-react';
import { Barbershop, Barber, HaircutSession } from '../types';
import BarbershopFormModal from './BarbershopFormModal';

interface DailySummary {
  cuts: number;
  revenue: number;
  activeBarbers: number;
}

interface BarbershopsViewProps {
  barbershops: Barbershop[];
  barbers: Barber[];
  sessions: HaircutSession[];
  getDailySummary: (barbershopId: string) => DailySummary;
  onSaveBarbershop: (shop: Barbershop) => Promise<void>;
  onDeactivateBarbershop: (id: string) => Promise<void>;
  onViewOnMap: (shop: Barbershop) => void;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const getTodayStatus = (shop: Barbershop): { label: string; open: boolean } => {
  if (!shop.isActive) return { label: 'Inactiva', open: false };
  if (!shop.openingHours) return { label: 'Sin horario', open: false };
  const dayKey = DAY_KEYS[new Date().getDay()];
  const day = shop.openingHours[dayKey];
  if (!day.isOpen) return { label: 'Cerrada hoy', open: false };
  return { label: `${day.open} – ${day.close}`, open: true };
};

const BarbershopsView: React.FC<BarbershopsViewProps> = ({
  barbershops, barbers, sessions, getDailySummary, onSaveBarbershop, onDeactivateBarbershop, onViewOnMap,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingShop, setEditingShop] = useState<Barbershop | undefined>(undefined);

  const handleEdit = (shop: Barbershop) => {
    setEditingShop(shop);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingShop(undefined);
    setShowModal(true);
  };

  const today = new Date().toISOString().slice(0, 10);
  const activeShops = barbershops.filter(b => b.isActive);
  const inactiveShops = barbershops.filter(b => !b.isActive);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white">Barberías</h1>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{activeShops.length} activas · {barbershops.length} en total</p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {barbershops.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">
            <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay barberías</p>
            <p className="text-sm mt-1">Creá la primera usando el botón "Nueva"</p>
          </div>
        )}

        {activeShops.map(shop => {
          const summary = getDailySummary(shop.id);
          const shopBarbers = barbers.filter(b => b.barbershopId === shop.id && b.isActive);
          const todayStatus = getTodayStatus(shop);

          return (
            <div key={shop.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
              <div className="p-4 flex items-start gap-4">
                {/* Ícono */}
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/20 rounded-2xl flex items-center justify-center shrink-0">
                  <Scissors className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{shop.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{shop.neighborhood ?? shop.address}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      todayStatus.open
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                    }`}>
                      {todayStatus.open ? '● Abierta' : '● Cerrada'}
                    </div>
                  </div>

                  {/* Detalles */}
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    {shop.chairCount && (
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        {shop.chairCount} sillón{shop.chairCount !== 1 ? 'es' : ''}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-slate-500">·</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{shopBarbers.length} barbero{shopBarbers.length !== 1 ? 's' : ''}</span>
                    {todayStatus.open && (
                      <>
                        <span className="text-xs text-gray-400 dark:text-slate-500">·</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500 dark:text-slate-400">{todayStatus.label}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Métricas de hoy */}
                  {summary.cuts > 0 && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs font-black text-amber-700 dark:text-amber-400">{summary.cuts}</span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-500">cortes</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                          ${summary.revenue >= 1000 ? `${(summary.revenue / 1000).toFixed(1)}k` : summary.revenue.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-500">hoy</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 py-3 border-t border-gray-50 dark:border-white/5 flex items-center gap-2">
                <button
                  onClick={() => onViewOnMap(shop)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Ver en mapa
                </button>
                <button
                  onClick={() => handleEdit(shop)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors ml-auto"
                >
                  Editar <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Inactivas (colapsadas) */}
        {inactiveShops.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Inactivas ({inactiveShops.length})</p>
            {inactiveShops.map(shop => (
              <div key={shop.id} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-white/10 px-4 py-3 flex items-center justify-between mb-2 opacity-60">
                <div>
                  <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">{shop.name}</p>
                  <p className="text-xs text-gray-400">{shop.neighborhood ?? shop.address}</p>
                </div>
                <button
                  onClick={() => handleEdit(shop)}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Reactivar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <BarbershopFormModal
          mode={editingShop ? 'edit' : 'add'}
          initialData={editingShop}
          onSave={onSaveBarbershop}
          onClose={() => { setShowModal(false); setEditingShop(undefined); }}
        />
      )}
    </div>
  );
};

export default BarbershopsView;
