import React, { useState, useRef, useEffect } from 'react';
import { Menu, Loader2, Bell, Sun, Moon, CheckCircle, Clock, Scissors, X, Check, LogOut, RefreshCw, Search } from 'lucide-react';
import { User, AppNotification, ShiftClosingMetadata } from '../types';
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
    onShiftClosingClick?: (metadata: ShiftClosingMetadata) => void;
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
    if (type === 'SHIFT_CLOSED') return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (type === 'SHIFT_PENDING') return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
    if (type === 'BARBER_ADDED') return <Scissors className="w-4 h-4 text-indigo-500 shrink-0" />;
    return <Bell className="w-4 h-4 text-slate-500 shrink-0" />;
};

const Header: React.FC<HeaderProps> = ({
    onMenuClick,
    currentUser,
    onLogout,
    onRefresh,
    isLoading,
    onMapSearch,
    onShiftClosingClick,
}) => {
    const { theme, toggleTheme } = useTheme();
    const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useDataContext();
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
            }
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="absolute top-0 left-0 right-0 z-[800] p-3 sm:p-4 pointer-events-none">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-lg dark:shadow-black/30 rounded-2xl sm:rounded-full p-2 sm:p-2.5 flex items-center gap-2 pointer-events-auto max-w-full xl:max-w-7xl mx-auto border border-white/60 dark:border-white/10">

                {/* Left: menu + logo */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-gray-700 dark:text-white transition-all w-10 h-10 flex items-center justify-center"
                        aria-label="Abrir menú"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <div className="hidden sm:flex flex-col ml-1 mr-1">
                        <h1 className="text-base font-extrabold text-gray-900 dark:text-white leading-none tracking-tight">Rufianes</h1>
                        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            {currentUser?.name?.split(' ')[0] || 'Admin'}
                        </p>
                    </div>
                </div>

                {/* Center: search bar */}
                {onMapSearch && (
                    <form onSubmit={handleSearch} className="flex-1 min-w-0 mx-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar dirección..."
                                className="w-full pl-9 pr-4 py-2 rounded-xl bg-gray-100/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-white/10 text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 transition-all"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-500" />
                            )}
                        </div>
                    </form>
                )}

                {/* Right: actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-gray-600 dark:text-gray-300 transition-all w-9 h-9 flex items-center justify-center disabled:opacity-50"
                        aria-label="Actualizar"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-gray-600 dark:text-gray-300 transition-all w-9 h-9 flex items-center justify-center"
                        aria-label="Cambiar tema"
                    >
                        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </button>

                    <InstallButton />

                    {/* Notifications */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl text-gray-600 dark:text-gray-300 relative transition-all w-9 h-9 flex items-center justify-center"
                            onClick={() => setShowNotifications(v => !v)}
                            aria-label="Notificaciones"
                        >
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center leading-none">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl dark:shadow-black/40 z-[900] overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10 bg-gray-50/80 dark:bg-white/5">
                                    <div className="flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                        <span className="font-bold text-sm text-slate-800 dark:text-white">Notificaciones</span>
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount} nuevas</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={() => markAllNotificationsRead()}
                                                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                                            >
                                                <Check className="w-3 h-3" /> Todas leídas
                                            </button>
                                        )}
                                        <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-400">
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
                                                className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors cursor-pointer ${
                                                    !notif.read
                                                        ? notif.type === 'SHIFT_CLOSED' ? 'bg-emerald-50/60 dark:bg-emerald-500/10'
                                                        : notif.type === 'SHIFT_PENDING' ? 'bg-amber-50/60 dark:bg-amber-500/10'
                                                        : 'bg-indigo-50/60 dark:bg-indigo-500/10'
                                                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                                                    notif.type === 'SHIFT_CLOSED' ? 'bg-emerald-100 dark:bg-emerald-500/20' :
                                                    notif.type === 'SHIFT_PENDING' ? 'bg-amber-100 dark:bg-amber-500/20' :
                                                    notif.type === 'BARBER_ADDED' ? 'bg-indigo-100 dark:bg-indigo-500/20' :
                                                    'bg-slate-100 dark:bg-slate-500/20'
                                                }`}>
                                                    <NotificationIcon type={notif.type} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-sm font-bold truncate ${!notif.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                            {notif.title}
                                                        </p>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">{timeAgo(notif.createdAt)}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                                                    {notif.type === 'SHIFT_CLOSED' && notif.metadata && onShiftClosingClick && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setShowNotifications(false); onShiftClosingClick(notif.metadata!); }}
                                                            className="mt-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                                                        >
                                                            Ver desglose →
                                                        </button>
                                                    )}
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
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-xl text-gray-600 dark:text-gray-300 transition-all w-9 h-9 flex items-center justify-center"
                        aria-label="Cerrar sesión"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(Header);
