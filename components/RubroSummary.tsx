import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { RubroSale } from '../types';

interface RubroSummaryProps {
    rubros: RubroSale[];
    accentColor: 'amber' | 'violet';
    label: string;
}

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

interface RubroGroup {
    rubroId: string;
    names: string[];
    totalQty: number;
    totalAmount: number;
}

const RubroSummary: React.FC<RubroSummaryProps> = ({ rubros, accentColor, label }) => {
    const [isOpen, setIsOpen] = useState(true);

    const groups = useMemo(() => {
        const map = new Map<string, RubroGroup>();
        for (const r of rubros) {
            const existing = map.get(r.rubroId);
            if (existing) {
                existing.totalQty += r.quantity;
                existing.totalAmount += r.amount;
                if (!existing.names.includes(r.rubroName)) {
                    existing.names.push(r.rubroName);
                }
            } else {
                map.set(r.rubroId, {
                    rubroId: r.rubroId,
                    names: [r.rubroName],
                    totalQty: r.quantity,
                    totalAmount: r.amount,
                });
            }
        }
        return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
    }, [rubros]);

    const grandTotal = groups.reduce((s, g) => s + g.totalAmount, 0);

    if (rubros.length === 0) return null;

    const accent = accentColor === 'amber'
        ? { bg: 'bg-amber-50 dark:bg-amber-500/10', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/20', text: 'text-amber-700 dark:text-amber-400' }
        : { bg: 'bg-violet-50 dark:bg-violet-500/10', badge: 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-500/20', text: 'text-violet-700 dark:text-violet-400' };

    return (
        <div className={`rounded-xl border ${accent.border} ${accent.bg} overflow-hidden`}>
            <button
                className="w-full px-5 py-3 flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Tag className={`w-4 h-4 ${accent.text}`} />
                <span className={`text-sm font-bold ${accent.text}`}>{label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${accent.badge} ml-1`}>
                    {groups.length} rubros | {fmt(grandTotal)}
                </span>
                <span className="ml-auto">
                    {isOpen
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </span>
            </button>

            {isOpen && (
                <div className="px-5 pb-4 space-y-1.5">
                    {groups.map(g => (
                        <div key={g.rubroId} className="flex items-center text-xs px-3 py-2 rounded-lg bg-white/70 dark:bg-slate-800/50">
                            <span className={`shrink-0 w-8 text-center font-bold text-[10px] px-1.5 py-0.5 rounded ${accent.badge}`}>
                                {g.rubroId}
                            </span>
                            <div className="flex-1 min-w-0 ml-3">
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {g.names.join(', ')}
                                </span>
                            </div>
                            <span className="text-gray-400 dark:text-slate-500 text-[10px] mx-3 shrink-0">
                                {g.totalQty} uds
                            </span>
                            <span className="font-bold text-gray-900 dark:text-white w-28 text-right shrink-0">
                                {fmt(g.totalAmount)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RubroSummary;
