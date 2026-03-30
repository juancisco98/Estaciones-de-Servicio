import { useCallback } from 'react';
import { Alert, AlertLevel, AlertType } from '../types';
import { useDataContext } from '../context/DataContext';

export const useAlerts = () => {
    const { alerts, resolveAlert } = useDataContext();

    const getByStation = useCallback((stationId: string): Alert[] =>
        alerts.filter(a => a.stationId === stationId),
    [alerts]);

    const getByLevel = useCallback((level: AlertLevel): Alert[] =>
        alerts.filter(a => a.level === level && !a.resolved),
    [alerts]);

    const getByType = useCallback((type: AlertType): Alert[] =>
        alerts.filter(a => a.type === type && !a.resolved),
    [alerts]);

    const getUnresolved = useCallback((stationId?: string): Alert[] => {
        const unresolved = alerts.filter(a => !a.resolved);
        return stationId ? unresolved.filter(a => a.stationId === stationId) : unresolved;
    }, [alerts]);

    /** Returns the highest alert level for a station ('CRITICAL' > 'WARNING' > 'INFO' > null). */
    const getStationAlertLevel = useCallback((stationId: string): AlertLevel | null => {
        const stationAlerts = alerts.filter(a => a.stationId === stationId && !a.resolved);
        if (stationAlerts.some(a => a.level === 'CRITICAL')) return 'CRITICAL';
        if (stationAlerts.some(a => a.level === 'WARNING'))  return 'WARNING';
        if (stationAlerts.length > 0)                        return 'INFO';
        return null;
    }, [alerts]);

    /** Map of station_id → AlertLevel for MapBoard marker coloring. */
    const getStationAlertMap = useCallback((): Map<string, AlertLevel> => {
        const map = new Map<string, AlertLevel>();
        for (const alert of alerts) {
            if (alert.resolved || !alert.stationId) continue;
            const current = map.get(alert.stationId);
            if (!current ||
                (alert.level === 'CRITICAL') ||
                (alert.level === 'WARNING' && current === 'INFO')
            ) {
                map.set(alert.stationId, alert.level);
            }
        }
        return map;
    }, [alerts]);

    return {
        alerts,
        getByStation,
        getByLevel,
        getByType,
        getUnresolved,
        getStationAlertLevel,
        getStationAlertMap,
        resolveAlert,
    };
};
