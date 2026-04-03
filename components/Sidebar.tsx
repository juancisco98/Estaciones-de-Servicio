import React from 'react';
import {
    Map as MapIcon, Fuel, ShoppingCart, Droplets,
    AlertTriangle, BarChart3, Settings, LogOut, X, ClipboardCheck,
    Gauge, Sun, Moon, CreditCard, RefreshCw,
} from 'lucide-react';
import { User } from '../types';
import { useTheme } from '../context/ThemeContext';

export type ViewState =
    | 'MAP'
    | 'STATIONS'
    | 'SALES'
    | 'TANKS'
    | 'ALERTS'
    | 'PLAYA'
    | 'SHOP'
    | 'ACCOUNTS'
    | 'ANALYTICS'
    | 'SETTINGS';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    currentView: ViewState;
    onViewChange: (view: ViewState) => void;
    onLogout?: () => void;
    permanent?: boolean;
    unresolvedAlertCount?: number;
    criticalAlertCount?: number;
    discrepancyCount?: number;
    currentUser?: User | null;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

interface MenuItem {
    id: ViewState;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeVariant?: 'red' | 'amber';
}

const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onClose,
    currentView,
    onViewChange,
    onLogout,
    permanent = false,
    unresolvedAlertCount = 0,
    criticalAlertCount = 0,
    discrepancyCount = 0,
    currentUser,
    onRefresh,
    isRefreshing = false,
}) => {
    const { theme, toggleTheme } = useTheme();

    const menuItems: MenuItem[] = [
        { id: 'MAP',            label: 'Mapa de Red',    icon: MapIcon },
        { id: 'STATIONS',       label: 'Estaciones',     icon: Gauge },
        { id: 'SALES',          label: 'Ventas',         icon: ShoppingCart },
        { id: 'TANKS',          label: 'Tanques',        icon: Droplets },
        {
            id: 'ALERTS',
            label: 'Alertas',
            icon: AlertTriangle,
            badge: unresolvedAlertCount > 0 ? unresolvedAlertCount : undefined,
            badgeVariant: criticalAlertCount > 0 ? 'red' : 'amber',
        },
        { id: 'PLAYA',           label: 'Playa',          icon: Fuel },
        { id: 'SHOP',            label: 'Mini Mercado',   icon: ClipboardCheck },
        { id: 'ACCOUNTS',       label: 'Cuentas Ctes.',  icon: CreditCard },
        { id: 'ANALYTICS',      label: 'Analytics',      icon: BarChart3 },
        { id: 'SETTINGS',       label: 'Ajustes',        icon: Settings },
    ];

    const SidebarContent = () => (
        <div
            className="flex flex-col h-full w-72 bg-white/85 dark:bg-slate-950/90 backdrop-blur-2xl border-r border-white/60 dark:border-white/8"
            style={{
                boxShadow: permanent
                    ? 'none'
                    : '4px 0 32px rgba(0,0,0,0.12), 2px 0 8px rgba(0,0,0,0.06)',
            }}
        >
            {/* Header */}
            <div className="px-6 pt-6 pb-5 flex justify-between items-center border-b border-gray-100/80 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-3.5">
                    <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            boxShadow: '0 4px 12px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                        }}
                    >
                        <Fuel className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <span className="font-black text-lg text-gray-900 dark:text-white tracking-tight">Station-OS</span>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500 uppercase tracking-widest font-semibold -mt-0.5">
                            Red Central
                        </p>
                    </div>
                </div>
                {!permanent && (
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400 transition-colors active:scale-90"
                        aria-label="Cerrar menú"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { onViewChange(item.id); if (!permanent) onClose(); }}
                            className={`w-full flex items-center gap-3.5 px-4 py-3.5 min-h-[48px] rounded-2xl transition-all duration-200 group relative
                                        ${isActive
                                            ? 'text-white font-bold'
                                            : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50/80 dark:hover:bg-slate-800/70 hover:text-gray-900 dark:hover:text-white hover:scale-[1.01] font-medium'
                                        }`}
                            style={isActive ? {
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                boxShadow: '0 4px 14px rgba(245,158,11,0.30), 0 2px 4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.18)',
                            } : {}}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-white/60" />
                            )}
                            <div className={`p-2 rounded-xl transition-all duration-150 ${
                                isActive
                                    ? 'bg-white/20'
                                    : 'text-gray-400 dark:text-slate-500 group-hover:text-amber-500 group-hover:bg-amber-50 dark:group-hover:bg-amber-500/10'
                            }`}>
                                <item.icon className="w-5 h-5" />
                            </div>
                            <span className="text-[15px] font-semibold tracking-tight flex-1 text-left">{item.label}</span>
                            {item.badge !== undefined && (
                                <span className={`text-[11px] font-black px-2 py-1 rounded-full leading-none ${
                                    isActive
                                        ? 'bg-white/25 text-white'
                                        : item.badgeVariant === 'red'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-amber-500 text-white'
                                }`}>
                                    {item.badge > 99 ? '99+' : item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-5 border-t border-gray-100/80 dark:border-white/5 space-y-3 shrink-0">

                {/* Refresh button */}
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="w-full flex items-center gap-3.5 px-4 py-3 min-h-[48px] rounded-2xl
                                   text-amber-600 dark:text-amber-400
                                   hover:bg-amber-50 dark:hover:bg-amber-500/10
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   transition-all duration-200 active:scale-98"
                    >
                        <div className="p-2 rounded-xl text-amber-500 dark:text-amber-400">
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </div>
                        <span className="text-[15px] font-semibold">
                            {isRefreshing ? 'Actualizando...' : 'Actualizar Datos'}
                        </span>
                    </button>
                )}

                {/* Dark mode toggle */}
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-gray-50/80 dark:bg-slate-800/60">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-700/60" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                            {theme === 'dark'
                                ? <Moon className="w-4 h-4 text-amber-400" />
                                : <Sun className="w-4 h-4 text-amber-500" />
                            }
                        </div>
                        <span className="text-sm font-semibold text-gray-600 dark:text-slate-300">
                            {theme === 'dark' ? 'Modo Noche' : 'Modo Día'}
                        </span>
                    </div>
                    {/* pill toggle */}
                    <button
                        onClick={toggleTheme}
                        className="relative w-[44px] h-[24px] rounded-full cursor-pointer shrink-0
                                   bg-slate-200 dark:bg-slate-600
                                   ring-1 ring-black/[0.06] dark:ring-white/10
                                   transition-colors duration-300
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.10)' }}
                    >
                        <span
                            className="absolute inset-0 rounded-full transition-opacity duration-300"
                            style={{
                                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
                                opacity: theme === 'dark' ? 1 : 0,
                            }}
                        />
                        <span
                            className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white dark:bg-amber-400 transition-all duration-300"
                            style={{
                                left: theme === 'dark' ? '23px' : '3px',
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
                            }}
                        />
                    </button>
                </div>

                {/* User info */}
                {currentUser && (
                    <div className="flex items-center gap-3 px-3 py-2">
                        {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-700" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-base">
                                {currentUser.name[0].toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">{currentUser.role}</p>
                        </div>
                    </div>
                )}

                {/* Logout */}
                {onLogout && (
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3.5 px-4 py-3 min-h-[48px] rounded-2xl
                                   text-red-600 dark:text-rose-500
                                   hover:bg-red-50 dark:hover:bg-rose-500/10
                                   transition-all duration-200 active:scale-98"
                    >
                        <div className="p-2 rounded-xl text-red-500 dark:text-rose-500">
                            <LogOut className="w-5 h-5" />
                        </div>
                        <span className="text-[15px] font-semibold">Cerrar Sesión</span>
                    </button>
                )}
            </div>
        </div>
    );

    if (permanent) return <SidebarContent />;

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-[1400] backdrop-blur-sm"
                    style={{ transition: 'opacity 250ms ease' }}
                    onClick={onClose}
                />
            )}
            <div
                className={`fixed top-0 left-0 h-full z-[1500] transform transition-transform duration-300 ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
                <SidebarContent />
            </div>
        </>
    );
};

export default React.memo(Sidebar);
