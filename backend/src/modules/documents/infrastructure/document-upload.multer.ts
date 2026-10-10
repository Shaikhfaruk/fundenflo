import { MulterModule } from '@nestjs/platform-express';

import { OBJECT_STORAGE, type ObjectStorage } from '../../../infrastructure/storage/storage.port.js';
import { DOCUMENT_UPLOAD_LIMITS } from '../domain/document.constants.js';
import { DocumentUploadEngine } from './document-upload.engine.js';

export const DocumentUploadMulterModule = MulterModule.registerAsync({ inject: [OBJECT_STORAGE], useFactory: (storage: ObjectStorage) => ({ storage: new DocumentUploadEngine(storage), limits: DOCUMENT_UPLOAD_LIMITS }) });
