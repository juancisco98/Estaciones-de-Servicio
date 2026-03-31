import { useCallback } from 'react';
import { toast } from 'sonner';
import { Station } from '../types';
import { useDataContext } from '../context/DataContext';
import { stationToDb } from '../utils/mappers';
import { supabaseUpsert, supabaseUpdate } from '../utils/supabaseHelpers';
import { supabase } from '../services/supabaseClient';
import { generateUUID } from '../utils/generateUUID';

export const useStations = () => {
    const { stations, setStations } = useDataContext();

    const saveStation = useCallback(async (data: Partial<Station> & { name: string; address: string }): Promise<boolean> => {
        try {
            const isNew = !data.id;

            // Get current user email for owner_email (required NOT NULL)
            let ownerEmail = data.ownerEmail;
            if (!ownerEmail) {
                if (!isNew) {
                    // Editing: preserve existing owner_email
                    const existing = stations.find(s => s.id === data.id);
                    ownerEmail = existing?.ownerEmail;
                }
                if (!ownerEmail) {
                    // New station or no existing: use current user's email
                    const { data: sessionData } = await supabase.auth.getSession();
                    ownerEmail = sessionData.session?.user?.email ?? undefined;
                }
            }

            const station: Station = {
                id:          data.id ?? generateUUID(),
                name:        data.name,
                address:     data.address,
                coordinates: data.coordinates ?? [-34.6037, -58.3816],
                city:        data.city,
                province:    data.province,
                phone:       data.phone,
                managerName: data.managerName,
                isActive:    data.isActive ?? true,
                ownerEmail,
                stationCode: data.stationCode,
                watchPath:   data.watchPath,
                notes:       data.notes,
            };
            await supabaseUpsert('stations', stationToDb(station), 'estación');
            setStations(prev =>
                isNew
                    ? [...prev, station].sort((a, b) => a.name.localeCompare(b.name))
                    : prev.map(s => s.id === station.id ? station : s)
            );
            toast.success(isNew ? 'Estación creada' : 'Estación actualizada');
            return true;
        } catch {
            return false;
        }
    }, [stations, setStations]);

    const deactivateStation = useCallback(async (id: string): Promise<boolean> => {
        try {
            const current = stations.find(s => s.id === id);
            if (!current) return false;
            const newActive = !current.isActive;
            await supabaseUpdate('stations', id, { is_active: newActive }, 'estación');
            setStations(prev => prev.map(s => s.id === id ? { ...s, isActive: newActive } : s));
            toast.success(newActive ? 'Estación activada' : 'Estación desactivada');
            return true;
        } catch {
            return false;
        }
    }, [stations, setStations]);

    const getActiveStations = useCallback(() =>
        stations.filter(s => s.isActive),
    [stations]);

    const getStationById = useCallback((id: string) =>
        stations.find(s => s.id === id),
    [stations]);

    return { stations, saveStation, deactivateStation, getActiveStations, getStationById };
};
