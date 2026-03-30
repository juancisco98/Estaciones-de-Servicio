import React, { useState } from 'react';
import { Settings, Plus, Gauge, ChevronDown, ChevronUp, Power, AlertTriangle, Loader2 } from 'lucide-react';
import { Station, Employee, User } from '../types';
import { EMPLOYEE_ROLE_LABELS } from '../constants';
import KnowledgePanelSection from './KnowledgePanelSection';
import StationFormModal from './StationFormModal';

interface AdminSettingsProps {
    stations: Station[];
    onSaveStation: (station: Omit<Station, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<boolean>;
    onDeactivateStation: (id: string) => Promise<boolean>;
    currentUser: User | null;
}

type Section = 'stations' | null;

const AdminSettings: React.FC<AdminSettingsProps> = ({
    stations,
    onSaveStation,
    onDeactivateStation,
    currentUser,
}) => {
    const [expandedSection, setExpandedSection] = useState<Section>('stations');
    const [deactivatingId, setDeactivatingId]   = useState<string | null>(null);
    const [isProcessing, setIsProcessing]       = useState(false);
    const [showModal, setShowModal]             = useState(false);
    const [editingStation, setEditingStation]   = useState<Station | null>(null);

    const toggle = (s: NonNullable<Section>) =>
        setExpandedSection(prev => prev === s ? null : s);

    const handleDeactivateConfirm = async () => {
        if (!deactivatingId) return;
        setIsProcessing(true);
        try {
            await onDeactivateStation(deactivatingId);
        } finally {
            setIsProcessing(false);
            setDeactivatingId(null);
        }
    };

    const deactivatingStation = deactivatingId ? stations.find(s => s.id === deactivatingId) : null;

    const activeStations = stations.filter(s => s.isActive);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950 overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-6 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-3">
                    <Settings className="w-6 h-6 text-amber-500" />
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Ajustes</h1>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Gestión de estaciones</p>
            </div>

            <div className="p-5 space-y-4">

                {/* ── ESTACIONES ── */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-white/80 dark:border-white/8 overflow-hidden"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                    <button
                        onClick={() => toggle('stations')}
                        className="w-full px-6 py-5 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center">
                                <Gauge className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-sm text-gray-900 dark:text-white">Estaciones</p>
                                <p className="text-xs text-gray-400 dark:text-slate-500">{activeStations.length} activas de {stations.length}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={e => { e.stopPropagation(); setShowModal(true); }}
                                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-amber-500 hover:bg-amber-600 rounded-xl text-white transition-all"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                            {expandedSection === 'stations' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                    </button>

                    {expandedSection === 'stations' && (
                        <div className="border-t border-gray-50 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
                            {stations.length === 0 && (
                                <p className="px-6 py-8 text-sm text-gray-400 dark:text-slate-500 text-center">Sin estaciones registradas</p>
                            )}
                            {stations.map(station => (
                                <div key={station.id} className="px-6 py-4 flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${station.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
                                            <p className={`text-sm font-semibold ${station.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>
                                                {station.name || '(Sin nombre)'}
                                            </p>
                                            {station.stationCode && (
                                                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">
                                                    {station.stationCode}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{station.address || '(Sin dirección)'}</p>
                                    </div>
                                    <div className="flex items-center gap-1 ml-3 shrink-0">
                                        <button
                                            onClick={() => setEditingStation(station)}
                                            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-300 dark:text-slate-600 hover:text-amber-500 transition-colors"
                                            title="Editar"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setDeactivatingId(station.id)}
                                            className={`p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors ${
                                                station.isActive
                                                    ? 'text-gray-300 dark:text-slate-600 hover:text-red-400'
                                                    : 'text-gray-300 dark:text-slate-600 hover:text-emerald-400'
                                            }`}
                                            title={station.isActive ? 'Desactivar' : 'Activar'}
                                        >
                                            <Power className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── CONOCIMIENTO DE ESTACIÓN ── */}
                {currentUser?.role === 'ADMIN' && (
                    <KnowledgePanelSection stations={stations} isAdmin={true} />
                )}

                {/* System info */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/10 p-6">
                    <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">Sistema</p>
                    <div className="space-y-2 text-xs text-gray-500 dark:text-slate-400">
                        <div className="flex justify-between">
                            <span>Versión</span>
                            <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">Station-OS 1.0</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Sesión como</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{currentUser?.name ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Rol</span>
                            <span className={`font-bold ${currentUser?.role === 'ADMIN' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {currentUser?.role ?? '—'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Estaciones monitoreadas</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{activeStations.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Station Form Modal — Create */}
            {showModal && (
                <StationFormModal
                    station={null}
                    onSave={onSaveStation}
                    onClose={() => setShowModal(false)}
                />
            )}

            {/* Station Form Modal — Edit */}
            {editingStation && (
                <StationFormModal
                    station={editingStation}
                    onSave={onSaveStation}
                    onClose={() => setEditingStation(null)}
                />
            )}

            {/* Confirmation Modal — Deactivate/Activate */}
            {deactivatingStation && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
                        onClick={() => setDeactivatingId(null)}
                    />
                    <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4 pointer-events-none">
                        <div
                            className="pointer-events-auto w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden animate-scale-in"
                            style={{
                                boxShadow: '0 32px 80px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.15)',
                            }}
                        >
                            <div className="p-6 text-center">
                                <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                                    deactivatingStation.isActive
                                        ? 'bg-red-100 dark:bg-red-500/20'
                                        : 'bg-emerald-100 dark:bg-emerald-500/20'
                                }`}>
                                    <AlertTriangle className={`w-7 h-7 ${
                                        deactivatingStation.isActive
                                            ? 'text-red-500'
                                            : 'text-emerald-500'
                                    }`} />
                                </div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">
                                    {deactivatingStation.isActive ? '¿Desactivar estación?' : '¿Activar estación?'}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400">
                                    {deactivatingStation.isActive
                                        ? <>La estación <strong className="text-gray-700 dark:text-white">{deactivatingStation.name || '(Sin nombre)'}</strong> dejará de aparecer en el mapa y reportes.</>
                                        : <>La estación <strong className="text-gray-700 dark:text-white">{deactivatingStation.name || '(Sin nombre)'}</strong> volverá a estar activa.</>
                                    }
                                </p>
                            </div>
                            <div className="px-6 pb-6 flex gap-3">
                                <button
                                    onClick={() => setDeactivatingId(null)}
                                    className="flex-1 px-4 py-3 min-h-[48px] text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeactivateConfirm}
                                    disabled={isProcessing}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60 ${
                                        deactivatingStation.isActive
                                            ? 'bg-red-500 hover:bg-red-600'
                                            : 'bg-emerald-500 hover:bg-emerald-600'
                                    }`}
                                >
                                    {isProcessing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : deactivatingStation.isActive ? 'Sí, desactivar' : 'Sí, activar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminSettings;
