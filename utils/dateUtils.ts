/**
 * Returns today's date in YYYY-MM-DD format using Argentina timezone.
 * Always uses America/Buenos_Aires regardless of the user's browser timezone.
 */
export const getArgentinaToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' });
