import type { Readable } from 'node:stream';

import { parse } from 'csv-parse';
import ExcelJS from 'exceljs';

import { IMPORT_CELL_MAX_LENGTH, ImportFormat, MAX_IMPORT_COLUMNS } from '../domain/import.constants.js';

export type TableRow = { rowNumber: number; values: Record<string, string> };

type CellValue = ExcelJS.CellValue;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function cellText(value: CellValue | undefined): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return isoDate(value);
  if (typeof value === 'number') return Number.isInteger(value) ? value.toFixed(0) : String(value);
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('result' in value) return cellText(value.result);
  if ('error' in value) return '';
  return '';
}

export function headerNames(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.slice(0, MAX_IMPORT_COLUMNS).map((cell, index) => {
    const base = cell.trim() || `Column ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

const toRecord = (headers: string[], cells: string[]) =>
  Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? '').trim().slice(0, IMPORT_CELL_MAX_LENGTH)]));

const isBlank = (cells: string[]) => cells.every((cell) => cell.trim() === '');

async function* csvRows(stream: Readable): AsyncGenerator<{ rowNumber: number; cells: string[] }> {
  const parser = stream.pipe(parse({ bom: true, relax_column_count: true, relax_quotes: true, skip_empty_lines: false }));
  let rowNumber = 0;
  for await (const record of parser as AsyncIterable<string[]>) {
    rowNumber += 1;
    yield { rowNumber, cells: record };
  }
}

async function* xlsxRows(stream: Readable): AsyncGenerator<{ rowNumber: number; cells: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.read(stream);
  const [worksheet] = workbook.worksheets;
  if (!worksheet) return;
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const values = worksheet.getRow(rowNumber).values;
    yield { rowNumber, cells: (Array.isArray(values) ? values.slice(1) : []).map((value) => cellText(value)) };
  }
}

export async function* readTable(stream: Readable, format: ImportFormat): AsyncGenerator<TableRow | { headers: string[] }> {
  let headers: string[] | null = null;
  for await (const { rowNumber, cells } of format === ImportFormat.Csv ? csvRows(stream) : xlsxRows(stream)) {
    if (isBlank(cells)) continue;
    if (!headers) {
      headers = headerNames(cells);
      yield { headers };
      continue;
    }
    yield { rowNumber, values: toRecord(headers, cells) };
  }
}
