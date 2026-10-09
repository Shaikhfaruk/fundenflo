import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { BODYLESS_METHODS, JSON_BODY_LIMIT_BYTES, JSON_CONTENT_TYPES } from '../constants/http.constants.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '../errors/error-codes.js';

@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  async use(request: Request, _response: Response, next: NextFunction) {
    if (BODYLESS_METHODS.has(request.method) || !request.is(JSON_CONTENT_TYPES)) return next();
    const encoding = request.header('content-encoding');
    if (encoding && encoding !== 'identity') throw new AppError(ErrorCode.BAD_REQUEST, { message: 'Compressed request bodies are not supported.' });
    const declared = Number(request.header('content-length') ?? 0);
    if (declared > JSON_BODY_LIMIT_BYTES) throw new AppError(ErrorCode.PAYLOAD_TOO_LARGE);

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
      size += buffer.length;
      if (size > JSON_BODY_LIMIT_BYTES) throw new AppError(ErrorCode.PAYLOAD_TOO_LARGE);
      chunks.push(buffer);
    }

    const text = Buffer.concat(chunks).toString('utf8');
    try {
      request.body = text.trim().length > 0 ? (JSON.parse(text) as unknown) : {};
    } catch {
      throw new AppError(ErrorCode.INVALID_JSON);
    }
    next();
  }
}
