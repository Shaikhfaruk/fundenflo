import { Inject } from '@nestjs/common';
import type { Readable } from 'node:stream';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export const InjectObjectStorage = () => Inject(OBJECT_STORAGE);

export type PutObjectInput = {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  metadata?: Record<string, string>;
};

export type ReadUrlOptions = {
  ttlSeconds: number;
  downloadName?: string;
  contentType?: string;
};

export type UploadUrlOptions = {
  ttlSeconds: number;
  contentType: string;
};

export type ObjectStat = { sizeBytes: number; contentType: string | null };

export interface ObjectStorage {
  put(input: PutObjectInput): Promise<void>;
  read(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  createReadUrl(key: string, options: ReadUrlOptions): Promise<string>;
  createUploadUrl(key: string, options: UploadUrlOptions): Promise<string>;
  stat(key: string): Promise<ObjectStat | null>;
}
