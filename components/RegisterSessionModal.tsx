import React, { useState, useEffect } from 'react';
import { X, Scissors, Clock, DollarSign, User } from 'lucide-react';
import { toast } from 'sonner';
import { HaircutSession, Barber, Service, PaymentMethod } from '../types';
import { PAYMENT_METHOD_LABELS } from '../constants';

const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

interface RegisterSessionModalProps {
  barber: Barber;
  services: Service[];
  onSave: (session: HaircutSession) => Promise<void>;
  onClose: () => void;
}

const RegisterSessionModal: React.FC<RegisterSessionModalProps> = ({ barber, services, onSave, onClose }) => {
  const [clientName, setClientName] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [startedAt] = useState(() => new Date().toISOString());

  // Precio efectivo: usa el precio del servicio o el personalizado
  const selectedService = services.find(s => s.id === selectedServiceId);
  const effectivePrice = customPrice !== '' ? Number(customPrice) : (selectedService?.basePrice ?? 0);
  const commissionAmt = Math.round(effectivePrice * barber.commissionPct / 100);

  // Rellenar precio cuando se selecciona un servicio
  useEffect(() => {
    if (selectedService) setCustomPrice(String(selectedService.basePrice));
  }, [selectedServiceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectivePrice <= 0) { toast.error('El precio debe ser mayor a 0.'); return; }

    const serviceName = selectedService?.name ?? 'Servicio libre';
    const session: HaircutSession = {
      id: generateUUID(),
      barbershopId: barber.barbershopId,
      barberId: barber.id,
      clientName: clientName.trim() || undefined,
      serviceId: selectedServiceId || undefined,
      serviceName,
      price: effectivePrice,
      commissionPct: barber.commissionPct,
      commissionAmt,
      paymentMethod,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMins: Math.round((Date.now() - new Date(startedAt).getTime()) / 60000),
      notes: notes.trim() || undefined,
    };

    setIsSaving(true);
    try {
      await onSave(session);
      toast.success(`Corte registrado — $${effectivePrice.toLocaleString('es-AR')} | Comisión: $${commissionAmt.toLocaleString('es-AR')}`);
      onClose();
    } catch (error: any) {
      toast.error(`Error al registrar: ${error?.message ?? 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Registrar Corte</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">{barber.name} · {barber.commissionPct}% comisión</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {/* Cliente */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-4 h-4" /> Cliente
            </label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Nombre del cliente (opcional)"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Servicio */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Scissors className="w-4 h-4" /> Servicio
            </label>
            <select
              value={selectedServiceId}
              onChange={e => setSelectedServiceId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">— Precio libre —</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — ${s.basePrice.toLocaleString('es-AR')}
                </option>
              ))}
            </select>
          </div>

          {/* Precio */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Precio
            </label>
            <input
              type="number"
              min="0"
              step="50"
              value={customPrice}
              onChange={e => setCustomPrice(e.target.value)}
              placeholder="$0"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {effectivePrice > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">
                Tu comisión: ${commissionAmt.toLocaleString('es-AR')} ({barber.commissionPct}%)
              </p>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2 block">Método de pago</label>
            <div className="grid grid-cols-3 gap-2">
              {(['CASH', 'CARD', 'TRANSFER'] as PaymentMethod[]).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    paymentMethod === method
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:border-amber-300'
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Fade bajo, barba perfilada..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t dark:border-white/10 shrink-0">
          <button
            onClick={handleSubmit as any}
            disabled={isSaving || effectivePrice <= 0}
            className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <Scissors className="w-5 h-5" />
                Registrar corte · ${effectivePrice.toLocaleString('es-AR')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterSessionModal;
