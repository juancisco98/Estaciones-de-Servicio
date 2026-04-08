import { useCallback } from 'react';
import { toast } from 'sonner';
import { Station } from '../types';
import { useDataContext } from '../context/DataContext';
import { stationToDb } from '../utils/mappers';
import { supabaseUpsert, supabaseUpdate, supabaseDelete } from '../utils/supabaseHelpers';
import { supabase } from '../services/supabaseClient';
import { generateUUID } from '../utils/generateUUID';

export const useStations = () => {
    const { stations, setStations } = useDataContext();

    const saveStation = useCallback(async (data: Partial<Station> & { name: string; address: string }): Promise<boolean> => {
        try {
            const isNew = !data.id;

            let ownerEmail = data.ownerEmail;
            if (!ownerEmail) {
                if (!isNew) {
                    const existing = stations.find(s => s.id === data.id);
                    ownerEmail = existing?.ownerEmail;
                }
                if (!ownerEmail) {
                    const { data: sessionData } = await supabase.auth.getSession();
                    ownerEmail = sessionData.session?.user?.email ?? undefined;
                }
            }

            const coords = data.coordinates;
            if (!coords || coords.length !== 2
                || isNaN(coords[0]) || isNaN(coords[1])
                || coords[0] < -90 || coords[0] > 90
                || coords[1] < -180 || coords[1] > 180) {
                toast.error('Coordenadas inválidas', { description: 'Ingresá una ubicación válida para la estación' });
                return false;
            }

            const station: Station = {
                id:          data.id ?? generateUUID(),
                name:        data.name,
                address:     data.address,
                coordinates: coords,
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
        } catch (error) {
            console.error('[useStations] Error guardando estación:', error);
            toast.error('Error al guardar estación', { description: error instanceof Error ? error.message : 'Error desconocido' });
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
        } catch (error) {
            console.error('[useStations] Error cambiando estado:', error);
            toast.error('Error al actualizar estación', { description: error instanceof Error ? error.message : 'Error desconocido' });
            return false;
        }
    }, [stations, setStations]);

    const deleteStation = useCallback(async (id: string): Promise<boolean> => {
        try {
            await supabaseDelete('stations', id, 'estación');
            setStations(prev => prev.filter(s => s.id !== id));
            toast.success('Estación eliminada permanentemente');
            return true;
        } catch (error) {
            console.error('[useStations] Error eliminando estación:', error);
            toast.error('Error al eliminar estación', { description: error instanceof Error ? error.message : 'Error desconocido' });
            return false;
        }
    }, [setStations]);

    const getActiveStations = useCallback(() =>
        stations.filter(s => s.isActive),
    [stations]);

    const getStationById = useCallback((id: string) =>
        stations.find(s => s.id === id),
    [stations]);

    return { stations, saveStation, deactivateStation, deleteStation, getActiveStations, getStationById };
};
