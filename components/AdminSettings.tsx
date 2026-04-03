import React, { useState } from 'react';
import { Settings, Plus, Gauge, ChevronDown, ChevronUp, Power, AlertTriangle, Loader2, Users, Trash2, Building2, Bell, Droplets } from 'lucide-react';
import { Station, Employee, User } from '../types';
import { useOwnerPreferences } from '../hooks/useOwnerPreferences';
import { EMPLOYEE_ROLE_LABELS } from '../constants';
import KnowledgePanelSection from './KnowledgePanelSection';
import StationFormModal from './StationFormModal';
import { useAllowedEmails } from '../hooks/useAllowedEmails';
import { useStations } from '../hooks/useStations';

interface AdminSettingsProps {
    stations: Station[];
    onSaveStation: (station: Omit<Station, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<boolean>;
    onDeactivateStation: (id: string) => Promise<boolean>;
    currentUser: User | null;
}

type Section = 'stations' | 'owners' | null;

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

    // Owner management state
    const [newOwnerEmail, setNewOwnerEmail]     = useState('');
    const [addingOwner, setAddingOwner]         = useState(false);
    const [removingOwnerId, setRemovingOwnerId] = useState<string | null>(null);
    const [assigningOwnerEmail, setAssigningOwnerEmail] = useState<string | null>(null);

    const { allowedEmails, addOwner, removeOwner, getStationCountByOwner, getStationsByOwner, getUnassignedStations } = useAllowedEmails();
    const { preferences, savePreferences } = useOwnerPreferences(currentUser?.email);
    const { saveStation: updateStationOwner } = useStations();

    // Check if current user is superadmin
    const isSuperadmin = allowedEmails.some(ae => ae.email === currentUser?.email && ae.isSuperadmin);

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

