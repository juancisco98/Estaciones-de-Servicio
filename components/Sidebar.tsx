import React from 'react';
import { BarChart3, Scissors, History, Map as MapIcon, LogOut, X, Settings, Store, Activity, Wallet } from 'lucide-react';

export type ViewState = 'LIVE' | 'MAP' | 'BARBERSHOPS' | 'BARBERS' | 'SESSIONS' | 'ANALYTICS' | 'FINANCES' | 'SETTINGS';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  onLogout?: () => void;
  permanent?: boolean; // desktop: always visible, no overlay
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView, onViewChange, onLogout, permanent = false }) => {
  const menuItems = [
    { id: 'LIVE' as ViewState,        label: 'En Vivo',     icon: Activity },
    { id: 'MAP' as ViewState,         label: 'Mapa',        icon: MapIcon },
    { id: 'BARBERSHOPS' as ViewState, label: 'Barberías',   icon: Store },
    { id: 'BARBERS' as ViewState,     label: 'Barberos',    icon: Scissors },
    { id: 'SESSIONS' as ViewState,    label: 'Sesiones',    icon: History },
    { id: 'ANALYTICS' as ViewState,   label: 'Analytics',   icon: BarChart3 },
    { id: 'FINANCES' as ViewState,    label: 'Finanzas',    icon: Wallet },
    { id: 'SETTINGS' as ViewState,    label: 'Ajustes',     icon: Settings },
  ];

  const SidebarContent = () => (
    <div className={`flex flex-col h-full w-64 bg-white dark:bg-slate-950 border-r border-gray-100 dark:border-white/10 ${!permanent ? 'shadow-2xl' : ''}`}>
      {/* Header */}
      <div className="px-5 py-5 flex justify-between items-center border-b border-gray-100 dark:border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <Scissors className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="font-black text-lg text-gray-900 dark:text-white tracking-tight">Rufianes</span>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-semibold -mt-0.5">Barbershop</p>
          </div>
        </div>
        {!permanent && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-gray-400"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onViewChange(item.id); if (!permanent) onClose(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-150 group ${
                isActive
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-200/50 dark:shadow-none font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${
                isActive
                  ? 'bg-white/20'
                  : 'text-gray-400 group-hover:text-amber-500'
              }`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 dark:border-white/5 shrink-0">
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-rose-500 hover:bg-red-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        )}
      </div>
    </div>
  );

  if (permanent) {
    return <SidebarContent />;
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[1400] backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}
      <div className={`fixed top-0 left-0 h-full z-[1500] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </div>
    </>
  );
};

export default React.memo(Sidebar);
