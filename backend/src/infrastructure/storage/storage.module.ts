import { Global, Module } from '@nestjs/common';

import { AzureBlobStorage } from './azure-blob.storage.js';
import { OBJECT_STORAGE } from './storage.port.js';

@Global()
@Module({
  providers: [AzureBlobStorage, { provide: OBJECT_STORAGE, useExisting: AzureBlobStorage }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
