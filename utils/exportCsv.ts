/**
 * CSV Export utility for Station-OS dashboard.
 * Generates a CSV file from an array of objects and triggers download.
 * Uses BOM for proper UTF-8 encoding in Excel (accents, ñ, etc.).
 */

interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

export function exportToCsv<T>(
  filename: string,
  columns: ExportColumn<T>[],
  data: T[],
): void {
  if (data.length === 0) return;

  const separator = ';';  // Excel in Argentina uses ; as separator (comma is decimal)
  const headers = columns.map(c => `"${c.header}"`).join(separator);
  const rows = data.map(row =>
    columns.map(col => {
      const val = col.value(row);
      if (typeof val === 'number') return String(val).replace('.', ',');  // Argentine decimal
      return `"${String(val).replace(/"/g, '""')}"`;  // Escape quotes
    }).join(separator)
  );

  const BOM = '\uFEFF';  // UTF-8 BOM for Excel
  const csv = BOM + headers + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
