import * as XLSX from 'xlsx';
import { ShiftClosingMetadata } from '../types';

export const exportShiftClosingToXlsx = (meta: ShiftClosingMetadata): void => {
    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Resumen del turno ──
    const resumen = [
        ['CIERRE DE TURNO', ''],
        ['', ''],
        ['Barbería', meta.barbershopName],
        ['Barbero', meta.barberName],
        ['Fecha', meta.shiftDate],
        ['', ''],
        ['INGRESOS', ''],
        ['Total cortes', meta.totalCuts],
        ['Revenue total', meta.totalRevenue],
        ['', ''],
        ['DESGLOSE POR MÉTODO DE PAGO', ''],
        ['Efectivo', meta.totalCash],
        ['Tarjeta', meta.totalCard],
        ['Transferencia', meta.totalTransfer],
        ['', ''],
        ['COMISIONES Y GASTOS', ''],
        ['Comisión total', meta.totalCommission],
        ['Gastos en efectivo', meta.expensesCash],
        ['', ''],
        ['EFECTIVO A ENTREGAR AL DUEÑO', meta.netCashToHand],
    ];

    const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
    wsResumen['!cols'] = [{ wch: 32 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    // ── Hoja 2: Detalle de gastos ──
    if (meta.expensesDetail.length > 0) {
        const gastos = [
            ['GASTOS DEL TURNO', ''],
            ['Descripción', 'Monto'],
            ...meta.expensesDetail.map(e => [e.description, e.amount]),
            ['', ''],
            ['TOTAL', meta.expensesCash],
        ];
        const wsGastos = XLSX.utils.aoa_to_sheet(gastos);
        wsGastos['!cols'] = [{ wch: 32 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos');
    }

    const fileName = `cierre-${meta.barberName.toLowerCase().replace(/\s+/g, '-')}-${meta.shiftDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
};
