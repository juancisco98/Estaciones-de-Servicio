import { useState, useEffect, useCallback } from 'react';
import { OwnerPreferences } from '../types';
import { supabase } from '../services/supabaseClient';
import { dbToOwnerPreferences, ownerPreferencesToDb } from '../utils/mappers';
import { generateUUID } from '../utils/generateUUID';
import { toast } from 'sonner';

const DEFAULTS: Omit<OwnerPreferences, 'id' | 'ownerEmail'> = {
    notifyTankLow: true,
    notifyTankCritical: true,
    notifyNegativeValue: true,
    notifyReconciliation: true,
    tankWarningLiters: 800,
    tankCriticalLiters: 300,
    shiftMorningStart: 6,
    shiftAfternoonStart: 14,
    shiftNightStart: 22,
};

export const useOwnerPreferences = (ownerEmail: string | undefined) => {
    const [preferences, setPreferences] = useState<OwnerPreferences | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load preferences
    useEffect(() => {
        if (!ownerEmail) { setIsLoading(false); return; }

        const load = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('owner_preferences')
                .select('*')
                .eq('owner_email', ownerEmail)
                .is('station_id', null)
                .limit(1)
                .maybeSingle();

            if (data) {
                setPreferences(dbToOwnerPreferences(data));
            } else {
                // Create default preferences for this owner
                const newPrefs: OwnerPreferences = {
                    id: generateUUID(),
                    ownerEmail,
                    ...DEFAULTS,
                };
                const { error: insertErr } = await supabase
                    .from('owner_preferences')
                    .insert(ownerPreferencesToDb(newPrefs));
                if (!insertErr) setPreferences(newPrefs);
            }
            setIsLoading(false);
        };
        load();
    }, [ownerEmail]);

    // Save preferences
    const savePreferences = useCallback(async (updated: Partial<OwnerPreferences>) => {
        if (!preferences) return;
        const merged = { ...preferences, ...updated, updatedAt: new Date().toISOString() };
        setPreferences(merged);

        const { error } = await supabase
            .from('owner_preferences')
            .update(ownerPreferencesToDb(merged))
            .eq('id', merged.id);

        if (error) {
            console.error('Error saving preferences:', error);
            toast.error('Error al guardar preferencias');
        } else {
            toast.success('Preferencias guardadas');
        }
    }, [preferences]);

    return { preferences, isLoading, savePreferences };
};
