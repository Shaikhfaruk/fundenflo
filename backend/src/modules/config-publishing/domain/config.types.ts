import type { z } from 'zod';

import type { ConfigResource } from '../../../common/enums/db.enums.js';

export type ConfigIssue = { path: string; code: string; message: string };

export type CompileResult<TCompiled> = { compiled: TCompiled | null; issues: ConfigIssue[] };

export type PublishedConfig<TCompiled> = {
  documentId: string;
  key: string;
  versionId: string;
  number: number;
  effectiveFrom: Date;
  compiled: TCompiled;
};

export type CompileContext = { documentKey: string };

export interface ConfigResourceHandler<TContent = unknown, TCompiled = unknown> {
  readonly resource: ConfigResource;
  readonly contentSchema: z.ZodType<TContent>;
  compile(content: TContent, context: CompileContext): Promise<CompileResult<TCompiled>>;
  onPublished?(config: PublishedConfig<TCompiled>): Promise<void>;
}
