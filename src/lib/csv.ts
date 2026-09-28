export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Excel/Sheets formula injection guard. */
export function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[";\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: readonly string[], rows: readonly CsvValue[][]): string {
  const lines = [headers.map(escapeCsvValue).join(';')];
  for (const row of rows) lines.push(row.map(escapeCsvValue).join(';'));
  // BOM keeps Cyrillic readable in Excel; CRLF is the RFC 4180 line ending.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** ISO string -> local `DD.MM.YYYY HH:mm` for the export and the admin table. */
export function formatDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(date);
  return parts;
}
