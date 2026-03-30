import { useCallback } from 'react';
import { DailyClosing, ClosingStatus } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabase } from '../services/supabaseClient';
import { dbToDailyClosing } from '../utils/mappers';
import { toast } from 'sonner';

export const useDailyClosings = () => {
    const { dailyClosings, setDailyClosings } = useDataContext();

    const getByStation = useCallback((stationId: string): DailyClosing[] =>
        dailyClosings
            .filter(c => c.stationId === stationId)
            .sort((a, b) => b.shiftDate.localeCompare(a.shiftDate)),
    [dailyClosings]);

    const getByDate = useCallback((stationId: string, date: string): DailyClosing | undefined =>
        dailyClosings.find(c => c.stationId === stationId && c.shiftDate === date),
    [dailyClosings]);

    const getByStatus = useCallback((status: ClosingStatus): DailyClosing[] =>
        dailyClosings.filter(c => c.status === status),
    [dailyClosings]);

    /** Fetch the latest closing for each station — used for MapBoard status icons. */
    const getLatestPerStation = useCallback((): Map<string, DailyClosing> => {
        const map = new Map<string, DailyClosing>();
        for (const c of dailyClosings) {
            const existing = map.get(c.stationId);
            if (!existing || c.shiftDate > existing.shiftDate) {
                map.set(c.stationId, c);
            }
        }
        return map;
    }, [dailyClosings]);

    /** Manually add notes to a closing (admin only). */
    const addNotes = useCallback(async (id: string, notes: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase
                .from('daily_closings')
                .update({ notes })
                .eq('id', id)
                .limit(1)
                .select()
                .maybeSingle();
            if (error) throw error;
            if (data) {
                setDailyClosings(prev =>
                    prev.map(c => c.id === id ? dbToDailyClosing(data) : c)
                );
            }
            toast.success('Nota guardada');
            return true;
        } catch {
            toast.error('Error al guardar la nota');
            return false;
        }
    }, [setDailyClosings]);

    const discrepancyCount = dailyClosings.filter(c => c.status === 'DISCREPANCY').length;
    const pendingCount     = dailyClosings.filter(c => c.status === 'PENDING').length;

    return {
        dailyClosings,
        getByStation,
        getByDate,
        getByStatus,
        getLatestPerStation,
        addNotes,
        discrepancyCount,
        pendingCount,
    };
};
