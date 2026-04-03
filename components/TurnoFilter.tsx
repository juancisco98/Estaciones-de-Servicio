import React from 'react';

export type Turno = 'MANANA' | 'TARDE' | 'NOCHE';

export const TURNO_LABELS: Record<Turno, string> = {
    MANANA: 'Mañana (6-14)',
    TARDE:  'Tarde (14-22)',
    NOCHE:  'Noche (22-6)',
};

/** Given an ISO timestamp, return which shift it belongs to. */
export const getTurnoFromTs = (ts: string): Turno => {
    const hour = new Date(ts).getHours();
    if (hour >= 6 && hour < 14) return 'MANANA';
    if (hour >= 14 && hour < 22) return 'TARDE';
    return 'NOCHE';
};

interface TurnoFilterProps {
    selected: Turno | null;
    onChange: (turno: Turno | null) => void;
    className?: string;
}

const TurnoFilter: React.FC<TurnoFilterProps> = ({ selected, onChange, className = '' }) => (
    <select
        value={selected ?? ''}
        onChange={e => onChange(e.target.value ? (e.target.value as Turno) : null)}
        className={`text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400 ${className}`}
    >
        <option value="">Todos los turnos</option>
        <option value="MANANA">Mañana (6-14hs)</option>
        <option value="TARDE">Tarde (14-22hs)</option>
        <option value="NOCHE">Noche (22-6hs)</option>
    </select>
);

export default TurnoFilter;
