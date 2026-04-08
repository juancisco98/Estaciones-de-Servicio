import { useCallback } from 'react';
import { TankLevel, TankId } from '../types';
import { useDataContext } from '../context/DataContext';
import { TANK_WARNING_LITERS, TANK_CRITICAL_LITERS } from '../constants';

export const useTankLevels = () => {
    const { tankLevels } = useDataContext();

    const getLatestByStation = useCallback((stationId: string): Map<TankId, TankLevel> => {
        const map = new Map<TankId, TankLevel>();
        const stationTanks = tankLevels.filter(t => t.stationId === stationId);
        for (const t of stationTanks) {
            const existing = map.get(t.tankId);
            if (!existing || t.recordedAt > existing.recordedAt) {
                map.set(t.tankId, t);
            }
        }
        return map;
    }, [tankLevels]);

    const getTankHistory = useCallback((stationId: string, tankId: TankId): TankLevel[] =>
        tankLevels
            .filter(t => t.stationId === stationId && t.tankId === tankId)
            .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
    [tankLevels]);

    const getLowTanks = useCallback((stationId: string): TankLevel[] => {
        const latest = getLatestByStation(stationId);
        return [...latest.values()].filter(t => t.levelLiters < TANK_WARNING_LITERS);
    }, [getLatestByStation]);

    const getCriticalTanks = useCallback((stationId: string): TankLevel[] => {
        const latest = getLatestByStation(stationId);
        return [...latest.values()].filter(t => t.levelLiters < TANK_CRITICAL_LITERS);
    }, [getLatestByStation]);

    const getTankAlertLevel = useCallback((levelLiters: number): 'CRITICAL' | 'WARNING' | 'OK' => {
        if (levelLiters < TANK_CRITICAL_LITERS) return 'CRITICAL';
        if (levelLiters < TANK_WARNING_LITERS)  return 'WARNING';
        return 'OK';
    }, []);

    const getTotalStock = useCallback((stationId: string): number => {
        const latest = getLatestByStation(stationId);
        return [...latest.values()].reduce((sum, t) => sum + t.levelLiters, 0);
    }, [getLatestByStation]);

    return {
        tankLevels,
        getLatestByStation,
        getTankHistory,
        getLowTanks,
        getCriticalTanks,
        getTankAlertLevel,
        getTotalStock,
    };
};
