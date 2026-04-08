
export const getArgentinaToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' });

export const getArgentinaDaysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' });
};
