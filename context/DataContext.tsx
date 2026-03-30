import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
    Barbershop,
    Barber,
    Service,
    Client,
    HaircutSession,
    ShiftClosing,
    AppNotification,
} from '../types';
import {
    DbHaircutSessionRow,
    DbShiftClosingRow,
    DbNotificationRow,
} from '../types/dbRows';
import { supabase } from '../services/supabaseClient';
import {
    dbToBarbershop,
    dbToBarber,
    dbToService,
    dbToClient,
    dbToHaircutSession,
    dbToShiftClosing,
    dbToNotification,
} from '../utils/mappers';
import { handleError } from '../utils/errorHandler';
import { SESSIONS_LOAD_DAYS } from '../constants';
import { toast } from 'sonner';
import { Scissors, CheckCircle } from 'lucide-react';

interface DataContextType {
    barbershops: Barbershop[];
    setBarbershops: React.Dispatch<React.SetStateAction<Barbershop[]>>;
    barbers: Barber[];
    setBarbers: React.Dispatch<React.SetStateAction<Barber[]>>;
    services: Service[];
    setServices: React.Dispatch<React.SetStateAction<Service[]>>;
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    sessions: HaircutSession[];
    setSessions: React.Dispatch<React.SetStateAction<HaircutSession[]>>;
    shiftClosings: ShiftClosing[];
    setShiftClosings: React.Dispatch<React.SetStateAction<ShiftClosing[]>>;
    notifications: AppNotification[];
    unreadCount: number;
    markNotificationRead: (id: string) => Promise<void>;
    markAllNotificationsRead: () => Promise<void>;
    isLoading: boolean;
    refreshData: () => Promise<void>;
    initBarberMode: (barbershopId: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [barbershops, setBarbershops] = useState<Barbershop[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [sessions, setSessions] = useState<HaircutSession[]>([]);
    const [shiftClosings, setShiftClosings] = useState<ShiftClosing[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filtro de barbería: cuando está seteado, las queries y eventos realtime
    // se limitan a esa barbería (modo BARBER). Null = sin filtro (modo ADMIN).
    const barbershopFilterRef = useRef<string | null>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

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

    const loadData = async (barbershopId?: string) => {
        setIsLoading(true);
        try {
            // Ventana de carga: últimos N días para sessions y shift_closings
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - SESSIONS_LOAD_DAYS);
            const dateCutoff = dateFrom.toISOString();

            // Queries de sesiones y cierres — filtradas por barbería en modo BARBER
            let sessionsQuery = supabase
                .from('haircut_sessions').select('*')
                .gte('started_at', dateCutoff)
                .order('started_at', { ascending: false });
            let closingsQuery = supabase
                .from('shift_closings').select('*')
                .gte('shift_date', dateCutoff.slice(0, 10))
                .order('shift_date', { ascending: false });

            if (barbershopId) {
                sessionsQuery = sessionsQuery.eq('barbershop_id', barbershopId);
                closingsQuery = closingsQuery.eq('barbershop_id', barbershopId);
            }

            const [
                barbershopsResult,
                barbersResult,
                servicesResult,
                sessionsResult,
                shiftClosingsResult,
                notificationsResult,
            ] = await Promise.all([
                supabase.from('barbershops').select('*').order('name', { ascending: true }),
                supabase.from('barbers').select('*').order('name', { ascending: true }),
                supabase.from('services').select('*').order('name', { ascending: true }),
                sessionsQuery,
                closingsQuery,
                supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
            ]);

            if (barbershopsResult.error) throw barbershopsResult.error;
            if (barbersResult.error) throw barbersResult.error;
            if (servicesResult.error) throw servicesResult.error;

            if (barbershopsResult.data) setBarbershops(barbershopsResult.data.map(dbToBarbershop));
            if (barbersResult.data) setBarbers(barbersResult.data.map(dbToBarber));
            if (servicesResult.data) setServices(servicesResult.data.map(dbToService));
            if (sessionsResult.data) setSessions(sessionsResult.data.map(dbToHaircutSession));
            if (shiftClosingsResult.data) setShiftClosings(shiftClosingsResult.data.map(dbToShiftClosing));
            if (notificationsResult.data) setNotifications(notificationsResult.data.map(dbToNotification));

            // Clientes: tabla opcional, no bloquea la app si falta
            try {
                const clientsResult = await supabase.from('clients').select('*').order('name', { ascending: true });
                if (clientsResult.data) setClients(clientsResult.data.map(dbToClient));
            } catch {
                console.warn('[DataContext] Tabla clients no disponible');
            }

        } catch (error) {
            handleError(error, 'Error al cargar los datos. Por favor recargue la página.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        // Realtime: sesiones de corte
        const sessionsChannel = supabase
            .channel('haircut_sessions_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'haircut_sessions' },
                (payload) => {
                    // En modo BARBER, ignorar eventos de otras barberías
                    const filter = barbershopFilterRef.current;
                    if (filter && payload.eventType !== 'DELETE' && payload.new.barbershop_id !== filter) return;

                    if (payload.eventType === 'INSERT') {
                        setSessions(prev => {
                            if (prev.some(s => s.id === payload.new.id)) return prev;
                            return [dbToHaircutSession(payload.new as DbHaircutSessionRow), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setSessions(prev => prev.map(s =>
                            s.id === payload.new.id ? dbToHaircutSession(payload.new as DbHaircutSessionRow) : s
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setSessions(prev => prev.filter(s => s.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        // Realtime: cierres de turno
        const shiftClosingsChannel = supabase
            .channel('shift_closings_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shift_closings' },
                (payload) => {
                    // En modo BARBER, ignorar eventos de otras barberías
                    const filter = barbershopFilterRef.current;
                    if (filter && payload.eventType !== 'DELETE' && payload.new.barbershop_id !== filter) return;

                    if (payload.eventType === 'INSERT') {
                        setShiftClosings(prev => {
                            if (prev.some(c => c.id === payload.new.id)) return prev;
                            return [dbToShiftClosing(payload.new as DbShiftClosingRow), ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setShiftClosings(prev => prev.map(c =>
                            c.id === payload.new.id ? dbToShiftClosing(payload.new as DbShiftClosingRow) : c
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setShiftClosings(prev => prev.filter(c => c.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        // Realtime: notificaciones
        const notificationsChannel = supabase
            .channel('notifications_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications' },
                (payload) => {
                    const notif = dbToNotification(payload.new as DbNotificationRow);
                    setNotifications(prev => [notif, ...prev]);

                    if (notif.type === 'SHIFT_CLOSED') {
                        toast(notif.title, {
                            description: notif.message,
                            icon: React.createElement(CheckCircle, { className: 'w-4 h-4 text-emerald-500' }),
                            duration: 6000,
                        });
                    } else if (notif.type === 'BARBER_ADDED') {
                        toast(notif.title, {
                            description: notif.message,
                            icon: React.createElement(Scissors, { className: 'w-4 h-4 text-indigo-500' }),
                            duration: 6000,
                        });
                    } else {
                        toast(notif.title, { description: notif.message, duration: 5000 });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'notifications' },
                (payload) => {
                    setNotifications(prev => prev.map(n =>
                        n.id === payload.new.id ? dbToNotification(payload.new as DbNotificationRow) : n
                    ));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(sessionsChannel);
            supabase.removeChannel(shiftClosingsChannel);
            supabase.removeChannel(notificationsChannel);
        };
    }, []);

    const initBarberMode = useCallback(async (barbershopId: string) => {
        barbershopFilterRef.current = barbershopId;
        await loadData(barbershopId);
    }, []);

    return (
        <DataContext.Provider value={{
            barbershops, setBarbershops,
            barbers, setBarbers,
            services, setServices,
            clients, setClients,
            sessions, setSessions,
            shiftClosings, setShiftClosings,
            notifications,
            unreadCount,
            markNotificationRead,
            markAllNotificationsRead,
            isLoading,
            refreshData: loadData,
            initBarberMode,
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useDataContext = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useDataContext must be used within a DataProvider');
    }
    return context;
};
