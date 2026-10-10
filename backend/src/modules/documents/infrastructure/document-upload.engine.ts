import { createHash } from 'node:crypto';
import { PassThrough, type Readable, Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { uuidv7 } from '../../../common/ids/uuid-v7.js';
import { FILE_SIGNATURE_BYTES } from '../../../engines/documents/file-signature.js';
import type { ObjectStorage } from '../../../infrastructure/storage/storage.port.js';
import { DOCUMENT_STORAGE_CONTENT_TYPE, DOCUMENT_STORAGE_PREFIX } from '../domain/document.constants.js';

type IncomingFile = { fieldname: string; originalname: string; mimetype: string; stream: Readable };

export type StagedUpload = { originalname: string; mimetype: string; storageKey: string; sizeBytes: number; sha256: string; head: Buffer };

type HandleCallback = (error: Error | null, info?: Omit<StagedUpload, 'originalname' | 'mimetype'>) => void;

class UploadMeter extends Transform {
  readonly hash = createHash('sha256');
  sizeBytes = 0;
  private readonly headChunks: Buffer[] = [];
  private headBytes = 0;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    this.hash.update(chunk);
    this.sizeBytes += chunk.length;
    if (this.headBytes < FILE_SIGNATURE_BYTES) {
      const part = chunk.subarray(0, FILE_SIGNATURE_BYTES - this.headBytes);
      this.headChunks.push(part);
      this.headBytes += part.length;
    }
    callback(null, chunk);
  }

  head() {
    return Buffer.concat(this.headChunks);
  }
}

export class DocumentUploadEngine {
  constructor(private readonly storage: ObjectStorage) {}

  _handleFile(_request: unknown, file: IncomingFile, callback: HandleCallback) {
    const storageKey = `${DOCUMENT_STORAGE_PREFIX}/${uuidv7()}`;
    const meter = new UploadMeter();
    const body = new PassThrough();
    Promise.all([pipeline(file.stream, meter, body), this.storage.put({ key: storageKey, body, contentType: DOCUMENT_STORAGE_CONTENT_TYPE })])
      .then(() => callback(null, { storageKey, sizeBytes: meter.sizeBytes, sha256: meter.hash.digest('hex'), head: meter.head() }))
      .catch((error: unknown) => {
        void this.storage.delete(storageKey).catch(() => undefined);
        callback(error instanceof Error ? error : new Error(String(error)));
      });
  }

  _removeFile(_request: unknown, file: Partial<StagedUpload>, callback: (error: Error | null) => void) {
    if (!file.storageKey) {
      callback(null);
      return;
    }
    this.storage.delete(file.storageKey).then(
      () => callback(null),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
    );
  }
}
