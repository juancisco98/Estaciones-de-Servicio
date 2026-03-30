import React, { useState } from 'react';
import { Map as MapIcon, AlertTriangle, ShoppingCart, Droplets, MoreHorizontal, ClipboardCheck, BarChart3, Settings, Gauge, X } from 'lucide-react';
import { ViewState } from './Sidebar';

interface BottomTabBarProps {
    currentView: ViewState;
    onViewChange: (view: ViewState) => void;
    className?: string;
    unresolvedAlertCount?: number;
    criticalAlertCount?: number;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({
    currentView,
    onViewChange,
    className = '',
    unresolvedAlertCount = 0,
    criticalAlertCount = 0,
}) => {
    const [showMore, setShowMore] = useState(false);

    const mainTabs: {
        id: ViewState;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        badge?: number;
        badgeCritical?: boolean;
    }[] = [
        { id: 'MAP',    label: 'Mapa',    icon: MapIcon },
        {
            id: 'ALERTS',
            label: 'Alertas',
            icon: AlertTriangle,
            badge: unresolvedAlertCount > 0 ? unresolvedAlertCount : undefined,
            badgeCritical: criticalAlertCount > 0,
        },
        { id: 'SALES',  label: 'Ventas',  icon: ShoppingCart },
    ];

    const moreTabs: {
        id: ViewState;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
    }[] = [
        { id: 'TANKS',          label: 'Tanques',        icon: Droplets },
        { id: 'STATIONS',      label: 'Estaciones',     icon: Gauge },
        { id: 'RECONCILIATION', label: 'Reconciliación', icon: ClipboardCheck },
        { id: 'ANALYTICS',     label: 'Analytics',      icon: BarChart3 },
        { id: 'SETTINGS',      label: 'Ajustes',        icon: Settings },
    ];

    const isMoreViewActive = moreTabs.some(t => t.id === currentView);

    return (
        <>
            {/* More menu overlay */}
            {showMore && (
                <>
                    <div className="fixed inset-0 bg-black/30 z-[1998]" onClick={() => setShowMore(false)} />
                    <div
                        className="fixed bottom-[56px] left-2 right-2 z-[1999] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden p-2"
                        style={{
                            paddingBottom: 'env(safe-area-inset-bottom)',
                            boxShadow: '0 -8px 32px rgba(0,0,0,0.16), 0 -2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.10)',
                        }}
                    >
                        <div className="flex items-center justify-between px-3 py-2 mb-1">
                            <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Más opciones</span>
                            <button onClick={() => setShowMore(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {moreTabs.map(({ id, label, icon: Icon }) => {
                                const isActive = currentView === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => { onViewChange(id); setShowMore(false); }}
                                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all active:scale-95 ${
                                            isActive
                                                ? 'bg-amber-50 dark:bg-amber-500/10'
                                                : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <Icon className={`w-5 h-5 ${
                                            isActive ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'
                                        }`} />
                                        <span className={`text-[10px] font-semibold ${
                                            isActive ? 'text-amber-500 font-bold' : 'text-gray-500 dark:text-slate-400'
                                        }`}>
                                            {label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Bottom Tab Bar */}
            <div
                className={`${className} relative flex items-stretch
                            bg-white/85 dark:bg-slate-900/90
                            backdrop-blur-2xl
                            border-t border-white/60 dark:border-white/8`}
                style={{
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.06), 0 -1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.70)',
                }}
            >
                {mainTabs.map(({ id, label, icon: Icon, badge, badgeCritical }) => {
                    const isActive = currentView === id;
                    return (
                        <button
                            key={id}
                            onClick={() => onViewChange(id)}
                            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] relative
                                       transition-all duration-150 active:scale-90"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                            {/* Active background pill */}
                            {isActive && (
                                <span
                                    className="absolute inset-x-3 top-1.5 bottom-1.5 rounded-2xl pointer-events-none"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 100%)',
                                    }}
                                />
                            )}

                            {/* Icon container */}
                            <div
                                className="relative z-10 transition-all duration-200"
                                style={{
                                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                                }}
                            >
                                <Icon className={`w-6 h-6 transition-colors ${
                                    isActive
                                        ? 'text-amber-500 drop-shadow-[0_2px_4px_rgba(245,158,11,0.40)]'
                                        : 'text-gray-400 dark:text-slate-500'
                                } ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />

                                {badge !== undefined && (
                                    <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-0.5
                                                      text-white text-[9px] font-black rounded-full
                                                      flex items-center justify-center leading-none
                                                      ${badgeCritical ? 'bg-red-500' : 'bg-amber-500'}`}>
                                        {badge > 9 ? '9+' : badge}
                                    </span>
                                )}
                            </div>

                            {/* Label */}
                            <span
                                className={`text-[11px] font-semibold relative z-10 transition-colors ${
                                    isActive ? 'text-amber-500 font-bold' : 'text-gray-400 dark:text-slate-500'
                                }`}
                            >
                                {label}
                            </span>

                            {/* Top indicator bar */}
                            <span
                                className="absolute top-0 left-1/2 -translate-x-1/2 h-[3.5px] rounded-b-full
                                           bg-gradient-to-r from-amber-400 to-amber-600
                                           transition-all duration-300"
                                style={{
                                    width: isActive ? '32px' : '0px',
                                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                                }}
                            />
                        </button>
                    );
                })}

                {/* More button */}
                <button
                    onClick={() => setShowMore(v => !v)}
                    className="flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[56px] relative
                               transition-all duration-150 active:scale-90"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                    {isMoreViewActive && (
                        <span
                            className="absolute inset-x-3 top-1.5 bottom-1.5 rounded-2xl pointer-events-none"
                            style={{
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(217,119,6,0.08) 100%)',
                            }}
                        />
                    )}
                    <div className="relative z-10">
                        <MoreHorizontal className={`w-6 h-6 transition-colors ${
                            isMoreViewActive || showMore
                                ? 'text-amber-500'
                                : 'text-gray-400 dark:text-slate-500'
                        }`} />
                    </div>
                    <span className={`text-[11px] font-semibold relative z-10 transition-colors ${
                        isMoreViewActive || showMore ? 'text-amber-500 font-bold' : 'text-gray-400 dark:text-slate-500'
                    }`}>
                        Más
                    </span>
                    {isMoreViewActive && (
                        <span
                            className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-full
                                       bg-gradient-to-r from-amber-400 to-amber-600"
                            style={{ width: '28px' }}
                        />
                    )}
                </button>
            </div>
        </>
    );
};

export default BottomTabBar;
