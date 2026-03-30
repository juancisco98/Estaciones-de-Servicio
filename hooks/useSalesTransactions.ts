import { useCallback } from 'react';
import { SalesTransaction } from '../types';
import { useDataContext } from '../context/DataContext';

export const useSalesTransactions = () => {
    const { salesTransactions } = useDataContext();

    /** All transactions for a given station, newest first. */
    const getByStation = useCallback((stationId: string): SalesTransaction[] =>
        salesTransactions.filter(t => t.stationId === stationId),
    [salesTransactions]);

    /** Transactions for a specific date (YYYY-MM-DD). */
    const getByDate = useCallback((stationId: string, date: string): SalesTransaction[] =>
        salesTransactions.filter(t => t.stationId === stationId && t.shiftDate === date),
    [salesTransactions]);

    /** Transactions for a date range (inclusive). */
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

    /** Sum of total_amount for a station on a given date. */
    const getDailyRevenue = useCallback((stationId: string, date: string): number =>
        getByDate(stationId, date).reduce((sum, t) => sum + t.totalAmount, 0),
    [getByDate]);

    /** Sum of quantity (liters) for FUEL products on a given date. */
    const getDailyFuelLiters = useCallback((stationId: string, date: string): number =>
        getByDate(stationId, date)
            .filter(t => Number(t.productCode) <= 20) // fuel products have low codes
            .reduce((sum, t) => sum + t.quantity, 0),
    [getByDate]);

    /** Detect anomalous transactions (negative quantity). */
    const getAnomalies = useCallback((stationId: string): SalesTransaction[] =>
        salesTransactions.filter(t => t.stationId === stationId && t.quantity < 0),
    [salesTransactions]);

    /** Group by product for a date range — used in analytics. */
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
        salesTransactions,
        getByStation,
        getByDate,
        getByDateRange,
        getDailyRevenue,
        getDailyFuelLiters,
        getAnomalies,
        getProductBreakdown,
    };
};
