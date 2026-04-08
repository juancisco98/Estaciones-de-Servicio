import { toast } from 'sonner';
import { logger } from './logger';

export const handleError = (error: unknown, userMessage?: string) => {
    logger.error('[AppError]', error);

    const message = userMessage || 'Ha ocurrido un error inesperado. Por favor intente nuevamente.';
    toast.error(message);
};
