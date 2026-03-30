import React, { useState, useMemo } from 'react';
import { Search, Trash2, Filter, Download } from 'lucide-react';
import { toast } from 'sonner';
import { HaircutSession, Barber, Barbershop, User } from '../types';
import { PAYMENT_METHOD_LABELS, MONTH_NAMES } from '../constants';
import { exportSessionsToXlsx } from '../utils/exportSessions';

interface SessionHistoryViewProps {
  sessions: HaircutSession[];
  barbers: Barber[];
  barbershops: Barbershop[];
  onUpdateSession: (session: HaircutSession) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  currentUser: User | null;
}

const SessionHistoryView: React.FC<SessionHistoryViewProps> = ({
  sessions, barbers, barbershops, onDeleteSession, currentUser,
}) => {
  const [filterShopId, setFilterShopId] = useState('');
  const [filterBarberId, setFilterBarberId] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (filterShopId && s.barbershopId !== filterShopId) return false;
      if (filterBarberId && s.barberId !== filterBarberId) return false;
      if (filterPayment && s.paymentMethod !== filterPayment) return false;
      if (filterDate && s.startedAt.slice(0, 10) !== filterDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const barberName = barbers.find(b => b.id === s.barberId)?.name ?? '';
        if (!s.clientName?.toLowerCase().includes(q) &&
            !s.serviceName.toLowerCase().includes(q) &&
            !barberName.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [sessions, filterShopId, filterBarberId, filterPayment, filterDate, searchQuery, barbers]);

  const totalRevenue = filteredSessions.reduce((sum, s) => sum + s.price, 0);
  const totalCommission = filteredSessions.reduce((sum, s) => sum + s.commissionAmt, 0);

  const handleDelete = async (session: HaircutSession) => {
    if (session.shiftClosingId) {
      toast.error('No se puede eliminar: esta sesión ya fue cerrada en un turno.');
      return;
    }
    if (!confirm(`¿Eliminar corte de ${session.clientName ?? 'sin nombre'}? Esta acción no se puede deshacer.`)) return;
    try {
      await onDeleteSession(session.id);
      toast.success('Sesión eliminada');
    } catch (error: any) {
      toast.error(`Error: ${error?.message ?? 'Error desconocido'}`);
    }
  };

  const canDelete = (session: HaircutSession) => {
    if (currentUser?.role === 'ADMIN') return !session.shiftClosingId;
    if (currentUser?.role === 'BARBER') return session.barberId === currentUser.barberId && !session.shiftClosingId;
    return false;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900 shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Historial de Sesiones</h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{filteredSessions.length} sesiones</p>
              <p className="text-xs text-gray-400">${totalRevenue.toLocaleString('es-AR')} revenue</p>
            </div>
            {filteredSessions.length > 0 && (
              <button
                onClick={() => {
                  exportSessionsToXlsx(filteredSessions, barbers, barbershops);
                  toast.success('Exportado correctamente');
                }}
                className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
                title="Exportar a Excel"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, servicio o barbero..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <select
            value={filterShopId}
            onChange={e => setFilterShopId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:outline-none shrink-0"
          >
            <option value="">Todas las barberías</option>
            {barbershops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={filterBarberId}
            onChange={e => setFilterBarberId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:outline-none shrink-0"
          >
            <option value="">Todos los barberos</option>
            {barbers.filter(b => b.isActive).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            value={filterPayment}
            onChange={e => setFilterPayment(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:outline-none shrink-0"
          >
            <option value="">Todos los métodos</option>
            <option value="CASH">Efectivo</option>
            <option value="CARD">Tarjeta</option>
            <option value="TRANSFER">Transferencia</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-xs text-gray-900 dark:text-white focus:outline-none shrink-0"
          />
          {(filterShopId || filterBarberId || filterPayment || filterDate || searchQuery) && (
            <button
              onClick={() => { setFilterShopId(''); setFilterBarberId(''); setFilterPayment(''); setFilterDate(''); setSearchQuery(''); }}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin resultados</p>
            <p className="text-sm mt-1">Ajustá los filtros para encontrar sesiones</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map(session => {
              const barber = barbers.find(b => b.id === session.barberId);
              const shop = barbershops.find(s => s.id === session.barbershopId);
              const dateObj = new Date(session.startedAt);
              const dateStr = `${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]}`;
              const timeStr = dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={session.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl px-5 py-4 border border-gray-100 dark:border-white/10">
                  {/* Fecha */}
                  <div className="text-center shrink-0 w-14">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{dateStr}</p>
                    <p className="text-[10px] text-gray-400">{timeStr}</p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {session.clientName ?? <span className="text-gray-400">Sin nombre</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {session.serviceName} · {barber?.name ?? '—'} · {shop?.name ?? '—'}
                    </p>
                  </div>

                  {/* Método pago */}
                  <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold ${
                    session.paymentMethod === 'CASH' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                    session.paymentMethod === 'CARD' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                    'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400'
                  }`}>
                    {PAYMENT_METHOD_LABELS[session.paymentMethod]}
                  </span>

                  {/* Precio */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900 dark:text-white">${session.price.toLocaleString('es-AR')}</p>
                    <p className="text-[10px] text-amber-500">+${session.commissionAmt.toLocaleString('es-AR')}</p>
                  </div>

                  {/* Eliminar */}
                  {canDelete(session) && (
                    <button
                      onClick={() => handleDelete(session)}
                      className="p-2 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionHistoryView;
