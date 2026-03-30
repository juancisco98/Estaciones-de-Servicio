import React, { useState, useMemo } from 'react';
import { X, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_LABEL_COLOR: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue:    'text-blue-600 dark:text-blue-400',
  violet:  'text-violet-600 dark:text-violet-400',
};
import { ShiftClosing, HaircutSession, ShiftExpense } from '../types';
import { PAYMENT_METHOD_LABELS } from '../constants';

interface ShiftClosingModalProps {
  closing: ShiftClosing;
  todaySessions: HaircutSession[];
  onClose: (closing: ShiftClosing) => Promise<void>;
  onDismiss: () => void;
}

const ShiftClosingModal: React.FC<ShiftClosingModalProps> = ({ closing, todaySessions, onClose, onDismiss }) => {
  // Pre-calcular totales desde sesiones
  const computed = useMemo(() => {
    const cash = todaySessions.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.price, 0);
    const card = todaySessions.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.price, 0);
    const transfer = todaySessions.filter(s => s.paymentMethod === 'TRANSFER').reduce((sum, s) => sum + s.price, 0);
    const commission = todaySessions.reduce((sum, s) => sum + s.commissionAmt, 0);
    return { cash, card, transfer, total: cash + card + transfer, commission };
  }, [todaySessions]);

  const [totalCash, setTotalCash] = useState(String(computed.cash));
  const [totalCard, setTotalCard] = useState(String(computed.card));
  const [totalTransfer, setTotalTransfer] = useState(String(computed.transfer));
  const [expenses, setExpenses] = useState<ShiftExpense[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const cashNum = Number(totalCash) || 0;
  const cardNum = Number(totalCard) || 0;
  const transferNum = Number(totalTransfer) || 0;
  const totalRevenue = cashNum + cardNum + transferNum;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netCashToHand = cashNum - totalExpenses;

  const addExpense = () => setExpenses(prev => [...prev, { description: '', amount: 0 }]);
  const removeExpense = (idx: number) => setExpenses(prev => prev.filter((_, i) => i !== idx));
  const updateExpense = (idx: number, field: 'description' | 'amount', value: string) => {
    setExpenses(prev => prev.map((e, i) => i === idx ? { ...e, [field]: field === 'amount' ? Number(value) : value } : e));
  };

  const handleClose = async () => {
    const closedClosing: ShiftClosing = {
      ...closing,
      totalCuts: todaySessions.length,
      totalCash: cashNum,
      totalCard: cardNum,
      totalTransfer: transferNum,
      totalRevenue,
      totalCommission: computed.commission,
      expensesCash: totalExpenses,
      expensesDetail: expenses.filter(e => e.description.trim()),
      netCashToHand,
      notes: notes.trim() || undefined,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await onClose(closedClosing);
      toast.success(`Turno cerrado — ${todaySessions.length} cortes · $${totalRevenue.toLocaleString('es-AR')}`);
      onDismiss();
    } catch (error: any) {
      toast.error(`Error al cerrar turno: ${error?.message ?? 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Cierre de Turno</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">{closing.shiftDate} · {todaySessions.length} cortes registrados</p>
            </div>
          </div>
          <button onClick={onDismiss} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Sesiones del día */}
          {todaySessions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3">Cortes del turno</h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {todaySessions.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between text-xs px-3 py-2 bg-gray-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-gray-600 dark:text-slate-300 font-medium">
                      {idx + 1}. {s.clientName ?? 'Sin nombre'} — {s.serviceName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-slate-500">{PAYMENT_METHOD_LABELS[s.paymentMethod]}</span>
                      <span className="font-bold text-gray-900 dark:text-white">${s.price.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totales por método de pago */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-3">Totales por método de pago</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Efectivo', value: totalCash, setter: setTotalCash, color: 'emerald' },
                { label: 'Tarjeta', value: totalCard, setter: setTotalCard, color: 'blue' },
                { label: 'Transfer.', value: totalTransfer, setter: setTotalTransfer, color: 'violet' },
              ].map(({ label, value, setter, color }) => (
                <div key={label}>
                  <label className={`text-xs font-semibold ${PAYMENT_LABEL_COLOR[color]} mb-1 block`}>{label}</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={value}
                    onChange={e => setter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Gastos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">Gastos del turno</h3>
              <button
                type="button"
                onClick={addExpense}
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {expenses.map((exp, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Descripción"
                    value={exp.description}
                    onChange={e => updateExpense(idx, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="number"
                    placeholder="$0"
                    min="0"
                    value={exp.amount || ''}
                    onChange={e => updateExpense(idx, 'amount', e.target.value)}
                    className="w-24 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button onClick={() => removeExpense(idx)} className="p-2 text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {expenses.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">Sin gastos registrados</p>
              )}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Notas del turno</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones del turno..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none text-sm"
            />
          </div>

          {/* Balance de caja */}
          <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-white/10">
            <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 border-b border-gray-100 dark:border-white/10">
              <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Balance de caja</p>
            </div>
            <div className="bg-white dark:bg-slate-800/30 px-4 py-3 space-y-2">
              {/* Ingresos por método */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-slate-400">Efectivo recibido</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">${cashNum.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-slate-400">Tarjeta recibida</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">${cardNum.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-slate-400">Transferencias</span>
                <span className="font-bold text-violet-600 dark:text-violet-400">${transferNum.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 dark:border-white/10 pt-2">
                <span className="font-semibold text-gray-700 dark:text-slate-300">Revenue total</span>
                <span className="font-bold text-gray-900 dark:text-white">${totalRevenue.toLocaleString('es-AR')}</span>
              </div>

              {/* Egresos */}
              <div className="flex justify-between text-sm border-t border-gray-100 dark:border-white/10 pt-2">
                <span className="text-gray-500 dark:text-slate-400">
                  Tu comisión ({Math.round(computed.commission / (totalRevenue || 1) * 100)}%)
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">${computed.commission.toLocaleString('es-AR')}</span>
              </div>
              {totalExpenses > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Gastos del turno</span>
                  <span className="font-bold text-red-500 dark:text-red-400">-${totalExpenses.toLocaleString('es-AR')}</span>
                </div>
              )}

              {/* Resultado */}
              <div className="border-t border-gray-200 dark:border-white/10 pt-3 mt-1">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Efectivo a entregar</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">Efectivo − Gastos</p>
                  </div>
                  <span className={`text-xl font-black ${netCashToHand >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                    ${netCashToHand.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t dark:border-white/10 shrink-0">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Cerrar turno
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftClosingModal;
