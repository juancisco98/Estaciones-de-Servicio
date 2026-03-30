import React, { useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { X, Search, Loader2, MapPin, Scissors, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Barbershop, WeekSchedule, DEFAULT_WEEK_SCHEDULE, DayHours } from '../types';
import { geocodeAddress } from '../utils/geocoding';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

const generateUUID = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

interface BarbershopFormModalProps {
  mode: 'add' | 'edit';
  initialData?: Barbershop;
  onSave: (shop: Barbershop) => Promise<void>;
  onClose: () => void;
}

const BarbershopFormModal: React.FC<BarbershopFormModalProps> = ({ mode, initialData, onSave, onClose }) => {
  const [name, setName] = useState(initialData?.name ?? '');
  const [phone, setPhone] = useState(initialData?.phone ?? '');
  const [managerName, setManagerName] = useState(initialData?.managerName ?? '');
  const [neighborhood, setNeighborhood] = useState(initialData?.neighborhood ?? '');
  const [addressInput, setAddressInput] = useState(initialData?.address ?? '');
  const [formattedAddress, setFormattedAddress] = useState(initialData?.address ?? '');
  const [coordinates, setCoordinates] = useState<[number, number] | null>(initialData?.coordinates ?? null);
  const [chairCount, setChairCount] = useState(initialData?.chairCount ?? 2);
  const [openingHours, setOpeningHours] = useState<WeekSchedule>(
    initialData?.openingHours ?? DEFAULT_WEEK_SCHEDULE
  );
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHoursSection, setShowHoursSection] = useState(false);

  const markerRef = useRef<L.Marker | null>(null);

  const handleGeocode = useCallback(async () => {
    if (!addressInput.trim()) return;
    setIsGeocoding(true);
    try {
      const result = await geocodeAddress(addressInput.trim());
      if (result) {
        setCoordinates([result.lat, result.lng]);
        setFormattedAddress(result.formattedAddress);
        toast.success('Dirección encontrada');
      } else {
        toast.error('No se encontró la dirección. Probá con más detalle (ej: "Av. Santa Fe 3454, Buenos Aires")');
      }
    } finally {
      setIsGeocoding(false);
    }
  }, [addressInput]);

  const updateDay = useCallback((day: DayKey, patch: Partial<DayHours>) => {
    setOpeningHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }, []);

  const validate = (): string | null => {
    if (!name.trim()) return 'El nombre es obligatorio.';
    if (!addressInput.trim()) return 'La dirección es obligatoria.';
    if (!coordinates) return 'Buscá la dirección para obtener las coordenadas en el mapa.';
    for (const day of DAY_KEYS) {
      const dh = openingHours[day];
      if (dh.isOpen && dh.close <= dh.open) {
        return `Horario inválido el ${DAY_LABELS[day]}: el cierre debe ser después de la apertura.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) { toast.error(error); return; }

    setIsSaving(true);
    try {
      const shop: Barbershop = {
        id: initialData?.id ?? generateUUID(),
        name: name.trim(),
        address: formattedAddress || addressInput.trim(),
        coordinates: coordinates!,
        neighborhood: neighborhood.trim() || undefined,
        phone: phone.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        isActive,
        managerName: managerName.trim() || undefined,
        notes: notes.trim() || undefined,
        chairCount: chairCount || undefined,
        openingHours,
      };
      await onSave(shop);
      toast.success(mode === 'add' ? 'Barbería creada' : 'Barbería actualizada');
      onClose();
    } catch (err: any) {
      toast.error(`Error: ${err?.message ?? 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const customPin = L.divIcon({
    html: `<div style="background:#f59e0b;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px">✂️</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Scissors className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="font-black text-lg text-gray-900 dark:text-white">
              {mode === 'add' ? 'Nueva Barbería' : 'Editar Barbería'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Nombre */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Rufianes Palermo"
              className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Dirección + Geocoding */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Dirección *</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                placeholder="Av. Santa Fe 3454, Palermo, Buenos Aires"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={handleGeocode}
                disabled={isGeocoding || !addressInput.trim()}
                className="px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="hidden sm:inline">Buscar</span>
              </button>
            </div>
            {formattedAddress && coordinates && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{formattedAddress}</span>
              </div>
            )}
          </div>

          {/* Mini mapa con marker draggable */}
          {coordinates && (
            <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10" style={{ height: 180 }}>
              <MapContainer
                key={`${coordinates[0]}-${coordinates[1]}`}
                center={coordinates}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <Marker
                  position={coordinates}
                  icon={customPin}
                  draggable={true}
                  ref={markerRef}
                  eventHandlers={{
                    dragend: (e) => {
                      const latlng = (e.target as L.Marker).getLatLng();
                      setCoordinates([latlng.lat, latlng.lng]);
                    }
                  }}
                />
              </MapContainer>
            </div>
          )}

          {/* Fila: barrio + teléfono */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Barrio</label>
              <input
                type="text"
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                placeholder="Palermo"
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Teléfono</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+54 11 1234-5678"
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Fila: encargado + sillones */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Encargado</label>
              <input
                type="text"
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                placeholder="Nombre del encargado"
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Sillones</label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChairCount(v => Math.max(1, v - 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-white font-bold text-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  −
                </button>
                <span className="flex-1 text-center font-black text-lg text-gray-900 dark:text-white">{chairCount}</span>
                <button
                  type="button"
                  onClick={() => setChairCount(v => Math.min(20, v + 1))}
                  className="w-10 h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-white font-bold text-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Horarios de apertura — colapsable */}
          <div className="border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHoursSection(v => !v)}
              className="w-full px-4 py-3.5 flex items-center justify-between bg-gray-50 dark:bg-slate-800 text-sm font-bold text-gray-700 dark:text-white"
            >
              <span>Horarios de apertura</span>
              {showHoursSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showHoursSection && (
              <div className="px-4 py-3 space-y-2">
                {DAY_KEYS.map(day => {
                  const dh = openingHours[day];
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className={`w-9 text-center text-xs font-bold rounded-lg py-1 shrink-0 ${dh.isOpen ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'}`}>
                        {DAY_LABELS[day]}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateDay(day, { isOpen: !dh.isOpen })}
                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${dh.isOpen ? 'bg-amber-500' : 'bg-gray-200 dark:bg-slate-700'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dh.isOpen ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      {dh.isOpen ? (
                        <>
                          <input
                            type="time"
                            value={dh.open}
                            onChange={e => updateDay(day, { open: e.target.value })}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <span className="text-gray-400 text-xs shrink-0">—</span>
                          <input
                            type="time"
                            value={dh.close}
                            onChange={e => updateDay(day, { close: e.target.value })}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-slate-500 italic">Cerrado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones internas..."
              className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Estado activo (solo en edit) */}
          {mode === 'edit' && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-white">Barbería activa</span>
              <button
                type="button"
                onClick={() => setIsActive(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-amber-500' : 'bg-gray-200 dark:bg-slate-700'}`}
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
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'add' ? 'Crear barbería' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarbershopFormModal;
