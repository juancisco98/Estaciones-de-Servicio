import React from 'react';
import { MapPin } from 'lucide-react';
import { Station } from '../types';

interface StationFilterProps {
    stations: Station[];
    selectedStationId: string | null;
    onChange: (stationId: string | null) => void;
    className?: string;
}

const StationFilter: React.FC<StationFilterProps> = ({
    stations,
    selectedStationId,
    onChange,
    className = '',
}) => {
    const activeStations = stations.filter(s => s.isActive);

    return (
        <div className={`relative ${className}`}>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
            <select
                value={selectedStationId ?? ''}
                onChange={e => onChange(e.target.value || null)}
                className="w-full pl-9 pr-4 py-2.5 min-h-[44px] text-sm rounded-xl
                           bg-gray-50 dark:bg-slate-800
                           border border-gray-200 dark:border-slate-700
                           text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400
                           appearance-none cursor-pointer"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '16px',
                }}
            >
                <option value="">Todas las estaciones</option>
                {activeStations.map(s => (
                    <option key={s.id} value={s.id}>
                        {s.name}{s.stationCode ? ` (${s.stationCode})` : ''}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default StationFilter;
