import { describe, it, expect } from 'vitest';
import { toCsv, escapeCsvValue, formatDateTime } from '@/lib/csv';

describe('csv', () => {
  it('escapes formula injection', () => {
    expect(escapeCsvValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(escapeCsvValue('+1')).toBe("'+1");
    expect(escapeCsvValue('-1')).toBe("'-1");
    expect(escapeCsvValue('@host')).toBe("'@host");
  });

  it('quotes fields with semicolons', () => {
    expect(escapeCsvValue('hello;world')).toBe('"hello;world"');
  });

  it('escapes quotes', () => {
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
  });

  it('handles newlines', () => {
    const result = escapeCsvValue('line1\nline2');
    expect(result).toContain('"');
  });

  it('generates valid csv', () => {
    const csv = toCsv(['Name', 'Score'], [['Alice', 95], ['Bob', 87]]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Score');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('95');
  });

  it('includes BOM for Excel', () => {
    const csv = toCsv([], []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('formatDateTime produces ru-RU locale', () => {
    const iso = '2026-09-27T12:34:56Z';
    const formatted = formatDateTime(iso);
    expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('handles invalid date', () => {
    expect(formatDateTime('invalid')).toBe('');
  });
});
