import { useCallback } from 'react';
import { CardPayment, PaymentMethod } from '../types';
import { useDataContext } from '../context/DataContext';

export const useCardPayments = () => {
    const { cardPayments } = useDataContext();

    const getByStation = useCallback((stationId: string): CardPayment[] =>
        cardPayments.filter(p => p.stationId === stationId),
    [cardPayments]);

    const getByDateRange = useCallback((
        from: string,
        to: string,
        stationId?: string | null,
    ): CardPayment[] =>
        cardPayments.filter(p =>
            p.shiftDate &&
            p.shiftDate >= from &&
            p.shiftDate <= to &&
            (!stationId || p.stationId === stationId)
        ),
    [cardPayments]);

    const getByPaymentType = useCallback((type: PaymentMethod): CardPayment[] =>
        cardPayments.filter(p => p.paymentType === type),
    [cardPayments]);

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
        cardPayments: cardPayments,
        getByStation,
        getByDateRange,
        getByPaymentType,
        getPaymentTypeBreakdown,
    };
};
