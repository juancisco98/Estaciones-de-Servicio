import { useMemo } from 'react';
import { useDataContext } from '../context/DataContext';

export const useRubroSales = () => {
    const { rubroSales } = useDataContext();

    const playaRubros = useMemo(
        () => rubroSales.filter(r => r.sourceType === 'RP'),
        [rubroSales],
    );

    const salonRubros = useMemo(
        () => rubroSales.filter(r => r.sourceType === 'RS'),
        [rubroSales],
    );

    return { rubroSales, playaRubros, salonRubros };
};
