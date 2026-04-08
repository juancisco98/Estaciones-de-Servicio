import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Menu, Loader2, Bell, Sun, Moon, X, Check, LogOut, RefreshCw, Search, AlertTriangle, Fuel, Activity } from 'lucide-react';
import { User, AppNotification } from '../types';
import InstallButton from './InstallButton';
import { useTheme } from '../context/ThemeContext';
import { useDataContext } from '../context/DataContext';
import { geocodeAddress } from '../utils/geocoding';

interface HeaderProps {
    onMenuClick: () => void;
    currentUser: User | null;
    onLogout: () => void;
    onRefresh: () => void;
    isLoading: boolean;
    onMapSearch?: (lat: number, lng: number) => void;
    unresolvedAlertCount?: number;
    criticalAlertCount?: number;
}

const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
};

const NotificationIcon: React.FC<{ type: AppNotification['type'] }> = ({ type }) => {
    if (type === 'RECONCILIATION_FAIL') return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />;
    if (type === 'LOW_TANK')           return <Fuel className="w-4 h-4 text-amber-500 shrink-0" />;
    if (type === 'UNKNOWN_PRODUCT')    return <Bell className="w-4 h-4 text-indigo-500 shrink-0" />;
    return <Bell className="w-4 h-4 text-slate-500 shrink-0" />;
};

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    return (
        <button
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            className="relative w-[56px] h-[30px] rounded-full shrink-0 cursor-pointer
                       bg-slate-200 dark:bg-slate-700
                       ring-1 ring-black/[0.06] dark:ring-white/10
                       transition-colors duration-300
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)' }}
        >
            <span
                className="absolute inset-0 rounded-full transition-opacity duration-300"
                style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
                    opacity: isDark ? 1 : 0,
                }}
            />
            <span
                className="absolute top-[3px] w-[22px] h-[22px] rounded-full
                           bg-white dark:bg-amber-400
                           flex items-center justify-center
                           transition-all duration-300"
                style={{
                    left: isDark ? '27px' : '3px',
                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.20), 0 1px 2px rgba(0,0,0,0.12)',
                }}
            >
                {isDark
                    ? <Moon className="w-3 h-3 text-slate-800" />
                    : <Sun className="w-3 h-3 text-amber-500" />
                }
            </span>
        </button>
    );
};

