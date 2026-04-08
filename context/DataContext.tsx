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
    AllowedEmail,
    CashClosing,
} from '../types';
import {
    DbSalesTransactionRow,
    DbTankLevelRow,
    DbDailyClosingRow,
    DbCardPaymentRow,
    DbCashClosingRow,
    DbAlertRow,
    DbNotificationRow,
    DbAllowedEmailRow,
} from '../types/dbRows';
import { supabase } from '../services/supabaseClient';
import { getArgentinaToday } from '../utils/dateUtils';
import {
    dbToStation,
    dbToEmployee,
    dbToSalesTransaction,
    dbToCardPayment,
    dbToTankLevel,
    dbToDailyClosing,
    dbToAlert,
    dbToNotification,
    dbToAllowedEmail,
    dbToCashClosing,
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
    cashClosings: CashClosing[];
    setCashClosings: React.Dispatch<React.SetStateAction<CashClosing[]>>;
    allowedEmails: AllowedEmail[];
    setAllowedEmails: React.Dispatch<React.SetStateAction<AllowedEmail[]>>;
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
    const [cashClosings, setCashClosings]             = useState<CashClosing[]>([]);
    const [alerts, setAlerts]                       = useState<Alert[]>([]);
    const [notifications, setNotifications]         = useState<AppNotification[]>([]);
    const [allowedEmails, setAllowedEmails]         = useState<AllowedEmail[]>([]);
    const [isLoading, setIsLoading]                 = useState(true);

    const unreadCount = notifications.filter(n => !n.read).length;
    const unresolvedAlertCount = alerts.filter(a => !a.resolved).length;
    const criticalAlertCount   = alerts.filter(a => !a.resolved && a.level === 'CRITICAL').length;

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

    const loadData = async () => {
        setIsLoading(true);
        try {
            const todayAR = getArgentinaToday();
            const dateFrom = new Date(todayAR + 'T12:00:00');
            dateFrom.setDate(dateFrom.getDate() - TRANSACTIONS_LOAD_DAYS);
            const dateCutoffDate = dateFrom.toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' });

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
                    .gte('recorded_at', dateCutoffDate)
                    .order('recorded_at', { ascending: false })
                    .limit(1000),
                supabase.from('alerts').select('*')
                    .eq('resolved', false)
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase.from('notifications').select('*')
                    .order('created_at', { ascending: false }).limit(50),
            ]);

            if (stationsResult.error)  throw stationsResult.error;
            if (employeesResult.error) throw employeesResult.error;

            if (txResult.error)            console.error('[DataContext] sales_transactions error:', txResult.error);
            if (closingsResult.error)      console.error('[DataContext] daily_closings error:', closingsResult.error);
            if (tanksResult.error)         console.error('[DataContext] tank_levels error:', tanksResult.error);
            if (alertsResult.error)        console.error('[DataContext] alerts error:', alertsResult.error);
            if (notificationsResult.error) console.error('[DataContext] notifications error:', notificationsResult.error);

            if (stationsResult.data)      setStations(stationsResult.data.map(dbToStation));
            if (employeesResult.data)     setEmployees(employeesResult.data.map(dbToEmployee));
            if (txResult.data)            setSalesTransactions(txResult.data.map(dbToSalesTransaction));
            if (closingsResult.data)      setDailyClosings(closingsResult.data.map(dbToDailyClosing));
            if (tanksResult.data)         setTankLevels(tanksResult.data.map(dbToTankLevel));
            if (alertsResult.data)        setAlerts(alertsResult.data.map(dbToAlert));
            if (notificationsResult.data) setNotifications(notificationsResult.data.map(dbToNotification));

            try {
                const cpResult = await supabase.from('card_payments').select('*')
                    .gte('shift_date', dateCutoffDate)
                    .order('shift_date', { ascending: false });
                if (cpResult.data) setCardPayments(cpResult.data.map(dbToCardPayment));
            } catch {
                console.warn('[DataContext] card_payments table not available');
            }

            try {
                const ccResult = await supabase.from('cash_closings').select('*')
                    .gte('shift_date', dateCutoffDate)
                    .order('shift_date', { ascending: false });
                if (ccResult.data) setCashClosings(ccResult.data.map(dbToCashClosing));
            } catch {
                console.warn('[DataContext] cash_closings table not available');
            }

            try {
                const aeResult = await supabase.from('allowed_emails').select('*')
                    .order('created_at', { ascending: true });
                if (aeResult.data) setAllowedEmails(aeResult.data.map(dbToAllowedEmail));
            } catch {
                console.warn('[DataContext] allowed_emails table not available');
            }

        } catch (error) {
            handleError(error, 'Error al cargar los datos. Por favor recargue la página.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();

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

        const tanksChannel = supabase
            .channel(RT_CHANNELS.TANKS)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'tank_levels' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setTankLevels(prev => {
                            if (prev.some(t => t.id === payload.new.id)) return prev;
                            return [dbToTankLevel(payload.new as DbTankLevelRow), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setTankLevels(prev => prev.map(t =>
                            t.id === payload.new.id ? dbToTankLevel(payload.new as DbTankLevelRow) : t
                        ));
                    }
                }
            ).subscribe();

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

        const cardPaymentsChannel = supabase
            .channel(RT_CHANNELS.CARD_PAYMENTS)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'card_payments' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setCardPayments(prev => {
                            if (prev.some(p => p.id === payload.new.id)) return prev;
                            return [dbToCardPayment(payload.new as DbCardPaymentRow), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setCardPayments(prev => prev.map(p =>
                            p.id === payload.new.id ? dbToCardPayment(payload.new as DbCardPaymentRow) : p
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setCardPayments(prev => prev.filter(p => p.id !== payload.old.id));
                    }
                }
            ).subscribe();

        const cashClosingsChannel = supabase
            .channel(RT_CHANNELS.CASH_CLOSINGS)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'cash_closings' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setCashClosings(prev => {
                            if (prev.some(c => c.id === payload.new.id)) return prev;
                            return [dbToCashClosing(payload.new as DbCashClosingRow), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setCashClosings(prev => prev.map(c =>
                            c.id === payload.new.id ? dbToCashClosing(payload.new as DbCashClosingRow) : c
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setCashClosings(prev => prev.filter(c => c.id !== payload.old.id));
                    }
                }
            ).subscribe();

        return () => {
            supabase.removeChannel(salesChannel);
            supabase.removeChannel(tanksChannel);
            supabase.removeChannel(closingsChannel);
            supabase.removeChannel(cardPaymentsChannel);
            supabase.removeChannel(cashClosingsChannel);
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
            cashClosings,         setCashClosings,
            alerts,               setAlerts,
            allowedEmails,        setAllowedEmails,
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
