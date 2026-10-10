export const FileMimeType = {
  Pdf: 'application/pdf',
  Jpeg: 'image/jpeg',
  Png: 'image/png',
  Heic: 'image/heic',
  Csv: 'text/csv',
  Xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

export type FileMimeType = (typeof FileMimeType)[keyof typeof FileMimeType];

export const FILE_MIME_TYPES = [FileMimeType.Pdf, FileMimeType.Jpeg, FileMimeType.Png, FileMimeType.Heic, FileMimeType.Csv, FileMimeType.Xlsx] as const;

export const FILE_SIGNATURE_BYTES = 4096;

export type SniffHint = { fileName?: string; declared?: string };

const PDF_MARKER = Buffer.from('%PDF-', 'latin1');

const PDF_MARKER_WINDOW = 1024;

const JPEG = [0xff, 0xd8, 0xff];

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ZIP = [0x50, 0x4b, 0x03, 0x04];

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif']);

const CSV_SEPARATORS = /[,;\t\n]/;

const startsWith = (head: Uint8Array, bytes: number[]) => bytes.every((byte, index) => head[index] === byte);

const extensionOf = (fileName?: string) => fileName?.toLowerCase().split('.').pop() ?? '';

const claims = (hint: SniffHint, mime: FileMimeType, extensions: string[]) => hint.declared?.toLowerCase() === mime || extensions.includes(extensionOf(hint.fileName));

const isHeic = (head: Uint8Array) => head.length >= 12 && Buffer.from(head.subarray(4, 8)).toString('latin1') === 'ftyp' && HEIC_BRANDS.has(Buffer.from(head.subarray(8, 12)).toString('latin1'));

function isText(head: Uint8Array) {
  if (head.includes(0)) return false;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let trim = 0; trim <= 3 && trim < head.length; trim += 1) {
    try {
      return CSV_SEPARATORS.test(decoder.decode(head.subarray(0, head.length - trim)));
    } catch {
      continue;
    }
  }
  return false;
}

export function sniffMimeType(head: Uint8Array, hint: SniffHint = {}): FileMimeType | null {
  if (head.length === 0) return null;
  if (Buffer.from(head.subarray(0, PDF_MARKER_WINDOW)).includes(PDF_MARKER)) return FileMimeType.Pdf;
  if (startsWith(head, JPEG)) return FileMimeType.Jpeg;
  if (startsWith(head, PNG)) return FileMimeType.Png;
  if (isHeic(head)) return FileMimeType.Heic;
  if (startsWith(head, ZIP)) return claims(hint, FileMimeType.Xlsx, ['xlsx']) ? FileMimeType.Xlsx : null;
  if (claims(hint, FileMimeType.Csv, ['csv']) && isText(head)) return FileMimeType.Csv;
  return null;
}
