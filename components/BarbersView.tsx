import React, { useState } from 'react';
import { Plus, Pencil, Scissors, TrendingUp, DollarSign, Search, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Barbershop, Barber, HaircutSession, Service } from '../types';
import RegisterSessionModal from './RegisterSessionModal';
import { DEFAULT_COMMISSION_PCT } from '../constants';

const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

interface BarbersViewProps {
  barbershops: Barbershop[];
  barbers: Barber[];
  sessions: HaircutSession[];
  services: Service[];
  onSaveBarber: (barber: Barber) => Promise<void>;
  onDeactivateBarber: (id: string) => Promise<void>;
  onRegisterSession: (session: HaircutSession) => Promise<void>;
  getServicesForShop: (barbershopId: string) => Service[];
}

interface AddBarberFormData {
  name: string;
  email: string;
  phone: string;
  barbershopId: string;
  commissionPct: number;
  specialties: string[];
}

const BarbersView: React.FC<BarbersViewProps> = ({
  barbershops, barbers, sessions, services,
  onSaveBarber, onDeactivateBarber, onRegisterSession, getServicesForShop,
}) => {
  const [selectedShopId, setSelectedShopId] = useState(barbershops[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [registeringBarber, setRegisteringBarber] = useState<Barber | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [formData, setFormData] = useState<AddBarberFormData>({
    name: '', email: '', phone: '', barbershopId: selectedShopId,
    commissionPct: DEFAULT_COMMISSION_PCT, specialties: [],
  });

  const today = new Date().toISOString().slice(0, 10);

  const filteredBarbers = barbers.filter(b => {
    const matchesShop = !selectedShopId || b.barbershopId === selectedShopId;
    const matchesSearch = !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesShop && matchesSearch && b.isActive;
  });

  const getBarberStatsToday = (barberId: string) => {
    const daySessions = sessions.filter(s => s.barberId === barberId && s.startedAt.slice(0, 10) === today);
    return {
      cuts: daySessions.length,
      revenue: daySessions.reduce((sum, s) => sum + s.price, 0),
      commission: daySessions.reduce((sum, s) => sum + s.commissionAmt, 0),
    };
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingBarber(null);
    setFormData({ name: '', email: '', phone: '', barbershopId: selectedShopId, commissionPct: DEFAULT_COMMISSION_PCT, specialties: [] });
  };

  const openEditForm = (barber: Barber) => {
    setEditingBarber(barber);
    setFormData({
      name: barber.name,
      email: barber.email ?? '',
      phone: barber.phone ?? '',
      barbershopId: barber.barbershopId,
      commissionPct: barber.commissionPct,
      specialties: barber.specialties,
    });
    setShowAddForm(true);
  };

  const handleSaveBarber = async () => {
    if (!formData.name.trim()) { toast.error('El nombre es obligatorio.'); return; }
    if (!formData.barbershopId) { toast.error('Seleccioná una barbería.'); return; }

    const barberToSave: Barber = editingBarber
      ? {
          ...editingBarber,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase() || undefined,
          phone: formData.phone.trim() || undefined,
          barbershopId: formData.barbershopId,
          commissionPct: formData.commissionPct,
          specialties: formData.specialties,
        }
      : {
          id: generateUUID(),
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase() || undefined,
          phone: formData.phone.trim() || undefined,
          barbershopId: formData.barbershopId,
          commissionPct: formData.commissionPct,
          specialties: formData.specialties,
          isActive: true,
        };

    setIsSaving(true);
    try {
      await onSaveBarber(barberToSave);
      toast.success(editingBarber ? `${barberToSave.name} actualizado` : `Barbero ${barberToSave.name} agregado`);
      resetForm();
    } catch (error: any) {
      toast.error(`Error: ${error?.message ?? 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (barber: Barber) => {
    if (!confirm(`¿Desactivar a ${barber.name}? Conservará su historial de cortes.`)) return;
    try {
      await onDeactivateBarber(barber.id);
      toast.success(`${barber.name} desactivado`);
    } catch (error: any) {
      toast.error(`Error: ${error?.message ?? 'Error desconocido'}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Barberos</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo barbero
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar barbero..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <select
            value={selectedShopId}
            onChange={e => setSelectedShopId(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Todas</option>
            {barbershops.map(shop => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de barberos */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredBarbers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Scissors className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay barberos activos</p>
            <p className="text-sm mt-1">Agregá el primer barbero con el botón de arriba</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBarbers.map(barber => {
              const stats = getBarberStatsToday(barber.id);
              const shop = barbershops.find(s => s.id === barber.barbershopId);
              return (
                <div key={barber.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
                  <div className="p-5">
                    {/* Avatar + nombre */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-lg font-black text-amber-600 dark:text-amber-400">
                        {barber.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{barber.name}</h3>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{shop?.name ?? '—'} · {barber.commissionPct}% comisión</p>
                      </div>
                    </div>

                    {/* Estadísticas del día */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-2.5 text-center">
                        <p className="text-base font-black text-gray-900 dark:text-white">{stats.cuts}</p>
                        <p className="text-[10px] text-gray-400 font-medium">cortes</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-2.5 text-center">
                        <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
                          ${stats.revenue >= 1000 ? `${(stats.revenue / 1000).toFixed(1)}k` : stats.revenue}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-medium">revenue</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-2.5 text-center">
                        <p className="text-base font-black text-amber-700 dark:text-amber-400">
                          ${stats.commission >= 1000 ? `${(stats.commission / 1000).toFixed(1)}k` : stats.commission}
                        </p>
                        <p className="text-[10px] text-amber-600 font-medium">comisión</p>
                      </div>
                    </div>

                    {/* Especialidades */}
                    {barber.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {barber.specialties.map(sp => (
                          <span key={sp} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                            {sp}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="grid grid-cols-3 border-t border-gray-100 dark:border-white/10">
                    <button
                      onClick={() => setRegisteringBarber(barber)}
                      className="py-3 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      Registrar
                    </button>
                    <button
                      onClick={() => openEditForm(barber)}
                      className="py-3 text-xs font-bold text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors border-l border-gray-100 dark:border-white/10 flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeactivate(barber)}
                      className="py-3 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border-l border-gray-100 dark:border-white/10 flex items-center justify-center gap-1.5"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Desactivar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulario agregar barbero */}
      {showAddForm && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 space-y-4">
            <h2 className="font-black text-lg text-gray-900 dark:text-white">
              {editingBarber ? 'Editar Barbero' : 'Nuevo Barbero'}
            </h2>

            <input
              type="text"
              placeholder="Nombre *"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              type="email"
              placeholder="Email (para login Google)"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              type="tel"
              placeholder="Teléfono"
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <select
              value={formData.barbershopId}
              onChange={e => setFormData(prev => ({ ...prev, barbershopId: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Seleccionar barbería *</option>
              {barbershops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                Comisión: {formData.commissionPct}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={formData.commissionPct}
                onChange={e => setFormData(prev => ({ ...prev, commissionPct: Number(e.target.value) }))}
                className="w-full accent-amber-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={resetForm}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBarber}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar sesión desde admin */}
      {registeringBarber && (
        <RegisterSessionModal
          barber={registeringBarber}
          services={getServicesForShop(registeringBarber.barbershopId)}
          onSave={onRegisterSession}
          onClose={() => setRegisteringBarber(null)}
        />
      )}
    </div>
  );
};

export default BarbersView;
