/**
 * Returns today's date in YYYY-MM-DD format using Argentina timezone.
 * Always uses America/Buenos_Aires regardless of the user's browser timezone.
 */
export const getArgentinaToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' });

/**
 * Returns a date N days before today in YYYY-MM-DD format using Argentina timezone.
 */
export const getArgentinaDaysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' });
};
