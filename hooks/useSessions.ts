import { useCallback } from 'react';
import { HaircutSession } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabaseUpsert, supabaseDelete } from '../utils/supabaseHelpers';
import { haircutSessionToDb } from '../utils/mappers';

export const useSessions = () => {
    const { sessions, setSessions } = useDataContext();

    const registerSession = useCallback(async (session: HaircutSession) => {
        const payload = haircutSessionToDb(session);
        await supabaseUpsert('haircut_sessions', payload, 'haircut_session');
        // El realtime channel en DataContext actualiza el estado
    }, []);

    const updateSession = useCallback(async (session: HaircutSession) => {
        const payload = haircutSessionToDb(session);
        await supabaseUpsert('haircut_sessions', payload, 'haircut_session');
    }, []);

    // Solo se puede eliminar si la sesión NO tiene un cierre cerrado
    const deleteSession = useCallback(async (id: string) => {
        const session = sessions.find(s => s.id === id);
        if (session?.shiftClosingId) {
            throw new Error('No se puede eliminar una sesión ya incluida en un cierre de turno cerrado.');
        }
        await supabaseDelete('haircut_sessions', id, 'haircut_session');
        setSessions(prev => prev.filter(s => s.id !== id));
    }, [sessions, setSessions]);

    // Sesiones del día de un barbero sin cierre de turno asignado
    const getUnassignedSessions = useCallback((barberId: string, date?: string) => {
        const today = date ?? new Date().toISOString().slice(0, 10);
        return sessions.filter(s =>
            s.barberId === barberId &&
            s.startedAt.slice(0, 10) === today &&
            !s.shiftClosingId
        );
    }, [sessions]);

    const getSessionsByBarber = useCallback((barberId: string, date?: string) => {
        if (date) {
            return sessions.filter(s => s.barberId === barberId && s.startedAt.slice(0, 10) === date);
        }
        return sessions.filter(s => s.barberId === barberId);
    }, [sessions]);

    const getSessionsByBarbershop = useCallback((barbershopId: string, dateFrom?: string, dateTo?: string) => {
        return sessions.filter(s => {
            if (s.barbershopId !== barbershopId) return false;
            if (dateFrom && s.startedAt < dateFrom) return false;
            if (dateTo && s.startedAt > dateTo + 'T23:59:59') return false;
            return true;
        });
    }, [sessions]);

    return {
        sessions,
        registerSession,
        updateSession,
        deleteSession,
        getUnassignedSessions,
        getSessionsByBarber,
        getSessionsByBarbershop,
    };
};
