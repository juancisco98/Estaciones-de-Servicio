import { useCallback } from 'react';
import { ShiftClosing, AppNotification } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabaseUpsert, supabaseInsert } from '../utils/supabaseHelpers';
import { supabase } from '../services/supabaseClient';
import { shiftClosingToDb, notificationToDb } from '../utils/mappers';
import { ALLOWED_EMAILS } from '../constants';

const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

export const useShiftClosings = () => {
    const { shiftClosings, setShiftClosings, sessions, setSessions, barbershops, barbers } = useDataContext();

    // Abre un turno (crea un ShiftClosing en estado OPEN)
    const openShift = useCallback(async (barbershopId: string, barberId: string): Promise<ShiftClosing> => {
        const today = new Date().toISOString().slice(0, 10);
        const newClosing: ShiftClosing = {
            id: generateUUID(),
            barbershopId,
            barberId,
            shiftDate: today,
            startedAt: new Date().toISOString(),
            closedAt: null,
            totalCuts: 0,
            totalCash: 0,
            totalCard: 0,
            totalTransfer: 0,
            totalRevenue: 0,
            totalCommission: 0,
            expensesCash: 0,
            expensesDetail: [],
            status: 'OPEN',
        };
        await supabaseUpsert('shift_closings', shiftClosingToDb(newClosing), 'shift_closing');
        setShiftClosings(prev => [newClosing, ...prev]);
        return newClosing;
    }, [setShiftClosings]);

    // Cierra el turno: actualiza totales, vincula sesiones huérfanas, marca CLOSED
    // y envía notificación con desglose completo a todos los admins
    const closeShift = useCallback(async (closing: ShiftClosing) => {
        const closedClosing: ShiftClosing = { ...closing, status: 'CLOSED', closedAt: new Date().toISOString() };
        await supabaseUpsert('shift_closings', shiftClosingToDb(closedClosing), 'shift_closing');

        // Vincular sesiones del día sin cierre asignado a este cierre
        const today = closing.shiftDate;
        const orphanSessions = sessions.filter(s =>
            s.barberId === closing.barberId &&
            s.startedAt.slice(0, 10) === today &&
            !s.shiftClosingId
        );
        if (orphanSessions.length > 0) {
            const ids = orphanSessions.map(s => s.id);
            await supabase
                .from('haircut_sessions')
                .update({ shift_closing_id: closing.id })
                .in('id', ids);
            setSessions(prev => prev.map(s =>
                ids.includes(s.id) ? { ...s, shiftClosingId: closing.id } : s
            ));
        }

        setShiftClosings(prev => prev.map(c => c.id === closing.id ? closedClosing : c));

        // Lookup de nombre de barbería y barbero para el desglose
        const shop = barbershops.find(b => b.id === closing.barbershopId);
        const barber = barbers.find(b => b.id === closing.barberId);

        // Crear notificación enriquecida para todos los admins
        const adminEmail = ALLOWED_EMAILS[0] ?? 'admin';
        const notification: AppNotification = {
            id: generateUUID(),
            recipientEmail: adminEmail,
            type: 'SHIFT_CLOSED',
            title: `Turno cerrado — ${barber?.name ?? 'Barbero'}`,
            message: `${shop?.name ?? 'Barbería'} · ${closing.totalCuts} cortes · $${closing.totalRevenue.toLocaleString('es-AR')}`,
            read: false,
            createdAt: new Date().toISOString(),
            metadata: {
                barbershopId: closing.barbershopId,
                barbershopName: shop?.name ?? '',
                barberId: closing.barberId,
                barberName: barber?.name ?? '',
                shiftDate: closing.shiftDate,
                totalCuts: closing.totalCuts,
                totalRevenue: closing.totalRevenue,
                totalCash: closing.totalCash,
                totalCard: closing.totalCard,
                totalTransfer: closing.totalTransfer,
                totalCommission: closing.totalCommission,
                expensesCash: closing.expensesCash,
                netCashToHand: closing.netCashToHand ?? (closing.totalCash - closing.expensesCash),
                expensesDetail: closing.expensesDetail,
            },
        };

        try {
            await supabaseInsert('notifications', notificationToDb(notification), 'shift_notification');
        } catch (err) {
            // No fallar el cierre si la notificación no se pudo enviar
            console.error('[ShiftClose] No se pudo crear notificación:', err);
        }
    }, [sessions, setSessions, setShiftClosings, barbershops, barbers]);

    // Turno abierto del día para un barbero (o null si no tiene)
    const getActiveShift = useCallback((barberId: string): ShiftClosing | null => {
        const today = new Date().toISOString().slice(0, 10);
        return shiftClosings.find(c =>
            c.barberId === barberId &&
            c.shiftDate === today &&
            c.status === 'OPEN'
        ) ?? null;
    }, [shiftClosings]);

    // Historial de cierres de un barbero, ordenados de más reciente a más antiguo
    const getShiftHistory = useCallback((barberId: string, limit = 30): ShiftClosing[] => {
        return shiftClosings
            .filter(c => c.barberId === barberId && c.status === 'CLOSED')
            .sort((a, b) => b.shiftDate.localeCompare(a.shiftDate))
            .slice(0, limit);
    }, [shiftClosings]);

    // Cierres de una barbería en un rango de fechas
    const getShiftsByBarbershop = useCallback((barbershopId: string, dateFrom?: string, dateTo?: string) => {
        return shiftClosings.filter(c => {
            if (c.barbershopId !== barbershopId) return false;
            if (dateFrom && c.shiftDate < dateFrom) return false;
            if (dateTo && c.shiftDate > dateTo) return false;
            return true;
        });
    }, [shiftClosings]);

    return {
        shiftClosings,
        openShift,
        closeShift,
        getActiveShift,
        getShiftHistory,
        getShiftsByBarbershop,
    };
};
