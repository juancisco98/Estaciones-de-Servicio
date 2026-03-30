import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    Station,
    Employee,
    SalesTransaction,
    CardPayment,
    TankLevel,
    DailyClosing,
    Alert,
    AlertLevel,
    AppNotification,
} from '../types';
import {
    DbSalesTransactionRow,
    DbTankLevelRow,
    DbDailyClosingRow,
    DbAlertRow,
    DbNotificationRow,
} from '../types/dbRows';
import { supabase } from '../services/supabaseClient';
import {
    dbToStation,
    dbToEmployee,
    dbToSalesTransaction,
    dbToCardPayment,
    dbToTankLevel,
    dbToDailyClosing,
    dbToAlert,
    dbToNotification,
} from '../utils/mappers';
import { handleError } from '../utils/errorHandler';
import { TRANSACTIONS_LOAD_DAYS, RT_CHANNELS } from '../constants';
import { toast } from 'sonner';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface DataContextType {
    stations: Station[];
    setStations: React.Dispatch<React.SetStateAction<Station[]>>;
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    salesTransactions: SalesTransaction[];
    setSalesTransactions: React.Dispatch<React.SetStateAction<SalesTransaction[]>>;
    cardPayments: CardPayment[];
    setCardPayments: React.Dispatch<React.SetStateAction<CardPayment[]>>;
    tankLevels: TankLevel[];
    setTankLevels: React.Dispatch<React.SetStateAction<TankLevel[]>>;
    dailyClosings: DailyClosing[];
    setDailyClosings: React.Dispatch<React.SetStateAction<DailyClosing[]>>;
    alerts: Alert[];
    setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
    notifications: AppNotification[];
    unreadCount: number;
    unresolvedAlertCount: number;
    criticalAlertCount: number;
    markNotificationRead: (id: string) => Promise<void>;
    markAllNotificationsRead: () => Promise<void>;
    resolveAlert: (id: string) => Promise<void>;
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [stations, setStations]                   = useState<Station[]>([]);
    const [employees, setEmployees]                 = useState<Employee[]>([]);
    const [salesTransactions, setSalesTransactions] = useState<SalesTransaction[]>([]);
    const [cardPayments, setCardPayments]           = useState<CardPayment[]>([]);
    const [tankLevels, setTankLevels]               = useState<TankLevel[]>([]);
    const [dailyClosings, setDailyClosings]         = useState<DailyClosing[]>([]);
    const [alerts, setAlerts]                       = useState<Alert[]>([]);
    const [notifications, setNotifications]         = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading]                 = useState(true);

    const unreadCount = notifications.filter(n => !n.read).length;
    const unresolvedAlertCount = alerts.filter(a => !a.resolved).length;
    const criticalAlertCount   = alerts.filter(a => !a.resolved && a.level === 'CRITICAL').length;

    // ── Notification actions ──────────────────────────────────────────────────

    const markNotificationRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        await supabase.from('notifications').update({ read: true }).eq('id', id);
    }, []);

    const markAllNotificationsRead = useCallback(async () => {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    }, [notifications]);

    const resolveAlert = useCallback(async (id: string) => {
        setAlerts(prev => prev.map(a =>
            a.id === id ? { ...a, resolved: true, resolvedAt: new Date().toISOString() } : a
        ));
        await supabase
            .from('alerts')
            .update({ resolved: true, resolved_at: new Date().toISOString() })
            .eq('id', id);
    }, []);

    // ── Data loading ──────────────────────────────────────────────────────────

    const loadData = async () => {
        setIsLoading(true);
        try {
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - TRANSACTIONS_LOAD_DAYS);
            const dateCutoff     = dateFrom.toISOString();
            const dateCutoffDate = dateCutoff.slice(0, 10);

            const [
                stationsResult,
                employeesResult,
                txResult,
                closingsResult,
                tanksResult,
                alertsResult,
                notificationsResult,
            ] = await Promise.all([
                supabase.from('stations').select('*').order('name', { ascending: true }),
                supabase.from('employees').select('*').order('name', { ascending: true }),
                supabase.from('sales_transactions').select('*')
                    .gte('shift_date', dateCutoffDate)
                    .order('transaction_ts', { ascending: false }),
                supabase.from('daily_closings').select('*')
                    .gte('shift_date', dateCutoffDate)
                    .order('shift_date', { ascending: false }),
                supabase.from('tank_levels').select('*')
                    .gte('recorded_at', dateCutoff)
                    .order('recorded_at', { ascending: false })
                    .limit(500),
                supabase.from('alerts').select('*')
                    .eq('resolved', false)
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase.from('notifications').select('*')
                    .order('created_at', { ascending: false }).limit(50),
            ]);

            if (stationsResult.error)  throw stationsResult.error;
            if (employeesResult.error) throw employeesResult.error;

            if (stationsResult.data)      setStations(stationsResult.data.map(dbToStation));
            if (employeesResult.data)     setEmployees(employeesResult.data.map(dbToEmployee));
            if (txResult.data)            setSalesTransactions(txResult.data.map(dbToSalesTransaction));
            if (closingsResult.data)      setDailyClosings(closingsResult.data.map(dbToDailyClosing));
            if (tanksResult.data)         setTankLevels(tanksResult.data.map(dbToTankLevel));
            if (alertsResult.data)        setAlerts(alertsResult.data.map(dbToAlert));
            if (notificationsResult.data) setNotifications(notificationsResult.data.map(dbToNotification));

            // card_payments: optional, does not block the app
            try {
                const cpResult = await supabase.from('card_payments').select('*')
                    .gte('shift_date', dateCutoffDate)
                    .order('shift_date', { ascending: false });
                if (cpResult.data) setCardPayments(cpResult.data.map(dbToCardPayment));
            } catch {
                console.warn('[DataContext] card_payments table not available');
            }

        } catch (error) {
            handleError(error, 'Error al cargar los datos. Por favor recargue la página.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Real-time subscriptions ───────────────────────────────────────────────

    useEffect(() => {
        loadData();

        // Sales transactions
        const salesChannel = supabase
            .channel(RT_CHANNELS.SALES)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'sales_transactions' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setSalesTransactions(prev => {
                            if (prev.some(t => t.id === payload.new.id)) return prev;
                            return [dbToSalesTransaction(payload.new as DbSalesTransactionRow), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setSalesTransactions(prev => prev.map(t =>
                            t.id === payload.new.id ? dbToSalesTransaction(payload.new as DbSalesTransactionRow) : t
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setSalesTransactions(prev => prev.filter(t => t.id !== payload.old.id));
                    }
                }
            ).subscribe();

        // Tank levels
        const tanksChannel = supabase
            .channel(RT_CHANNELS.TANKS)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'tank_levels' },
                (payload) => {
                    setTankLevels(prev => {
                        if (prev.some(t => t.id === payload.new.id)) return prev;
                        return [dbToTankLevel(payload.new as DbTankLevelRow), ...prev];
                    });
                }
            ).subscribe();

        // Daily closings
        const closingsChannel = supabase
            .channel(RT_CHANNELS.CLOSINGS)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'daily_closings' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setDailyClosings(prev => {
                            if (prev.some(c => c.id === payload.new.id)) return prev;
                            return [dbToDailyClosing(payload.new as DbDailyClosingRow), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setDailyClosings(prev => prev.map(c =>
                            c.id === payload.new.id ? dbToDailyClosing(payload.new as DbDailyClosingRow) : c
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setDailyClosings(prev => prev.filter(c => c.id !== payload.old.id));
                    }
                }
            ).subscribe();

        // Alerts — critical ones surface immediately as toasts
        const alertsChannel = supabase
            .channel(RT_CHANNELS.ALERTS)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'alerts' },
                (payload) => {
                    const alert = dbToAlert(payload.new as DbAlertRow);
                    setAlerts(prev => {
                        if (prev.some(a => a.id === alert.id)) return prev;
                        return [alert, ...prev];
                    });

                    // Show toast based on alert level
                    if (alert.level === 'CRITICAL') {
                        toast.error(alert.title, {
                            description: alert.message,
                            duration: 10000,
                            icon: React.createElement(AlertTriangle, { className: 'w-4 h-4 text-red-500' }),
                        });
                    } else if (alert.level === 'WARNING') {
                        toast.warning(alert.title, {
                            description: alert.message,
                            duration: 7000,
                            icon: React.createElement(AlertTriangle, { className: 'w-4 h-4 text-orange-500' }),
                        });
                    } else {
                        toast(alert.title, {
                            description: alert.message,
                            duration: 5000,
                            icon: React.createElement(Info, { className: 'w-4 h-4 text-blue-500' }),
                        });
                    }
                }
            )
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'alerts' },
                (payload) => {
                    setAlerts(prev => prev.map(a =>
                        a.id === payload.new.id ? dbToAlert(payload.new as DbAlertRow) : a
                    ));
                }
            ).subscribe();

        // Notifications
        const notificationsChannel = supabase
            .channel(RT_CHANNELS.NOTIFICATIONS)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    const notif = dbToNotification(payload.new as DbNotificationRow);
                    setNotifications(prev => [notif, ...prev]);
                    toast(notif.title, {
                        description: notif.message,
                        duration: 5000,
                        icon: React.createElement(CheckCircle, { className: 'w-4 h-4 text-emerald-500' }),
                    });
                }
            )
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'notifications' },
                (payload) => {
                    setNotifications(prev => prev.map(n =>
                        n.id === payload.new.id ? dbToNotification(payload.new as DbNotificationRow) : n
                    ));
                }
            ).subscribe();

        return () => {
            supabase.removeChannel(salesChannel);
            supabase.removeChannel(tanksChannel);
            supabase.removeChannel(closingsChannel);
            supabase.removeChannel(alertsChannel);
            supabase.removeChannel(notificationsChannel);
        };
    }, []);

    return (
        <DataContext.Provider value={{
            stations,             setStations,
            employees,            setEmployees,
            salesTransactions,    setSalesTransactions,
            cardPayments,         setCardPayments,
            tankLevels,           setTankLevels,
            dailyClosings,        setDailyClosings,
            alerts,               setAlerts,
            notifications,
            unreadCount,
            unresolvedAlertCount,
            criticalAlertCount,
            markNotificationRead,
            markAllNotificationsRead,
            resolveAlert,
            isLoading,
            refreshData: loadData,
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useDataContext = () => {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error('useDataContext must be used within a DataProvider');
    return ctx;
};
