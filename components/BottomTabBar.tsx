import React from 'react';
import { Map as MapIcon, Scissors, History, BarChart3, Store, Activity } from 'lucide-react';
import { ViewState } from './Sidebar';

interface BottomTabBarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  className?: string;
}

const tabs: { id: ViewState; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'LIVE',        label: 'En Vivo',   icon: Activity },
  { id: 'MAP',         label: 'Mapa',      icon: MapIcon },
  { id: 'BARBERSHOPS', label: 'Locales',   icon: Store },
  { id: 'BARBERS',     label: 'Barberos',  icon: Scissors },
  { id: 'SESSIONS',    label: 'Sesiones',  icon: History },
  { id: 'ANALYTICS',  label: 'Stats',     icon: BarChart3 },
];

const BottomTabBar: React.FC<BottomTabBarProps> = ({ currentView, onViewChange, className = '' }) => {
  return (
    <div className={`${className} bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-white/10 flex items-stretch safe-area-inset-bottom`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = currentView === id;
        return (
          <button
            key={id}
            onClick={() => onViewChange(id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors active:scale-95 ${
              isActive
                ? 'text-amber-500'
                : 'text-gray-400 dark:text-slate-500'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            <span className={`text-[10px] font-semibold ${isActive ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>
              {label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 w-8 h-0.5 bg-amber-500 rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default BottomTabBar;
