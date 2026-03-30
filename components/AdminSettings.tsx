import React, { useState } from 'react';
import { toast } from 'sonner';
import { Settings, Scissors, Plus, Edit2, X, Loader2, Clock, Store, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Barbershop, Barber, Service } from '../types';
import ServiceFormModal from './ServiceFormModal';
import BarbershopFormModal from './BarbershopFormModal';

interface AdminSettingsProps {
  barbershops: Barbershop[];
  barbers: Barber[];
  services: Service[];
  onSaveBarbershop: (shop: Barbershop) => Promise<void>;
  onDeactivateBarbershop: (id: string) => Promise<void>;
  onSaveService: (service: Service) => Promise<void>;
  onDeactivateService: (id: string) => Promise<void>;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({
  barbershops, barbers, services,
  onSaveBarbershop, onDeactivateBarbershop, onSaveService, onDeactivateService,
}) => {
  const [editingShop, setEditingShop] = useState<Barbershop | undefined>(undefined);
  const [showShopModal, setShowShopModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | undefined>(undefined);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'barbershops' | 'services' | 'barbers' | null>('services');
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const globalServices = services.filter(s => !s.barbershopId && s.isActive);
  const shopServices = services.filter(s => s.barbershopId && s.isActive);
  const inactiveServices = services.filter(s => !s.isActive);

  const handleDeactivateService = async (id: string) => {
    setIsDeactivating(true);
    try {
      await onDeactivateService(id);
      toast.success('Servicio desactivado');
      setDeactivatingId(null);
    } catch (err: any) {
      toast.error(`Error: ${err?.message ?? 'Error desconocido'}`);
    } finally {
      setIsDeactivating(false);
    }
  };

  const toggle = (section: 'barbershops' | 'services' | 'barbers') =>
    setExpandedSection(prev => prev === section ? null : section);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-amber-500" />
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Ajustes</h1>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Gestión de barberías, servicios y barberos</p>
      </div>

      <div className="p-4 space-y-3">

        {/* ── BARBERÍAS ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
          <button
            onClick={() => toggle('barbershops')}
            className="w-full px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Store className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-gray-900 dark:text-white">Barberías</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{barbershops.filter(b => b.isActive).length} activas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); setEditingShop(undefined); setShowShopModal(true); }}
                className="p-1.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {expandedSection === 'barbershops' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {expandedSection === 'barbershops' && (
            <div className="border-t border-gray-50 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
              {barbershops.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400 dark:text-slate-500 text-center">No hay barberías</p>
              )}
              {barbershops.map(shop => (
                <div key={shop.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${shop.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>
                      {shop.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{shop.neighborhood ?? shop.address}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {!shop.isActive && (
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        Inactiva
                      </span>
                    )}
                    <button
                      onClick={() => { setEditingShop(shop); setShowShopModal(true); }}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-400 dark:text-slate-500 hover:text-amber-500 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SERVICIOS ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
          <button
            onClick={() => toggle('services')}
            className="w-full px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center">
                <Scissors className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-gray-900 dark:text-white">Catálogo de servicios</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{globalServices.length} globales · {shopServices.length} por local</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); setEditingService(undefined); setShowServiceModal(true); }}
                className="p-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {expandedSection === 'services' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {expandedSection === 'services' && (
            <div className="border-t border-gray-50 dark:border-white/5">
              {services.filter(s => s.isActive).length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400 dark:text-slate-500 text-center">Sin servicios configurados</p>
              )}
              {services.filter(s => s.isActive).map(service => {
                const shopName = service.barbershopId
                  ? barbershops.find(b => b.id === service.barbershopId)?.name
                  : null;
                return (
                  <div key={service.id} className="px-5 py-3 flex items-center justify-between border-b border-gray-50 dark:border-white/5 last:border-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{service.name}</p>
                        {shopName && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                            {shopName.replace('Rufianes ', '')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        ${service.basePrice.toLocaleString('es-AR')} · {service.durationMins} min
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => { setEditingService(service); setShowServiceModal(true); }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-indigo-500 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {deactivatingId === service.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeactivateService(service.id)}
                            disabled={isDeactivating}
                            className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors"
                          >
                            {isDeactivating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sí'}
                          </button>
                          <button
                            onClick={() => setDeactivatingId(null)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeactivatingId(service.id)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── BARBEROS ── */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
          <button
            onClick={() => toggle('barbers')}
            className="w-full px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-gray-900 dark:text-white">Barberos</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{barbers.filter(b => b.isActive).length} activos</p>
              </div>
            </div>
            {expandedSection === 'barbers' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {expandedSection === 'barbers' && (
            <div className="border-t border-gray-50 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
              {barbers.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400 dark:text-slate-500 text-center">Sin barberos registrados</p>
              )}
              {barbers.filter(b => b.isActive).map(barber => {
                const shop = barbershops.find(s => s.id === barber.barbershopId);
                return (
                  <div key={barber.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-gray-600 dark:text-slate-300 shrink-0">
                      {barber.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{barber.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                        {shop?.name ?? 'Sin barbería'} · {barber.commissionPct}% comisión
                      </p>
                      {barber.email && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{barber.email}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


      </div>

      {/* Modales */}
      {showShopModal && (
        <BarbershopFormModal
          mode={editingShop ? 'edit' : 'add'}
          initialData={editingShop}
          onSave={onSaveBarbershop}
          onClose={() => { setShowShopModal(false); setEditingShop(undefined); }}
        />
      )}

      {showServiceModal && (
        <ServiceFormModal
          mode={editingService ? 'edit' : 'add'}
          initialData={editingService}
          barbershops={barbershops}
          onSave={onSaveService}
          onClose={() => { setShowServiceModal(false); setEditingService(undefined); }}
        />
      )}
    </div>
  );
};

export default AdminSettings;
