import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { PDF_TEXT_MAX_CHARS } from './extraction.constants.js';

export type PdfTextResult = { kind: 'text'; text: string; pages: number } | { kind: 'password_required' } | { kind: 'wrong_password' };

const PASSWORD_ERROR = 'PasswordException';
const NEED_PASSWORD = 1;

type TextItem = { str?: string; hasEOL?: boolean };

export async function readPdfText(bytes: Uint8Array, password: string | null): Promise<PdfTextResult> {
  const task = getDocument({ data: bytes.slice(), password: password ?? undefined, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  try {
    const document = await task.promise;
    const parts: string[] = [];
    let length = 0;
    for (let number = 1; number <= document.numPages && length < PDF_TEXT_MAX_CHARS; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = (content.items as TextItem[]).map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`).join('');
      parts.push(`--- Page ${number} ---\n${text}`);
      length += text.length;
    }
    const pages = document.numPages;
    await task.destroy();
    return { kind: 'text', text: parts.join('\n').slice(0, PDF_TEXT_MAX_CHARS), pages };
  } catch (error) {
    await task.destroy();
    if (error instanceof Error && error.name === PASSWORD_ERROR) return (error as Error & { code?: number }).code === NEED_PASSWORD && !password ? { kind: 'password_required' } : { kind: 'wrong_password' };
    throw error;
  }
}

export async function isEncryptedPdf(bytes: Uint8Array): Promise<boolean> {
  const result = await readPdfText(bytes, null).catch(() => null);
  return result?.kind === 'password_required';
}
