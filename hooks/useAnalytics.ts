import { useCallback } from 'react';
import { StationMetrics, StationDayMetrics, NetworkSummary, PeriodSummary } from '../types';
import { useDataContext } from '../context/DataContext';
import { useSalesTransactions } from './useSalesTransactions';
import { useCardPayments } from './useCardPayments';
import { useTankLevels } from './useTankLevels';
import { useDailyClosings } from './useDailyClosings';

export const useAnalytics = () => {
    const { stations } = useDataContext();
    const { getByDateRange, getProductBreakdown } = useSalesTransactions();
    const { getByDateRange: getCardPaymentsByDateRange } = useCardPayments();
    const { getTotalStock, getLowTanks } = useTankLevels();
    const { getLatestPerStation, discrepancyCount, pendingCount } = useDailyClosings();

    const getStationMetrics = useCallback((
        stationId: string,
        dateFrom: string,
        dateTo: string,
    ): StationMetrics => {
        const transactions = getByDateRange(stationId, dateFrom, dateTo);

        const totalRevenue   = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
        const fuelLiters     = transactions
            .filter(t => Number(t.productCode) <= 20)
            .reduce((sum, t) => sum + t.quantity, 0);

        const cpForStation   = getCardPaymentsByDateRange(dateFrom, dateTo, stationId);
        const cardRevenue    = cpForStation.filter(p => p.paymentType === 'CARD').reduce((sum, p) => sum + p.amount, 0);
        const accountRevenue = cpForStation.filter(p => p.paymentType === 'ACCOUNT').reduce((sum, p) => sum + p.amount, 0);
        const digitalRevenue = cpForStation.filter(p => ['MERCADOPAGO', 'MODO'].includes(p.paymentType)).reduce((sum, p) => sum + p.amount, 0);
        const cashRevenue    = Math.max(0, totalRevenue - cardRevenue - accountRevenue - digitalRevenue);

        const activeDays = new Set(transactions.map(t => t.shiftDate)).size;

        const productBreakdown = getProductBreakdown(stationId, dateFrom, dateTo);
        const topProduct = productBreakdown[0];

        const currentStockLiters = getTotalStock(stationId);
        const lowTankCount       = getLowTanks(stationId).length;

        const latestClosingMap = getLatestPerStation();
        const latestClosing    = latestClosingMap.get(stationId);

        return {
            stationId,
            totalTransactions: transactions.length,
            totalRevenue,
            fuelLiters,
            cashRevenue,
            cardRevenue,
            accountRevenue,
            digitalRevenue,
            activeDays,
            avgRevenuePerDay: activeDays > 0 ? Math.round(totalRevenue / activeDays) : 0,
            avgTransactionsPerDay: activeDays > 0 ? Math.round(transactions.length / activeDays) : 0,
            topProductCode: topProduct?.productCode,
            topProductName: topProduct?.productName,
            currentStockLiters,
            lowTankCount,
            lastClosingStatus: latestClosing?.status,
            lastClosingDate:   latestClosing?.shiftDate,
        };
    }, [getByDateRange, getCardPaymentsByDateRange, getProductBreakdown, getTotalStock, getLowTanks, getLatestPerStation]);

    const getDailyTimeSeries = useCallback((
        stationId: string,
        dateFrom: string,
        dateTo: string,
    ): StationDayMetrics[] => {
        const transactions = getByDateRange(stationId, dateFrom, dateTo);
        const cpForStation = getCardPaymentsByDateRange(dateFrom, dateTo, stationId);

        const byDay = new Map<string, typeof transactions>();
        for (const t of transactions) {
            const existing = byDay.get(t.shiftDate) ?? [];
            existing.push(t);
            byDay.set(t.shiftDate, existing);
        }

        const cpByDay = new Map<string, typeof cpForStation>();
        for (const p of cpForStation) {
            if (!p.shiftDate) continue;
            const existing = cpByDay.get(p.shiftDate) ?? [];
            existing.push(p);
            cpByDay.set(p.shiftDate, existing);
        }

        const allDates = new Set([...byDay.keys(), ...cpByDay.keys()]);

        return Array.from(allDates)
            .map(date => {
                const dayTx = byDay.get(date) ?? [];
                const dayCp = cpByDay.get(date) ?? [];
                const totalRevenue = dayTx.reduce((sum, t) => sum + t.totalAmount, 0);
                const cardRev      = dayCp.filter(p => p.paymentType === 'CARD').reduce((sum, p) => sum + p.amount, 0);
                const accountRev   = dayCp.filter(p => p.paymentType === 'ACCOUNT').reduce((sum, p) => sum + p.amount, 0);
                return {
                    date,
                    stationId,
                    totalRevenue,
                    fuelLiters:      dayTx.filter(t => Number(t.productCode) <= 20).reduce((sum, t) => sum + t.quantity, 0),
                    transactionCount: dayTx.length,
                    cashRevenue:     Math.max(0, totalRevenue - cardRev - accountRev),
                    cardRevenue:     cardRev,
                    accountRevenue:  accountRev,
                };
            })
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [getByDateRange, getCardPaymentsByDateRange]);

    const getNetworkSummary = useCallback((
        dateFrom: string,
        dateTo: string,
    ): NetworkSummary => {
        const allMetrics = stations
            .filter(s => s.isActive)
            .map(s => getStationMetrics(s.id, dateFrom, dateTo));

        const totalRevenue      = allMetrics.reduce((sum, m) => sum + m.totalRevenue, 0);
        const totalFuelLiters   = allMetrics.reduce((sum, m) => sum + m.fuelLiters, 0);
        const totalTransactions = allMetrics.reduce((sum, m) => sum + m.totalTransactions, 0);
        const totalCash         = allMetrics.reduce((sum, m) => sum + m.cashRevenue, 0);
        const totalCard         = allMetrics.reduce((sum, m) => sum + m.cardRevenue, 0);
        const totalAccount      = allMetrics.reduce((sum, m) => sum + m.accountRevenue, 0);
        const totalDigital      = allMetrics.reduce((sum, m) => sum + m.digitalRevenue, 0);

        const criticalStations  = allMetrics.filter(m => m.lowTankCount > 0).length;
        const warningStations   = 0;
        const activeStations    = allMetrics.filter(m => m.totalTransactions > 0).length;

        const topStation = allMetrics.sort((a, b) => b.totalRevenue - a.totalRevenue)[0];

        return {
            totalRevenue,
            totalFuelLiters,
            totalTransactions,
            totalCash,
            totalCard,
            totalAccount,
            totalDigital,
            activeStations,
            criticalStations,
            warningStations,
            discrepancyCount,
            pendingCount,
            topStationId:      topStation?.stationId,
            avgRevenuePerStation: stations.length > 0 ? Math.round(totalRevenue / stations.length) : 0,
        };
    }, [stations, getStationMetrics, discrepancyCount, pendingCount]);

    const getPeriodSummary = useCallback((
        stationId: string,
        dateFrom: string,
        dateTo: string,
    ): PeriodSummary => {
        const transactions = getByDateRange(stationId, dateFrom, dateTo);
        const totalRevenue = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
        const activeDays   = new Set(transactions.map(t => t.shiftDate)).size;

        return {
            totalTransactions:    transactions.length,
            totalRevenue,
            totalFuelLiters:      transactions.filter(t => Number(t.productCode) <= 20).reduce((sum, t) => sum + t.quantity, 0),
            avgRevenuePerDay:     activeDays > 0 ? Math.round(totalRevenue / activeDays) : 0,
            avgTransactionsPerDay: activeDays > 0 ? Math.round(transactions.length / activeDays) : 0,
            activeDays,
        };
    }, [getByDateRange]);

    return {
        getStationMetrics,
        getDailyTimeSeries,
        getNetworkSummary,
        getPeriodSummary,
    };
};
