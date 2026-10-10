export const safeFileName = (fileName: string, max = 120) => fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-max);

export const displayFileName = (fileName: string, fallback: string, max = 200) => (fileName.split(/[\\/]/).pop() ?? '').replace(/\p{Cc}+/gu, '').trim().slice(-max) || fallback;
