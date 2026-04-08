import React, { useState, useEffect } from 'react';
import { X, Loader2, MapPin, Phone, User, Hash, FolderOpen, StickyNote, Save } from 'lucide-react';
import { Station } from '../types';

interface StationFormModalProps {
    station?: Station | null;
    onSave: (data: Partial<Station> & { name: string; address: string }) => Promise<boolean>;
    onClose: () => void;
}

const StationFormModal: React.FC<StationFormModalProps> = ({ station, onSave, onClose }) => {
    const isEdit = !!station?.id;

    const [name, setName]               = useState(station?.name ?? '');
    const [address, setAddress]         = useState(station?.address ?? '');
    const [city, setCity]               = useState(station?.city ?? '');
    const [province, setProvince]       = useState(station?.province ?? '');
    const [phone, setPhone]             = useState(station?.phone ?? '');
    const [managerName, setManagerName] = useState(station?.managerName ?? '');
    const [stationCode, setStationCode] = useState(station?.stationCode ?? '');
    const [watchPath, setWatchPath]     = useState(station?.watchPath ?? '');
    const [notes, setNotes]             = useState(station?.notes ?? '');
    const [lat, setLat]                 = useState(String(station?.coordinates?.[0] ?? '-34.6037'));
    const [lng, setLng]                 = useState(String(station?.coordinates?.[1] ?? '-58.3816'));
    const [isSaving, setIsSaving]       = useState(false);
    const [error, setError]             = useState('');

    useEffect(() => {
        const el = document.getElementById('station-form-name');
        if (el) el.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
        if (!address.trim()) { setError('La dirección es obligatoria.'); return; }

        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (isNaN(parsedLat) || isNaN(parsedLng)) { setError('Coordenadas inválidas.'); return; }

        setIsSaving(true);
        try {
            const ok = await onSave({
                ...(station?.id ? { id: station.id } : {}),
                name: name.trim(),
                address: address.trim(),
                city: city.trim() || undefined,
                province: province.trim() || undefined,
                phone: phone.trim() || undefined,
                managerName: managerName.trim() || undefined,
                stationCode: stationCode.trim() || undefined,
                watchPath: watchPath.trim() || undefined,
                notes: notes.trim() || undefined,
                coordinates: [parsedLat, parsedLng] as [number, number],
                isActive: station?.isActive ?? true,
            });
            if (ok) onClose();
            else setError('Error al guardar. Intentá de nuevo.');
        } catch {
            setError('Error inesperado al guardar.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
                onClick={onClose}
            />
            <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="pointer-events-auto w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl overflow-hidden flex flex-col animate-scale-in"
                    style={{
                        boxShadow: '0 32px 80px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.10)',
                    }}
                >
                    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/10 shrink-0">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">
                            {isEdit ? 'Editar Estación' : 'Nueva Estación'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 transition-colors w-10 h-10 flex items-center justify-center"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Nombre *
                            </label>
                            <input
                                id="station-form-name"
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Ej: Estación La Plata Norte"
                                className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                <MapPin className="w-3 h-3 inline mr-1" />Dirección *
                            </label>
                            <input
                                type="text"
                                value={address}
                                onChange={e => setAddress(e.target.value)}
                                placeholder="Ej: Av. San Martín 1234"
                                className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Ciudad
                                </label>
                                <input
                                    type="text"
                                    value={city}
                                    onChange={e => setCity(e.target.value)}
                                    placeholder="Ej: La Plata"
                                    className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Provincia
                                </label>
                                <input
                                    type="text"
                                    value={province}
                                    onChange={e => setProvince(e.target.value)}
                                    placeholder="Ej: Buenos Aires"
                                    className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    <Hash className="w-3 h-3 inline mr-1" />Código
                                </label>
                                <input
                                    type="text"
                                    value={stationCode}
                                    onChange={e => setStationCode(e.target.value)}
                                    placeholder="Ej: EST_001"
                                    className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    <Phone className="w-3 h-3 inline mr-1" />Teléfono
                                </label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="Ej: (221) 555-1234"
                                    className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                <User className="w-3 h-3 inline mr-1" />Encargado
                            </label>
                            <input
                                type="text"
                                value={managerName}
                                onChange={e => setManagerName(e.target.value)}
                                placeholder="Nombre del encargado"
                                className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Latitud
                                </label>
                                <input
                                    type="text"
                                    value={lat}
                                    onChange={e => setLat(e.target.value)}
                                    placeholder="-34.6037"
                                    className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Longitud
                                </label>
                                <input
                                    type="text"
                                    value={lng}
                                    onChange={e => setLng(e.target.value)}
                                    placeholder="-58.3816"
                                    className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 font-mono"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                <FolderOpen className="w-3 h-3 inline mr-1" />Ruta de archivos (Edge Agent)
                            </label>
                            <input
                                type="text"
                                value={watchPath}
                                onChange={e => setWatchPath(e.target.value)}
                                placeholder="Ej: D:\SVAPP\EST_001"
                                className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                <StickyNote className="w-3 h-3 inline mr-1" />Notas
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Notas adicionales..."
                                rows={2}
                                className="w-full px-4 py-3 min-h-[44px] text-sm rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 resize-none"
                            />
                        </div>
                        {error && (
                            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3">
                                <p className="text-xs text-red-600 dark:text-red-400 font-semibold">{error}</p>
                            </div>
                        )}
                    </form>
                    <div className="shrink-0 px-6 py-5 border-t border-gray-100 dark:border-white/10 flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-3 min-h-[48px] text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit as any}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-xl text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                boxShadow: '0 4px 14px rgba(245,158,11,0.35), 0 2px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.20)',
                            }}
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {isEdit ? 'Guardar Cambios' : 'Crear Estación'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default StationFormModal;
