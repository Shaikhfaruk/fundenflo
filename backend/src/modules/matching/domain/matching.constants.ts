import { DocumentStage } from '../../documents/domain/document.constants.js';

export const MATCH_DOCUMENT_STAGES = [DocumentStage.Assessment, DocumentStage.Submission] as const;
