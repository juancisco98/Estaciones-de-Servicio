import { useCallback } from 'react';
import { toast } from 'sonner';
import { Station } from '../types';
import { useDataContext } from '../context/DataContext';
import { stationToDb } from '../utils/mappers';
import { supabaseUpsert, supabaseDelete } from '../utils/supabaseHelpers';
import { generateUUID } from '../utils/generateUUID';

export const useStations = () => {
    const { stations, setStations } = useDataContext();

    const saveStation = useCallback(async (data: Partial<Station> & { name: string; address: string }): Promise<boolean> => {
        try {
            const isNew = !data.id;
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
    }, [setStations]);

    const deactivateStation = useCallback(async (id: string): Promise<boolean> => {
        try {
            await supabaseUpsert('stations', { id, is_active: false }, 'estación');
            setStations(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s));
            toast.success('Estación desactivada');
            return true;
        } catch {
            return false;
        }
    }, [setStations]);

    const getActiveStations = useCallback(() =>
        stations.filter(s => s.isActive),
    [stations]);

    const getStationById = useCallback((id: string) =>
        stations.find(s => s.id === id),
    [stations]);

    return { stations, saveStation, deactivateStation, getActiveStations, getStationById };
};
