import { Readable } from 'node:stream';
import { DefaultAzureCredential } from '@azure/identity';
import {
  BlobSASPermissions,
  BlobServiceClient,
  type ContainerClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { InjectConfig } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { STORAGE_UPLOAD_BUFFER_BYTES, STORAGE_UPLOAD_CONCURRENCY } from './storage.constants.js';
import type { ObjectStat, ObjectStorage, PutObjectInput, ReadUrlOptions, UploadUrlOptions } from './storage.port.js';
import { MINUTE_MS } from '../../common/constants/time.constants.js';

@Injectable()
export class AzureBlobStorage implements ObjectStorage, OnModuleInit {
  private readonly service: BlobServiceClient;
  private readonly container: ContainerClient;

  constructor(@InjectConfig() private readonly config: AppConfig) {
    this.service = config.STORAGE_CONNECTION_STRING
      ? BlobServiceClient.fromConnectionString(config.STORAGE_CONNECTION_STRING)
      : new BlobServiceClient(config.STORAGE_ACCOUNT_URL as string, new DefaultAzureCredential());
    this.container = this.service.getContainerClient(config.STORAGE_CONTAINER);
  }

  async onModuleInit() {
    if (this.config.NODE_ENV !== 'production') await this.container.createIfNotExists();
  }

  async put(input: PutObjectInput): Promise<void> {
    const blob = this.container.getBlockBlobClient(input.key);
    const options = { blobHTTPHeaders: { blobContentType: input.contentType }, metadata: input.metadata };
    if (Buffer.isBuffer(input.body)) {
      await blob.uploadData(input.body, options);
      return;
    }
    await blob.uploadStream(input.body, STORAGE_UPLOAD_BUFFER_BYTES, STORAGE_UPLOAD_CONCURRENCY, options);
  }

  async read(key: string): Promise<Readable> {
    const response = await this.container.getBlobClient(key).download();
    const body = response.readableStreamBody;
    if (!body) throw new Error(`Blob ${key} has no body`);
    return body instanceof Readable ? body : Readable.from(body);
  }

  async delete(key: string): Promise<void> {
    await this.container.getBlobClient(key).deleteIfExists();
  }

  async exists(key: string): Promise<boolean> {
    return this.container.getBlobClient(key).exists();
  }

  async createReadUrl(key: string, options: ReadUrlOptions): Promise<string> {
    const contentDisposition = options.downloadName ? `attachment; filename="${options.downloadName.replace(/"/g, '')}"` : undefined;
    return this.sasUrl(key, 'r', options.ttlSeconds, { contentDisposition, contentType: options.contentType });
  }

  async createUploadUrl(key: string, options: UploadUrlOptions): Promise<string> {
    return this.sasUrl(key, 'cw', options.ttlSeconds, { contentType: options.contentType });
  }

  async stat(key: string): Promise<ObjectStat | null> {
    const blob = this.container.getBlobClient(key);
    if (!(await blob.exists())) return null;
    const properties = await blob.getProperties();
    return { sizeBytes: properties.contentLength ?? 0, contentType: properties.contentType ?? null };
  }

  private async sasUrl(key: string, permission: string, ttlSeconds: number, headers: { contentDisposition?: string; contentType?: string }): Promise<string> {
    const blob = this.container.getBlobClient(key);
    const startsOn = new Date(Date.now() - MINUTE_MS);
    const expiresOn = new Date(Date.now() + ttlSeconds * 1000);
    const permissions = BlobSASPermissions.parse(permission);

    if (blob.credential instanceof StorageSharedKeyCredential) {
      return blob.generateSasUrl({ permissions, startsOn, expiresOn, ...headers });
    }

    const delegationKey = await this.service.getUserDelegationKey(startsOn, expiresOn);
    const sas = generateBlobSASQueryParameters(
      { containerName: this.container.containerName, blobName: key, permissions, startsOn, expiresOn, ...headers },
      delegationKey,
      this.service.accountName,
    );
    return `${blob.url}?${sas.toString()}`;
  }
}
