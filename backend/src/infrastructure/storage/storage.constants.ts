export const STORAGE_UPLOAD_BUFFER_BYTES = 4 * 1024 * 1024;

export const STORAGE_UPLOAD_CONCURRENCY = 4;

export const STORAGE_BROWSER_CORS = { allowedMethods: 'GET,HEAD,PUT,OPTIONS', allowedHeaders: 'content-type,x-ms-blob-type,x-ms-version,x-ms-date', exposedHeaders: 'etag', maxAgeInSeconds: 3600 };
