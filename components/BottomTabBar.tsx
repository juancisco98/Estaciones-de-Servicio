import React from 'react';
import { Activity, Map as MapIcon, AlertTriangle, ShoppingCart, Droplets } from 'lucide-react';
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
    const tabs: {
        id: ViewState;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        badge?: number;
        badgeCritical?: boolean;
    }[] = [
        { id: 'LIVE',   label: 'En Vivo', icon: Activity },
        { id: 'MAP',    label: 'Mapa',    icon: MapIcon },
        {
            id: 'ALERTS',
            label: 'Alertas',
            icon: AlertTriangle,
            badge: unresolvedAlertCount > 0 ? unresolvedAlertCount : undefined,
            badgeCritical: criticalAlertCount > 0,
        },
        { id: 'SALES',  label: 'Ventas',  icon: ShoppingCart },
        { id: 'TANKS',  label: 'Tanques', icon: Droplets },
    ];

    return (
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
            {tabs.map(({ id, label, icon: Icon, badge, badgeCritical }) => {
                const isActive = currentView === id;
                return (
                    <button
                        key={id}
                        onClick={() => onViewChange(id)}
                        className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative
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
                                transform: isActive ? 'scale(1.10)' : 'scale(1)',
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                        >
                            <Icon className={`w-5 h-5 transition-colors ${
                                isActive
                                    ? 'text-amber-500 drop-shadow-[0_2px_4px_rgba(245,158,11,0.40)]'
                                    : 'text-gray-400 dark:text-slate-500'
                            } ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />

                            {badge !== undefined && (
                                <span className={`absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5
                                                  text-white text-[8px] font-black rounded-full
                                                  flex items-center justify-center leading-none
                                                  ${badgeCritical ? 'bg-red-500' : 'bg-amber-500'}`}>
                                    {badge > 9 ? '9+' : badge}
                                </span>
                            )}
                        </div>

                        {/* Label */}
                        <span
                            className={`text-[10px] font-semibold relative z-10 transition-colors ${
                                isActive ? 'text-amber-500 font-bold' : 'text-gray-400 dark:text-slate-500'
                            }`}
                        >
                            {label}
                        </span>

                        {/* Top indicator bar */}
                        <span
                            className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-full
                                       bg-gradient-to-r from-amber-400 to-amber-600
                                       transition-all duration-300"
                            style={{
                                width: isActive ? '28px' : '0px',
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                        />
                    </button>
                );
            })}
        </div>
    );
};

export default BottomTabBar;
