import React from 'react';

export type Turno = 'MANANA' | 'TARDE' | 'NOCHE';

export const TURNO_LABELS: Record<Turno, string> = {
    MANANA: 'Mañana (6-14)',
    TARDE:  'Tarde (14-22)',
    NOCHE:  'Noche (22-6)',
};

/** Convert UTC timestamp to Argentina hour (UTC-3, no DST since 2009). */
const getArgHour = (ts: string): number => {
    const d = new Date(ts);
    return (d.getUTCHours() - 3 + 24) % 24;
};

/** Turno from a VE transaction timestamp (sale time = when it happened). */
export const getTurnoFromTs = (ts: string): Turno => {
    const h = getArgHour(ts);
    if (h >= 6 && h < 14) return 'MANANA';
    if (h >= 14 && h < 22) return 'TARDE';
    return 'NOCHE';
};

/** Turno from a closing file timestamp (P/S/C/T/A file mtime).
 *  The file is generated at the END of a shift (~14:03 = Mañana closing).
 *  Subtracts 30min to classify into the shift that just ended. */
export const getTurnoFromClosingTs = (ts: string): Turno => {
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() - 30);
    const h = (d.getUTCHours() - 3 + 24) % 24;
    if (h >= 6 && h < 14) return 'MANANA';
    if (h >= 14 && h < 22) return 'TARDE';
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
