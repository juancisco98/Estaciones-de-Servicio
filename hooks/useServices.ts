import { useCallback } from 'react';
import { Service } from '../types';
import { useDataContext } from '../context/DataContext';
import { supabaseUpsert, supabaseUpdate } from '../utils/supabaseHelpers';
import { serviceToDb } from '../utils/mappers';

export const useServices = () => {
    const { services, setServices } = useDataContext();

    const saveService = useCallback(async (service: Service) => {
        const payload = serviceToDb(service);
        await supabaseUpsert('services', payload, 'service');
        setServices(prev => {
            const exists = prev.some(s => s.id === service.id);
            if (exists) return prev.map(s => s.id === service.id ? service : s);
            return [...prev, service];
        });
    }, [setServices]);

    const deactivateService = useCallback(async (id: string) => {
        await supabaseUpdate('services', id, { is_active: false }, 'service');
        setServices(prev => prev.map(s => s.id === id ? { ...s, isActive: false } : s));
    }, [setServices]);

    // Servicios disponibles para una barbería (globales + propios del local)
    const getServicesForShop = useCallback((barbershopId: string) => {
        return services.filter(s => s.isActive && (!s.barbershopId || s.barbershopId === barbershopId));
    }, [services]);

    return { services, saveService, deactivateService, getServicesForShop };
};
