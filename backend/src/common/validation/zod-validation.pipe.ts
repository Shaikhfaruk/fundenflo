import { Body, Param, type PipeTransform, Query } from '@nestjs/common';
import type { z } from 'zod';

import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown, pathPrefix?: string): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new AppError(ErrorCode.VALIDATION_FAILED, {
    details: result.error.issues.map((issue) => ({
      path: [pathPrefix, ...issue.path.map(String)].filter((part) => part !== undefined && part !== '').join('.'),
      code: issue.code,
      message: issue.message,
    })),
  });
}

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    return parseOrThrow(this.schema, value);
  }
}

export const ValidBody = (schema: z.ZodType) => Body(new ZodValidationPipe(schema));

export const ValidQuery = (schema: z.ZodType) => Query(new ZodValidationPipe(schema));

export const ValidParam = (name: string, schema: z.ZodType) => Param(name, new ZodValidationPipe(schema));
