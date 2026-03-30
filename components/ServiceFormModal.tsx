import React, { useState } from 'react';
import { X, Scissors, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Service, Barbershop } from '../types';

const generateUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

interface ServiceFormModalProps {
  mode: 'add' | 'edit';
  initialData?: Service;
  barbershops: Barbershop[];
  onSave: (service: Service) => Promise<void>;
  onClose: () => void;
}

const ServiceFormModal: React.FC<ServiceFormModalProps> = ({ mode, initialData, barbershops, onSave, onClose }) => {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [basePrice, setBasePrice] = useState(String(initialData?.basePrice ?? ''));
  const [durationMins, setDurationMins] = useState(initialData?.durationMins ?? 30);
  const [barbershopId, setBarbershopId] = useState(initialData?.barbershopId ?? '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('El nombre es obligatorio.'); return; }
    const price = parseFloat(basePrice);
    if (isNaN(price) || price <= 0) { toast.error('El precio debe ser mayor a 0.'); return; }

    setIsSaving(true);
    try {
      const service: Service = {
        id: initialData?.id ?? generateUUID(),
        name: name.trim(),
        description: description.trim() || undefined,
        basePrice: price,
        durationMins,
        barbershopId: barbershopId || undefined,
        isActive,
      };
      await onSave(service);
      toast.success(mode === 'add' ? 'Servicio creado' : 'Servicio actualizado');
      onClose();
    } catch (err: any) {
      toast.error(`Error: ${err?.message ?? 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Scissors className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="font-black text-lg text-gray-900 dark:text-white">
              {mode === 'add' ? 'Nuevo Servicio' : 'Editar Servicio'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Corte clásico"
              className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Descripción</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Breve descripción opcional"
              className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Precio */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Precio base (ARS) *</label>
            <input
              type="number"
              min="0"
              step="100"
              value={basePrice}
              onChange={e => setBasePrice(e.target.value)}
              placeholder="3500"
              className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Duración */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Duración: <span className="text-indigo-600 dark:text-indigo-400">{durationMins} min</span>
            </label>
            <input
              type="range"
              min="10"
              max="120"
              step="5"
              value={durationMins}
              onChange={e => setDurationMins(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
              <span>10 min</span>
              <span>120 min</span>
            </div>
          </div>

          {/* Barbería (global o específica) */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Disponible en</label>
            <select
              value={barbershopId}
              onChange={e => setBarbershopId(e.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Todas las barberías (global)</option>
              {barbershops.filter(b => b.isActive).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Estado activo (solo edit) */}
          {mode === 'edit' && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-white">Servicio activo</span>
              <button
                type="button"
                onClick={() => setIsActive(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-slate-700'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'add' ? 'Crear servicio' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceFormModal;
