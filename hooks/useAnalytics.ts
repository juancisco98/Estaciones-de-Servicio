import { useCallback } from 'react';
import { BarberDayMetrics, BarbershopFinancials, BarbershopMetrics, NetworkFinancialSummary, PeriodSummary } from '../types';
import { useDataContext } from '../context/DataContext';

export const useAnalytics = () => {
    const { sessions, shiftClosings, barbershops, barbers } = useDataContext();

    const today = new Date().toISOString().slice(0, 10);

    // Métricas por barbería para un período
    const getRevenueByBarbershop = useCallback((dateFrom?: string, dateTo?: string): BarbershopMetrics[] => {
        return barbershops.map(shop => {
            const shopSessions = sessions.filter(s => {
                if (s.barbershopId !== shop.id) return false;
                if (dateFrom && s.startedAt.slice(0, 10) < dateFrom) return false;
                if (dateTo && s.startedAt.slice(0, 10) > dateTo) return false;
                return true;
            });

            const activeBarbers = new Set(shopSessions.map(s => s.barberId)).size;
            const totalRevenue = shopSessions.reduce((sum, s) => sum + s.price, 0);
            const totalCommission = shopSessions.reduce((sum, s) => sum + s.commissionAmt, 0);

            // Barbero top por revenue
            const revenueByBarber = shopSessions.reduce<Record<string, number>>((acc, s) => {
                acc[s.barberId] = (acc[s.barberId] ?? 0) + s.price;
                return acc;
            }, {});
            const topBarberId = Object.entries(revenueByBarber).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0];
            const topBarberName = barbers.find(b => b.id === topBarberId)?.name;

            // Días únicos con actividad
            const activeDays = new Set(shopSessions.map(s => s.startedAt.slice(0, 10))).size;
            const avgCutsPerDay = activeDays > 0 ? Math.round(shopSessions.length / activeDays) : 0;

            return {
                barbershopId: shop.id,
                barbershopName: shop.name,
                totalCuts: shopSessions.length,
                totalRevenue,
                totalCommission,
                activeBarbers,
                avgCutsPerDay,
                topBarberId,
                topBarberName,
            };
        });
    }, [sessions, barbershops, barbers]);

    // Métricas por barbero, día a día
    const getRevenueByBarber = useCallback((barbershopId: string, dateFrom?: string, dateTo?: string): BarberDayMetrics[] => {
        const relevantBarbers = barbers.filter(b => b.barbershopId === barbershopId);
        const result: BarberDayMetrics[] = [];

        for (const barber of relevantBarbers) {
            const barberSessions = sessions.filter(s => {
                if (s.barberId !== barber.id) return false;
                if (dateFrom && s.startedAt.slice(0, 10) < dateFrom) return false;
                if (dateTo && s.startedAt.slice(0, 10) > dateTo) return false;
                return true;
            });

            if (barberSessions.length === 0) continue;

            const totalRevenue = barberSessions.reduce((sum, s) => sum + s.price, 0);
            const totalCommission = barberSessions.reduce((sum, s) => sum + s.commissionAmt, 0);
            const durations = barberSessions.filter(s => s.durationMins).map(s => s.durationMins!);
            const avgDurationMins = durations.length > 0
                ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                : undefined;

            result.push({
                barberId: barber.id,
                barberName: barber.name,
                date: today,
                totalCuts: barberSessions.length,
                totalRevenue,
                totalCommission,
                avgDurationMins,
                avgPricePerCut: barberSessions.length > 0 ? Math.round(totalRevenue / barberSessions.length) : 0,
                cashRevenue: barberSessions.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.price, 0),
                cardRevenue: barberSessions.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.price, 0),
                transferRevenue: barberSessions.filter(s => s.paymentMethod === 'TRANSFER').reduce((sum, s) => sum + s.price, 0),
            });
        }

        return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [sessions, barbers, today]);

    // Top barberos por revenue en el período
    const getTopBarbers = useCallback((dateFrom?: string, dateTo?: string, limit = 5) => {
        const revenueMap = sessions.reduce<Record<string, { revenue: number; cuts: number; name: string }>>((acc, s) => {
            if (dateFrom && s.startedAt.slice(0, 10) < dateFrom) return acc;
            if (dateTo && s.startedAt.slice(0, 10) > dateTo) return acc;
            const barberName = barbers.find(b => b.id === s.barberId)?.name ?? 'Desconocido';
            if (!acc[s.barberId]) acc[s.barberId] = { revenue: 0, cuts: 0, name: barberName };
            acc[s.barberId].revenue += s.price;
            acc[s.barberId].cuts += 1;
            return acc;
        }, {});

        return (Object.entries(revenueMap) as [string, { revenue: number; cuts: number; name: string }][])
            .map(([id, data]) => ({ barberId: id, revenue: data.revenue, cuts: data.cuts, name: data.name }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, limit);
    }, [sessions, barbers]);

    // Resumen del día para una barbería (usado en el mapa)
    const getDailySummary = useCallback((barbershopId: string, date?: string): { cuts: number; revenue: number; activeBarbers: number } => {
        const targetDate = date ?? today;
        const daySessions = sessions.filter(s =>
            s.barbershopId === barbershopId &&
            s.startedAt.slice(0, 10) === targetDate
        );
        return {
            cuts: daySessions.length,
            revenue: daySessions.reduce((sum, s) => sum + s.price, 0),
            activeBarbers: new Set(daySessions.map(s => s.barberId)).size,
        };
    }, [sessions, today]);

    // Resumen de período para toda la red
    const getPeriodSummary = useCallback((dateFrom?: string, dateTo?: string): PeriodSummary => {
        const filtered = sessions.filter(s => {
            if (dateFrom && s.startedAt.slice(0, 10) < dateFrom) return false;
            if (dateTo && s.startedAt.slice(0, 10) > dateTo) return false;
            return true;
        });

        const activeDays = new Set(filtered.map(s => s.startedAt.slice(0, 10))).size;
        const revenueByBarber = filtered.reduce<Record<string, number>>((acc, s) => {
            acc[s.barberId] = (acc[s.barberId] ?? 0) + s.price;
            return acc;
        }, {});
        const topBarberId = Object.entries(revenueByBarber).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0];

        const totalRevenue = filtered.reduce((sum, s) => sum + s.price, 0);

        return {
            totalCuts: filtered.length,
            totalRevenue,
            totalCommission: filtered.reduce((sum, s) => sum + s.commissionAmt, 0),
            totalCash: filtered.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.price, 0),
            totalCard: filtered.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.price, 0),
            totalTransfer: filtered.filter(s => s.paymentMethod === 'TRANSFER').reduce((sum, s) => sum + s.price, 0),
            avgCutsPerDay: activeDays > 0 ? Math.round(filtered.length / activeDays) : 0,
            avgRevenuePerCut: filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0,
            topBarberId,
        };
    }, [sessions]);

    // Finanzas por barbería: ingresos, egresos (comisiones + gastos) y ganancia neta del dueño
    const getFinancialsByBarbershop = useCallback(
        (dateFrom?: string, dateTo?: string): BarbershopFinancials[] => {
            return barbershops
                .filter(shop => shop.isActive)
                .map(shop => {
                    const shopSessions = sessions.filter(s => {
                        if (s.barbershopId !== shop.id) return false;
                        const d = s.startedAt.slice(0, 10);
                        if (dateFrom && d < dateFrom) return false;
                        if (dateTo && d > dateTo) return false;
                        return true;
                    });

                    const shopClosings = shiftClosings.filter(sc => {
                        if (sc.barbershopId !== shop.id || sc.status !== 'CLOSED') return false;
                        if (dateFrom && sc.shiftDate < dateFrom) return false;
                        if (dateTo && sc.shiftDate > dateTo) return false;
                        return true;
                    });

                    const totalRevenue     = shopSessions.reduce((sum, s) => sum + s.price, 0);
                    const totalCommissions = shopSessions.reduce((sum, s) => sum + s.commissionAmt, 0);
                    const totalExpenses    = shopClosings.reduce((sum, sc) => sum + (sc.expensesCash ?? 0), 0);
                    const expensesDetail   = shopClosings.flatMap(sc => sc.expensesDetail ?? []);

                    const shopBarbers = barbers.filter(b => b.barbershopId === shop.id);
                    const barberBreakdown = shopBarbers.map(b => {
                        const bs = shopSessions.filter(s => s.barberId === b.id);
                        const barberClosings = shopClosings.filter(sc => sc.barberId === b.id);
                        return {
                            barberId: b.id,
                            barberName: b.name,
                            cuts: bs.length,
                            revenue: bs.reduce((sum, s) => sum + s.price, 0),
                            commission: bs.reduce((sum, s) => sum + s.commissionAmt, 0),
                            shifts: barberClosings.map(sc => ({
                                shiftDate: sc.shiftDate,
                                startedAt: sc.startedAt,
                                closedAt: sc.closedAt,
                            })),
                        };
                    }).sort((a, b) => b.revenue - a.revenue);

                    return {
                        barbershopId: shop.id,
                        barbershopName: shop.name,
                        totalShifts: shopClosings.length,
                        totalCuts: shopSessions.length,
                        totalRevenue,
                        totalCommissions,
                        totalExpenses,
                        netOwnerRevenue: totalRevenue - totalCommissions - totalExpenses,
                        barberBreakdown,
                        expensesDetail,
                    };
                });
        },
        [sessions, shiftClosings, barbershops, barbers]
    );

    // Totales de toda la red para el período
    const getNetworkFinancials = useCallback(
        (dateFrom?: string, dateTo?: string): NetworkFinancialSummary => {
            const all = getFinancialsByBarbershop(dateFrom, dateTo);
            return {
                totalRevenue:     all.reduce((s, f) => s + f.totalRevenue, 0),
                totalCommissions: all.reduce((s, f) => s + f.totalCommissions, 0),
                totalExpenses:    all.reduce((s, f) => s + f.totalExpenses, 0),
                netOwnerRevenue:  all.reduce((s, f) => s + f.netOwnerRevenue, 0),
                totalCuts:        all.reduce((s, f) => s + f.totalCuts, 0),
                totalShifts:      all.reduce((s, f) => s + f.totalShifts, 0),
            };
        },
        [getFinancialsByBarbershop]
    );

    return {
        getRevenueByBarbershop,
        getRevenueByBarber,
        getTopBarbers,
        getDailySummary,
        getPeriodSummary,
        getFinancialsByBarbershop,
        getNetworkFinancials,
    };
};
