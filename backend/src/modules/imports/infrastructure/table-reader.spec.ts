import { Readable } from 'node:stream';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { ImportFormat } from '../domain/import.constants.js';
import { headerNames, readTable, type TableRow } from './table-reader.js';

const collect = async (stream: Readable, format: ImportFormat) => {
  const items: Array<TableRow | { headers: string[] }> = [];
  for await (const item of readTable(stream, format)) items.push(item);
  return items;
};

describe('readTable', () => {
  it('reads CSV with a BOM, quoted commas, blank lines and duplicate headers', async () => {
    const csv = '﻿Name,Mobile,City,City\n"Kumar, Ramesh",98765 43210,Gurgaon,\n\n,,,\nSunita Devi,9123456780,Pune,Maharashtra\n';
    const items = await collect(Readable.from([csv]), ImportFormat.Csv);
    expect(items[0]).toEqual({ headers: ['Name', 'Mobile', 'City', 'City (2)'] });
    expect(items.slice(1)).toEqual([
      { rowNumber: 2, values: { Name: 'Kumar, Ramesh', Mobile: '98765 43210', City: 'Gurgaon', 'City (2)': '' } },
      { rowNumber: 5, values: { Name: 'Sunita Devi', Mobile: '9123456780', City: 'Pune', 'City (2)': 'Maharashtra' } },
    ]);
  });

  it('reads the first XLSX sheet, turning numbers, dates and rich text into plain text', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Leads');
    sheet.addRow(['Name', 'Mobile', 'Enquired On', 'Loan Amount']);
    sheet.addRow([{ richText: [{ text: 'Farida ' }, { text: 'Khan' }] }, 9876543210, new Date(Date.UTC(2026, 7, 14)), 2_500_000]);
    sheet.addRow([]);
    sheet.addRow(['Meena Iyer', '+91 98200 12345', null, '20-25 lakh']);
    workbook.addWorksheet('Ignored').addRow(['not', 'read']);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const items = await collect(Readable.from([buffer]), ImportFormat.Xlsx);
    expect(items).toEqual([
      { headers: ['Name', 'Mobile', 'Enquired On', 'Loan Amount'] },
      { rowNumber: 2, values: { Name: 'Farida Khan', Mobile: '9876543210', 'Enquired On': '2026-08-14', 'Loan Amount': '2500000' } },
      { rowNumber: 4, values: { Name: 'Meena Iyer', Mobile: '+91 98200 12345', 'Enquired On': '', 'Loan Amount': '20-25 lakh' } },
    ]);
  });

  it('names blank headers by position', () => {
    expect(headerNames(['Name', '', ' Mobile '])).toEqual(['Name', 'Column 2', 'Mobile']);
  });
});
