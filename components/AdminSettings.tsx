import React, { useState } from 'react';
import { Settings, Plus, X, Loader2, Gauge, ChevronDown, ChevronUp, Power } from 'lucide-react';
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

    const toggle = (s: NonNullable<Section>) =>
        setExpandedSection(prev => prev === s ? null : s);

    const handleDeactivate = async (id: string) => {
        setIsProcessing(true);
        try {
            await onDeactivateStation(id);
            setDeactivatingId(null);
        } finally {
            setIsProcessing(false);
        }
    };

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
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${station.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
                                            <p className={`text-sm font-semibold ${station.isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>
                                                {station.name}
                                            </p>
                                            {station.stationCode && (
                                                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">
                                                    {station.stationCode}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{station.address}</p>
                                    </div>
                                    <div className="flex items-center gap-1 ml-3 shrink-0">
                                        {deactivatingId === station.id ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleDeactivate(station.id)}
                                                    disabled={isProcessing}
                                                    className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-2 min-h-[44px] rounded-xl transition-colors"
                                                >
                                                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : station.isActive ? 'Desactivar' : 'Activar'}
                                                </button>
                                                <button onClick={() => setDeactivatingId(null)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setDeactivatingId(station.id)}
                                                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors"
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>
                                        )}
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

            {/* Station Form Modal */}
            {showModal && (
                <StationFormModal
                    station={null}
                    onSave={onSaveStation}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
};

export default AdminSettings;
