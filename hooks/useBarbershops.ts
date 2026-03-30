import { useCallback } from 'react';
import { Barbershop } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabaseUpsert, supabaseUpdate } from '../utils/supabaseHelpers';
import { barbershopToDb } from '../utils/mappers';

export const useBarbershops = () => {
    const { barbershops, setBarbershops } = useDataContext();

    const saveBarbershop = useCallback(async (shop: Barbershop) => {
        const payload = barbershopToDb(shop);
        await supabaseUpsert('barbershops', payload, 'barbershop');
        setBarbershops(prev => {
            const exists = prev.some(b => b.id === shop.id);
            if (exists) return prev.map(b => b.id === shop.id ? shop : b);
            return [...prev, shop];
        });
    }, [setBarbershops]);

    // Soft delete: nunca se borran barberías, solo se desactivan
    const deactivateBarbershop = useCallback(async (id: string) => {
        await supabaseUpdate('barbershops', id, { is_active: false }, 'barbershop');
        setBarbershops(prev => prev.map(b => b.id === id ? { ...b, isActive: false } : b));
    }, [setBarbershops]);

    return { barbershops, saveBarbershop, deactivateBarbershop };
};