                {/* ── DUEÑOS (solo superadmin) ── */}
                {isSuperadmin && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-white/80 dark:border-white/8 overflow-hidden"
                        style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.07), 0 8px 24px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.80)' }}>
                        <button
                            onClick={() => toggle('owners')}
                            className="w-full px-6 py-5 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center">
                                    <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm text-gray-900 dark:text-white">Dueños</p>
                                    <p className="text-xs text-gray-400 dark:text-slate-500">
                                        {allowedEmails.filter(ae => !ae.isSuperadmin).length} dueños · {allowedEmails.filter(ae => ae.isSuperadmin).length} superadmin
                                    </p>
                                </div>
                            </div>
                            {expandedSection === 'owners' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </button>

                        {expandedSection === 'owners' && (
                            <div className="border-t border-gray-50 dark:border-white/5">
                                {/* Add owner input */}
                                <div className="px-6 py-4 flex gap-2">
                                    <input
                                        type="email"
                                        value={newOwnerEmail}
                                        onChange={e => setNewOwnerEmail(e.target.value)}
                                        placeholder="email@ejemplo.com"
                                        className="flex-1 px-4 py-2.5 min-h-[44px] text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                                        onKeyDown={async e => {
                                            if (e.key === 'Enter') {
                                                setAddingOwner(true);
                                                const ok = await addOwner(newOwnerEmail);
                                                if (ok) setNewOwnerEmail('');
                                                setAddingOwner(false);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={async () => {
                                            setAddingOwner(true);
                                            const ok = await addOwner(newOwnerEmail);
                                            if (ok) setNewOwnerEmail('');
                                            setAddingOwner(false);
                                        }}
                                        disabled={addingOwner || !newOwnerEmail.trim()}
                                        className="px-4 py-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-violet-500 hover:bg-violet-600 disabled:opacity-50 rounded-xl text-white text-sm font-semibold transition-all"
                                    >
                                        {addingOwner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Owner list */}
                                <div className="divide-y divide-gray-50 dark:divide-white/5">
                                    {allowedEmails.length === 0 && (
                                        <p className="px-6 py-8 text-sm text-gray-400 dark:text-slate-500 text-center">Sin dueños registrados</p>
                                    )}
                                    {allowedEmails.map(ae => {
                                        const stationCount = getStationCountByOwner(ae.email);
                                        const ownerStations = getStationsByOwner(ae.email);
                                        return (
                                            <div key={ae.id} className="px-6 py-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ae.email}</p>
                                                            {ae.isSuperadmin ? (
                                                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">
                                                                    SUPERADMIN
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded">
                                                                    DUEÑO
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                                                            {stationCount === 0 ? 'Sin estaciones asignadas' : `${stationCount} estación${stationCount > 1 ? 'es' : ''}`}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1 ml-3 shrink-0">
                                                        <button
                                                            onClick={() => setAssigningOwnerEmail(assigningOwnerEmail === ae.email ? null : ae.email)}
                                                            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-300 dark:text-slate-600 hover:text-violet-500 transition-colors"
                                                            title="Asignar estaciones"
                                                        >
                                                            <Building2 className="w-4 h-4" />
                                                        </button>
                                                        {!ae.isSuperadmin && (
                                                            <button
                                                                onClick={() => setRemovingOwnerId(ae.id)}
                                                                className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors"
                                                                title="Eliminar dueño"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Assigned stations + assign panel */}
                                                {assigningOwnerEmail === ae.email && (
                                                    <div className="mt-3 space-y-2">
                                                        {ownerStations.length > 0 && (
                                                            <div className="space-y-1">
                                                                {ownerStations.map(s => (
                                                                    <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
                                                                        <span className="text-xs text-gray-700 dark:text-slate-300">{s.name}</span>
                                                                        <button
                                                                            onClick={async () => {
                                                                                await updateStationOwner({ ...s, ownerEmail: undefined } as any);
                                                                            }}
                                                                            className="text-[10px] text-red-400 hover:text-red-500 font-semibold"
                                                                        >
                                                                            Quitar
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {/* Unassigned stations to pick from */}
                                                        {getUnassignedStations().length > 0 && (
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Sin asignar</p>
                                                                {getUnassignedStations().map(s => (
                                                                    <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                                                                        <span className="text-xs text-gray-500 dark:text-slate-400">{s.name}</span>
                                                                        <button
                                                                            onClick={async () => {
                                                                                await updateStationOwner({ ...s, ownerEmail: ae.email } as any);
                                                                            }}
                                                                            className="text-[10px] text-violet-500 hover:text-violet-600 font-semibold"
                                                                        >
                                                                            Asignar
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── CONOCIMIENTO DE ESTACIÓN ── */}
                {currentUser?.role === 'ADMIN' && (
                    <KnowledgePanelSection stations={stations} isAdmin={true} />
                )}

                {/* Notifications + Thresholds */}
                {preferences && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-white/10 p-6 space-y-6">
                        <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-amber-500" />
                            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Notificaciones</p>
                        </div>
                        <div className="space-y-3">
                            {([
                                { key: 'notifyTankCritical' as const, label: 'Tanque critico', desc: 'Cuando un tanque baja del nivel critico' },
                                { key: 'notifyTankLow' as const, label: 'Tanque bajo', desc: 'Cuando un tanque baja del nivel de advertencia' },
                                { key: 'notifyNegativeValue' as const, label: 'Venta negativa', desc: 'Cuando se detecta una anulacion o devolucion' },
                                { key: 'notifyReconciliation' as const, label: 'Faltante de caja', desc: 'Cuando el total declarado no coincide con las ventas' },
                            ]).map(({ key, label, desc }) => (
                                <div key={key} className="flex items-center justify-between py-2">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>
                                        <p className="text-xs text-gray-400 dark:text-slate-500">{desc}</p>
                                    </div>
                                    <button
                                        onClick={() => savePreferences({ [key]: !preferences[key] })}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${
                                            preferences[key] ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'
                                        }`}
                                    >
                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                                            preferences[key] ? 'left-[22px]' : 'left-0.5'
                                        }`} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-100 dark:border-white/10 pt-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Droplets className="w-5 h-5 text-blue-500" />
                                <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Umbrales de tanques</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-orange-600 dark:text-orange-400 block mb-1">
                                        Advertencia (litros)
                                    </label>
                                    <input
                                        type="number"
                                        value={preferences.tankWarningLiters}
                                        onChange={e => savePreferences({ tankWarningLiters: Number(e.target.value) || 800 })}
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white text-sm focus:outline-none focus:border-orange-400"
                                    />
                                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Alerta WARNING si stock menor a este valor</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-red-600 dark:text-red-400 block mb-1">
                                        Critico (litros)
                                    </label>
                                    <input
                                        type="number"
                                        value={preferences.tankCriticalLiters}
                                        onChange={e => savePreferences({ tankCriticalLiters: Number(e.target.value) || 300 })}
                                        className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white text-sm focus:outline-none focus:border-red-400"
                                    />
                                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Alerta CRITICAL si stock menor a este valor</p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-white/10 pt-5">
                            <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">Horarios de turno</p>
                            <div className="grid grid-cols-3 gap-3">
                                {([
                                    { key: 'shiftMorningStart' as const, label: 'Manana', color: 'text-amber-500' },
                                    { key: 'shiftAfternoonStart' as const, label: 'Tarde', color: 'text-orange-500' },
                                    { key: 'shiftNightStart' as const, label: 'Noche', color: 'text-indigo-500' },
                                ]).map(({ key, label, color }) => (
                                    <div key={key}>
                                        <label className={`text-xs font-semibold ${color} block mb-1`}>{label} (hora inicio)</label>
                                        <input
                                            type="number"
                                            min={0} max={23}
                                            value={preferences[key]}
                                            onChange={e => savePreferences({ [key]: Number(e.target.value) })}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white text-sm text-center focus:outline-none focus:border-amber-400"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2">Estos horarios se usan para el filtro de turno en Playa, Salon y Ventas</p>
                        </div>
                    </div>
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

            {/* Confirmation Modal — Remove Owner */}
            {removingOwnerId && (() => {
                const ownerToRemove = allowedEmails.find(ae => ae.id === removingOwnerId);
                if (!ownerToRemove) return null;
                return (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
                            onClick={() => setRemovingOwnerId(null)}
                        />
                        <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4 pointer-events-none">
                            <div
                                className="pointer-events-auto w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden animate-scale-in"
                                style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.15)' }}
                            >
                                <div className="p-6 text-center">
                                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-red-100 dark:bg-red-500/20">
                                        <Trash2 className="w-7 h-7 text-red-500" />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">¿Eliminar dueño?</h3>
                                    <p className="text-sm text-gray-500 dark:text-slate-400">
                                        Se eliminará a <strong className="text-gray-700 dark:text-white">{ownerToRemove.email}</strong> de la lista de acceso. Ya no podrá iniciar sesión.
                                    </p>
                                </div>
                                <div className="px-6 pb-6 flex gap-3">
                                    <button
                                        onClick={() => setRemovingOwnerId(null)}
                                        className="flex-1 px-4 py-3 min-h-[48px] text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setIsProcessing(true);
                                            await removeOwner(removingOwnerId);
                                            setIsProcessing(false);
                                            setRemovingOwnerId(null);
                                        }}
                                        disabled={isProcessing}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                                    >
                                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sí, eliminar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                );
            })()}

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
