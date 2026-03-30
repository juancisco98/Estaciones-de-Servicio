import * as XLSX from 'xlsx';
import { HaircutSession, Barber, Barbershop } from '../types';
import { PAYMENT_METHOD_LABELS } from '../constants';

export const exportSessionsToXlsx = (
  sessions: HaircutSession[],
  barbers: Barber[],
  barbershops: Barbershop[],
  filename = 'sesiones-rufianes'
) => {
  const rows = sessions.map(s => {
    const barber = barbers.find(b => b.id === s.barberId);
    const shop = barbershops.find(b => b.id === s.barbershopId);
    const date = new Date(s.startedAt);

    return {
      'Fecha': date.toLocaleDateString('es-AR'),
      'Hora': date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      'Barbería': shop?.name ?? '—',
      'Barbero': barber?.name ?? '—',
      'Cliente': s.clientName ?? 'Sin nombre',
      'Servicio': s.serviceName,
      'Precio': s.price,
      'Comisión': s.commissionAmt,
      'Método de pago': PAYMENT_METHOD_LABELS[s.paymentMethod],
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sesiones');
  XLSX.writeFile(wb, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
};