const Header: React.FC<HeaderProps> = ({
    onMenuClick,
    currentUser,
    onLogout,
    onRefresh,
    isLoading,
    onMapSearch,
    unresolvedAlertCount = 0,
    criticalAlertCount = 0,
}) => {
    const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, salesTransactions, dailyClosings, stations } = useDataContext();
    const [showNotifications, setShowNotifications] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        if (showNotifications) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showNotifications]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim() || !onMapSearch) return;
        setIsSearching(true);
        try {
            const result = await geocodeAddress(searchQuery.trim());
            if (result) {
                onMapSearch(result.lat, result.lng);
                setSearchQuery('');
            } else {
                const { toast } = await import('sonner');
                toast.error('Dirección no encontrada', { description: 'Intentá con otra búsqueda o dirección más específica.' });
            }
        } finally { setIsSearching(false); }
    };

    const totalBadge = unreadCount + unresolvedAlertCount;

    const stationHealth = useMemo(() => {
        const now = Date.now();
        const healthMap = new Map<string, { name: string; lastSync: number; ago: string; status: 'OK' | 'WARNING' | 'CRITICAL' }>();

        for (const st of stations) {
            let latest = 0;

            for (const tx of salesTransactions) {
                if (tx.stationId === st.id && tx.transactionTs) {
                    const t = new Date(tx.transactionTs).getTime();
                    if (t > latest) latest = t;
                }
            }
            for (const dc of dailyClosings) {
                if (dc.stationId === st.id) {
                    const ts = dc.pClosingTs || dc.sClosingTs || dc.createdAt;
                    if (ts) {
                        const t = new Date(ts).getTime();
                        if (t > latest) latest = t;
                    }
                }
            }

            if (latest === 0) {
                healthMap.set(st.id, { name: st.name, lastSync: 0, ago: 'Sin datos', status: 'CRITICAL' });
                continue;
            }

            const diffHours = (now - latest) / 3600000;
            const status = diffHours < 12 ? 'OK' : diffHours < 24 ? 'WARNING' : 'CRITICAL';
            healthMap.set(st.id, { name: st.name, lastSync: latest, ago: timeAgo(new Date(latest).toISOString()), status });
        }

        return healthMap;
    }, [stations, salesTransactions, dailyClosings]);

    const overallStatus = useMemo(() => {
        if (stationHealth.size === 0) return 'OK' as const;
        const statuses = [...stationHealth.values()].map(h => h.status);
        if (statuses.includes('CRITICAL')) return 'CRITICAL' as const;
        if (statuses.includes('WARNING')) return 'WARNING' as const;
        return 'OK' as const;
    }, [stationHealth]);

    const [showHealth, setShowHealth] = useState(false);
    const healthRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (healthRef.current && !healthRef.current.contains(e.target as Node)) setShowHealth(false);
        };
        if (showHealth) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showHealth]);

    return (
        <div className="absolute top-0 left-0 right-0 z-[800] p-4 sm:p-5 pointer-events-none">
            <div
                className="pointer-events-auto max-w-full xl:max-w-7xl mx-auto
                           bg-white/75 dark:bg-slate-900/80
                           backdrop-blur-3xl
                           rounded-2xl sm:rounded-full
                           p-2.5 sm:p-3
                           flex items-center gap-2.5
                           border border-white/70 dark:border-white/10"
                style={{
                    boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
            >
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl
                                   text-gray-700 dark:text-white transition-all active:scale-95
                                   w-11 h-11 flex items-center justify-center"
                        aria-label="Abrir menú"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="hidden sm:flex items-center gap-3 ml-1 mr-1">
                        <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-sm shadow-amber-400/40">
                            <Fuel className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-base font-black text-gray-900 dark:text-white leading-none tracking-tight">Station-OS</h1>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight">
                                {currentUser?.name?.split(' ')[0] || 'Admin'}
                            </p>
                        </div>
                    </div>
                </div>
                {onMapSearch && <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-white/10 shrink-0" />}
                {onMapSearch && (
                    <form onSubmit={handleSearch} className="flex-1 min-w-0 mx-1">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar estación o dirección..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl
                                           bg-gray-100/80 dark:bg-slate-800/80
                                           border border-gray-200/60 dark:border-white/8
                                           text-sm text-gray-800 dark:text-white
                                           placeholder-gray-400 dark:placeholder-slate-500
                                           focus:outline-none focus:ring-2 focus:ring-amber-400/50
                                           transition-all duration-150"
                            />
                            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-500" />}
                        </div>
                    </form>
                )}
                <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-white/10 shrink-0" />
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl
                                   text-gray-500 dark:text-gray-400 transition-all active:scale-95
                                   w-10 h-10 flex items-center justify-center disabled:opacity-40"
                        aria-label="Actualizar"
                    >
                        {isLoading ? <Loader2 className="w-[18px] h-[18px] animate-spin text-amber-500" /> : <RefreshCw className="w-[18px] h-[18px]" />}
                    </button>
                    <div className="relative" ref={healthRef}>
                        <button
                            onClick={() => setShowHealth(v => !v)}
                            className={`p-2 rounded-xl transition-all active:scale-95 w-10 h-10 flex items-center justify-center relative
                                ${overallStatus === 'OK' ? 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500' :
                                  overallStatus === 'WARNING' ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500' :
                                  'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500'}`}
                            aria-label="Estado de estaciones"
                        >
                            <Activity className="w-[18px] h-[18px]" />
                            <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900
                                ${overallStatus === 'OK' ? 'bg-emerald-400' : overallStatus === 'WARNING' ? 'bg-amber-400 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                        </button>

                        {showHealth && (
                            <div className="absolute right-0 top-[46px] w-80 z-[900]
                                            bg-white/90 dark:bg-slate-900/95
                                            backdrop-blur-2xl
                                            border border-white/60 dark:border-white/10
                                            rounded-2xl overflow-hidden animate-scale-in"
                                style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)' }}
                            >
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100/80 dark:border-white/8">
                                    <Activity className="w-4 h-4 text-slate-500" />
                                    <span className="font-bold text-sm text-slate-800 dark:text-white">Estado de Estaciones</span>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {stationHealth.size === 0 ? (
                                        <div className="py-8 text-center text-slate-400 text-sm">Sin estaciones</div>
                                    ) : (
                                        [...stationHealth.values()].map(h => (
                                            <div key={h.name} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50/80 dark:border-white/5 last:border-0">
                                                <span className={`w-2.5 h-2.5 rounded-full shrink-0
                                                    ${h.status === 'OK' ? 'bg-emerald-400' : h.status === 'WARNING' ? 'bg-amber-400' : 'bg-red-500'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{h.name}</p>
                                                    <p className={`text-xs font-medium
                                                        ${h.status === 'OK' ? 'text-emerald-600 dark:text-emerald-400' :
                                                          h.status === 'WARNING' ? 'text-amber-600 dark:text-amber-400' :
                                                          'text-red-600 dark:text-red-400'}`}>
                                                        {h.lastSync === 0 ? 'Sin datos recibidos' : `Última sync: ${h.ago}`}
                                                    </p>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full
                                                    ${h.status === 'OK' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                      h.status === 'WARNING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                                                      'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                                                    {h.status === 'OK' ? 'ONLINE' : h.status === 'WARNING' ? 'LENTO' : 'OFFLINE'}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <ThemeToggle />

                    <InstallButton />
                    <div className="relative" ref={dropdownRef}>
                        <button
                            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl
                                       text-gray-500 dark:text-gray-400 relative transition-all active:scale-95
                                       w-10 h-10 flex items-center justify-center"
                            onClick={() => setShowNotifications(v => !v)}
                            aria-label="Notificaciones"
                        >
                            <Bell className="w-[18px] h-[18px]" />
                            {totalBadge > 0 && (
                                <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5
                                                  text-white text-[10px] font-black rounded-full
                                                  border-2 border-white dark:border-slate-900
                                                  flex items-center justify-center leading-none
                                                  ${criticalAlertCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
                                    {totalBadge > 9 ? '9+' : totalBadge}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 sm:right-0 top-[46px] w-[calc(100vw-2rem)] sm:w-96 max-w-[400px] z-[900]
                                            bg-white/90 dark:bg-slate-900/95
                                            backdrop-blur-2xl
                                            border border-white/60 dark:border-white/10
                                            rounded-2xl overflow-hidden animate-scale-in"
                                style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)', right: 'max(0px, calc(100% - 100vw + 2rem))' }}
                            >
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/80 dark:border-white/8">
                                    <div className="flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                        <span className="font-bold text-sm text-slate-800 dark:text-white">Notificaciones</span>
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount} nuevas</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <button onClick={() => markAllNotificationsRead()} className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
                                                <Check className="w-3 h-3" /> Todas leídas
                                            </button>
                                        )}
                                        <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-[360px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
                                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            Sin notificaciones
                                        </div>
                                    ) : (
                                        notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                onClick={() => !notif.read && markNotificationRead(notif.id)}
                                                className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50/80 dark:border-white/5 last:border-0 transition-colors cursor-pointer ${
                                                    !notif.read
                                                        ? notif.type === 'RECONCILIATION_FAIL' ? 'bg-red-50/70 dark:bg-red-500/10'
                                                        : notif.type === 'LOW_TANK' ? 'bg-amber-50/70 dark:bg-amber-500/10'
                                                        : 'bg-indigo-50/60 dark:bg-indigo-500/10'
                                                        : 'hover:bg-gray-50/80 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                                                    notif.type === 'RECONCILIATION_FAIL' ? 'bg-red-100 dark:bg-red-500/20' :
                                                    notif.type === 'LOW_TANK'           ? 'bg-amber-100 dark:bg-amber-500/20' :
                                                    'bg-slate-100 dark:bg-slate-500/20'
                                                }`}>
                                                    <NotificationIcon type={notif.type} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-sm font-bold truncate ${!notif.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                            {notif.title}
                                                        </p>
                                                        <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{timeAgo(notif.createdAt)}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                                                </div>
                                                {!notif.read && <div className="w-2 h-2 bg-amber-500 rounded-full shrink-0 mt-1.5" />}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onLogout}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400
                                   rounded-xl text-gray-500 dark:text-gray-400 transition-all active:scale-95
                                   w-10 h-10 flex items-center justify-center"
                        aria-label="Cerrar sesión"
                    >
                        <LogOut className="w-[18px] h-[18px]" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(Header);
