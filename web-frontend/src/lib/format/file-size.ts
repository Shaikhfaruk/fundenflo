import { BYTES_PER_KB, BYTES_PER_MB } from '@/lib/constants/document.constants';

export const formatFileSize = (bytes: number) => (bytes >= BYTES_PER_MB ? `${(bytes / BYTES_PER_MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`);

export const formatSizeLimit = (bytes: number) => `${Math.round(bytes / BYTES_PER_MB)} MB`;
