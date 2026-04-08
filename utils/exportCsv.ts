

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

  const separator = ';';
  const headers = columns.map(c => `"${c.header}"`).join(separator);
  const rows = data.map(row =>
    columns.map(col => {
      const val = col.value(row);
      if (typeof val === 'number') return String(val).replace('.', ',');
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(separator)
  );

  const BOM = '\uFEFF';
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
