import React from 'react';

interface TurnoFilterProps {
    turnos: number[];
    selected: number | null;
    onChange: (turno: number | null) => void;
    className?: string;
}

const TurnoFilter: React.FC<TurnoFilterProps> = ({ turnos, selected, onChange, className = '' }) => {
    const sorted = turnos.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);

    return (
        <select
            value={selected ?? ''}
            onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
            className={`text-sm rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent text-gray-800 dark:text-white px-4 py-2.5 min-h-[44px] focus:outline-none focus:border-amber-400 ${className}`}
        >
            <option value="">Todos los turnos</option>
            {sorted.map(t => (
                <option key={t} value={t}>Turno {t}</option>
            ))}
        </select>
    );
};

export default TurnoFilter;
