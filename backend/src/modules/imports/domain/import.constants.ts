export const IMPORT_HANDLER_METADATA = 'imports:handler';

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export const MAX_XLSX_BYTES = 20 * 1024 * 1024;

export const MAX_IMPORT_ROWS = 200_000;

export const MAX_IMPORT_COLUMNS = 100;

export const IMPORT_SAMPLE_ROWS = 5;

export const IMPORT_ROW_CHUNK = 500;

export const IMPORT_UPLOAD_URL_TTL_SECONDS = 900;

export const IMPORT_CELL_MAX_LENGTH = 1_000;

export const ImportFormat = {
  Csv: 'csv',
  Xlsx: 'xlsx',
} as const;

export type ImportFormat = (typeof ImportFormat)[keyof typeof ImportFormat];

export const IMPORT_CONTENT_TYPES: Record<ImportFormat, string> = {
  [ImportFormat.Csv]: 'text/csv',
  [ImportFormat.Xlsx]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const ImportJob = {
  Validate: 'validate',
  Commit: 'commit',
  Undo: 'undo',
} as const;

export type ImportJob = (typeof ImportJob)[keyof typeof ImportJob];

export const ImportWarning = {
  DuplicateInFile: 'duplicate_in_file',
  ExistingPerson: 'existing_person',
} as const;

export type ImportWarning = (typeof ImportWarning)[keyof typeof ImportWarning];
