import { useCallback } from 'react';
import { toast } from 'sonner';
import { AllowedEmail } from '../types';
import { useDataContext } from '../context/DataContext';
import { allowedEmailToDb, dbToAllowedEmail } from '../utils/mappers';
import { supabase } from '../services/supabaseClient';
import { generateUUID } from '../utils/generateUUID';

export const useAllowedEmails = () => {
    const { allowedEmails, setAllowedEmails, stations } = useDataContext();

    const addOwner = useCallback(async (email: string): Promise<boolean> => {
        const normalized = email.trim().toLowerCase();
        if (!normalized) {
            toast.error('Ingresá un email válido');
            return false;
        }
        if (allowedEmails.some(ae => ae.email === normalized)) {
            toast.error('Ese email ya está registrado');
            return false;
        }
        try {
            const newEntry: AllowedEmail = {
                id: generateUUID(),
                email: normalized,
                isSuperadmin: false,
            };
            const { error } = await supabase
                .from('allowed_emails')
                .insert(allowedEmailToDb(newEntry));
            if (error) throw error;
            setAllowedEmails(prev => [...prev, newEntry]);
            toast.success(`Dueño ${normalized} agregado`);
            return true;
        } catch (err) {
            console.error('[useAllowedEmails] addOwner error:', err);
            toast.error('Error al agregar dueño');
            return false;
        }
    }, [allowedEmails, setAllowedEmails]);

    const removeOwner = useCallback(async (id: string): Promise<boolean> => {
        const target = allowedEmails.find(ae => ae.id === id);
        if (!target) return false;
        if (target.isSuperadmin) {
            toast.error('No se puede eliminar un superadmin');
            return false;
        }
        try {
            const { error } = await supabase
                .from('allowed_emails')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setAllowedEmails(prev => prev.filter(ae => ae.id !== id));
            toast.success(`Dueño ${target.email} eliminado`);
            return true;
        } catch (err) {
            console.error('[useAllowedEmails] removeOwner error:', err);
            toast.error('Error al eliminar dueño');
            return false;
        }
    }, [allowedEmails, setAllowedEmails]);

    const getStationCountByOwner = useCallback((email: string): number =>
        stations.filter(s => s.ownerEmail === email).length,
    [stations]);

    const getStationsByOwner = useCallback((email: string) =>
        stations.filter(s => s.ownerEmail === email),
    [stations]);

    const getUnassignedStations = useCallback(() =>
        stations.filter(s => !s.ownerEmail || !allowedEmails.some(ae => ae.email === s.ownerEmail)),
    [stations, allowedEmails]);

    return {
        allowedEmails,
        addOwner,
        removeOwner,
        getStationCountByOwner,
        getStationsByOwner,
        getUnassignedStations,
    };
};
