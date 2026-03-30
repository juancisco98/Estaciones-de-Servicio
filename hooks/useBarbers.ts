import { useCallback } from 'react';
import { Barber } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabaseUpsert, supabaseUpdate } from '../utils/supabaseHelpers';
import { barberToDb } from '../utils/mappers';

export const useBarbers = () => {
    const { barbers, setBarbers, sessions } = useDataContext();

    const saveBarber = useCallback(async (barber: Barber) => {
        const payload = barberToDb(barber);
        await supabaseUpsert('barbers', payload, 'barber');
        setBarbers(prev => {
            const exists = prev.some(b => b.id === barber.id);
            if (exists) return prev.map(b => b.id === barber.id ? barber : b);
            return [...prev, barber];
        });
    }, [setBarbers]);

    // Soft delete: los barberos inactivos conservan su historial
    const deactivateBarber = useCallback(async (id: string) => {
        await supabaseUpdate('barbers', id, { is_active: false }, 'barber');
        setBarbers(prev => prev.map(b => b.id === id ? { ...b, isActive: false } : b));
    }, [setBarbers]);

    // Métricas de un barbero calculadas desde el estado local
    const getBarberMetrics = useCallback((barberId: string, dateFrom?: string, dateTo?: string) => {
        const barberSessions = sessions.filter(s => {
            if (s.barberId !== barberId) return false;
            if (dateFrom && s.startedAt < dateFrom) return false;
            if (dateTo && s.startedAt > dateTo) return false;
            return true;
        });

        const totalCuts = barberSessions.length;
        const totalRevenue = barberSessions.reduce((sum, s) => sum + s.price, 0);
        const totalCommission = barberSessions.reduce((sum, s) => sum + s.commissionAmt, 0);
        const durations = barberSessions.filter(s => s.durationMins).map(s => s.durationMins!);
        const avgDurationMins = durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : undefined;

        return { totalCuts, totalRevenue, totalCommission, avgDurationMins };
    }, [sessions]);

    return { barbers, saveBarber, deactivateBarber, getBarberMetrics };
};
