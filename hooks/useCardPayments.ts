import { useCallback, useMemo } from 'react';
import { CardPayment, PaymentMethod } from '../types';
import { useDataContext } from '../context/DataContext';

export const useCardPayments = () => {
    const { cardPayments, dailyClosings } = useDataContext();

    // Only show payments for shifts that have a daily_closing (P/S files arrived)
    const closedShiftKeys = useMemo(() => {
        const keys = new Set<string>();
        for (const c of dailyClosings) {
            keys.add(`${c.stationId}::${c.shiftDate}`);
        }
        return keys;
    }, [dailyClosings]);

    const closedCardPayments = useMemo(() =>
        cardPayments.filter(p => p.shiftDate && closedShiftKeys.has(`${p.stationId}::${p.shiftDate}`)),
    [cardPayments, closedShiftKeys]);

    /** All payments for a given station. */
    const getByStation = useCallback((stationId: string): CardPayment[] =>
        closedCardPayments.filter(p => p.stationId === stationId),
    [closedCardPayments]);

    /** Payments for a date range (inclusive). */
    const getByDateRange = useCallback((
        from: string,
        to: string,
        stationId?: string | null,
    ): CardPayment[] =>
        closedCardPayments.filter(p =>
            p.shiftDate &&
            p.shiftDate >= from &&
            p.shiftDate <= to &&
            (!stationId || p.stationId === stationId)
        ),
    [closedCardPayments]);

    /** Filter by payment type. */
    const getByPaymentType = useCallback((type: PaymentMethod): CardPayment[] =>
        closedCardPayments.filter(p => p.paymentType === type),
    [closedCardPayments]);

    /** Group by payment type for a date range. */
    const getPaymentTypeBreakdown = useCallback((
        from: string,
        to: string,
        stationId?: string | null,
    ): { type: PaymentMethod; total: number; count: number }[] => {
        const filtered = getByDateRange(from, to, stationId);
        const map = new Map<string, { type: PaymentMethod; total: number; count: number }>();
        for (const p of filtered) {
            const existing = map.get(p.paymentType);
            if (existing) {
                existing.total += p.amount;
                existing.count += 1;
            } else {
                map.set(p.paymentType, {
                    type: p.paymentType,
                    total: p.amount,
                    count: 1,
                });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [getByDateRange]);

    return {
        cardPayments: closedCardPayments,
        getByStation,
        getByDateRange,
        getByPaymentType,
        getPaymentTypeBreakdown,
    };
};
