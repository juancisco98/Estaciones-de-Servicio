import { useCallback } from 'react';
import { SalesTransaction } from '../types';
import { useDataContext } from '../context/DataContext';

export const useSalesTransactions = () => {
    const { salesTransactions } = useDataContext();

    const getByStation = useCallback((stationId: string): SalesTransaction[] =>
        salesTransactions.filter(t => t.stationId === stationId),
    [salesTransactions]);

    const getByDate = useCallback((stationId: string, date: string): SalesTransaction[] =>
        salesTransactions.filter(t => t.stationId === stationId && t.shiftDate === date),
    [salesTransactions]);

    const getByDateRange = useCallback((
        stationId: string,
        from: string,
        to: string,
    ): SalesTransaction[] =>
        salesTransactions.filter(t =>
            t.stationId === stationId &&
            t.shiftDate >= from &&
            t.shiftDate <= to
        ),
    [salesTransactions]);

    const getDailyRevenue = useCallback((stationId: string, date: string): number =>
        getByDate(stationId, date).reduce((sum, t) => sum + t.totalAmount, 0),
    [getByDate]);

    const getDailyFuelLiters = useCallback((stationId: string, date: string): number =>
        getByDate(stationId, date)
            .filter(t => Number(t.productCode) <= 20)
            .reduce((sum, t) => sum + t.quantity, 0),
    [getByDate]);

    const getAnomalies = useCallback((stationId: string): SalesTransaction[] =>
        salesTransactions.filter(t => t.stationId === stationId && t.quantity < 0),
    [salesTransactions]);

    const getProductBreakdown = useCallback((
        stationId: string,
        from: string,
        to: string,
    ): { productCode: string; productName: string; totalAmount: number; totalQuantity: number }[] => {
        const filtered = getByDateRange(stationId, from, to);
        const map = new Map<string, { productCode: string; productName: string; totalAmount: number; totalQuantity: number }>();
        for (const t of filtered) {
            const existing = map.get(t.productCode);
            if (existing) {
                existing.totalAmount   += t.totalAmount;
                existing.totalQuantity += t.quantity;
            } else {
                map.set(t.productCode, {
                    productCode:   t.productCode,
                    productName:   t.productName,
                    totalAmount:   t.totalAmount,
                    totalQuantity: t.quantity,
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [getByDateRange]);

    return {
        salesTransactions: salesTransactions,
        getByStation,
        getByDate,
        getByDateRange,
        getDailyRevenue,
        getDailyFuelLiters,
        getAnomalies,
        getProductBreakdown,
    };
};
