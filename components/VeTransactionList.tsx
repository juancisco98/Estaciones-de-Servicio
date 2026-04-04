import React from 'react';
import { SalesTransaction } from '../types';
import { PAYMENT_METHOD_LABELS } from '../constants';

interface VeTransactionListProps {
    transactions: SalesTransaction[];
    title?: string;
}

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

const VeTransactionList: React.FC<VeTransactionListProps> = ({ transactions, title }) => {
    if (transactions.length === 0) return null;

    const total = transactions.reduce((s, t) => s + t.totalAmount, 0);

    return (
        <div className="border-t border-gray-100 dark:border-white/5 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {title ?? 'DETALLE DE VENTAS (VE)'}
                </span>
                <span className="text-xs text-gray-400 ml-auto">{transactions.length} ventas | {fmt(total)}</span>
            </div>
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {transactions.map((t, i) => {
                    const hora = new Date(t.transactionTs).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                    const payLabel = PAYMENT_METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod;
                    return (
                        <div key={t.id ?? i} className="flex items-center text-[11px] px-2 py-1 rounded bg-gray-50 dark:bg-slate-800/40 gap-2">
                            <span className="text-gray-400 w-10 shrink-0">{hora}</span>
                            <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{t.productName}</span>
                            <span className="text-gray-400 w-12 text-right">{t.quantity.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</span>
                            <span className="font-bold text-gray-900 dark:text-white w-20 text-right">{fmt(t.totalAmount)}</span>
                            <span className="text-gray-400 w-20 text-right truncate">{payLabel}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VeTransactionList;
