import { useCallback } from 'react';
import { toast } from 'sonner';
import { Employee, EmployeeRole } from '../types';
import { useDataContext } from '../context/DataContext';
import { employeeToDb } from '../utils/mappers';
import { supabaseUpsert } from '../utils/supabaseHelpers';
import { generateUUID } from '../utils/generateUUID';

export const useEmployees = () => {
    const { employees, setEmployees } = useDataContext();

    const saveEmployee = useCallback(async (
        data: Partial<Employee> & { stationId: string; name: string; role: EmployeeRole }
    ): Promise<boolean> => {
        try {
            const isNew = !data.id;
            const emp: Employee = {
                id:        data.id ?? generateUUID(),
                stationId: data.stationId,
                name:      data.name,
                email:     data.email,
                role:      data.role,
                isActive:  data.isActive ?? true,
                hireDate:  data.hireDate,
                notes:     data.notes,
            };
            await supabaseUpsert('employees', employeeToDb(emp), 'empleado');
            setEmployees(prev =>
                isNew
                    ? [...prev, emp].sort((a, b) => a.name.localeCompare(b.name))
                    : prev.map(e => e.id === emp.id ? emp : e)
            );
            toast.success(isNew ? 'Empleado registrado' : 'Empleado actualizado');
            return true;
        } catch {
            return false;
        }
    }, [setEmployees]);

    const deactivateEmployee = useCallback(async (id: string): Promise<boolean> => {
        try {
            await supabaseUpsert('employees', { id, is_active: false }, 'empleado');
            setEmployees(prev => prev.map(e => e.id === id ? { ...e, isActive: false } : e));
            toast.success('Empleado desactivado');
            return true;
        } catch {
            return false;
        }
    }, [setEmployees]);

    const getEmployeesByStation = useCallback((stationId: string) =>
        employees.filter(e => e.stationId === stationId && e.isActive),
    [employees]);

    return { employees, saveEmployee, deactivateEmployee, getEmployeesByStation };
};
