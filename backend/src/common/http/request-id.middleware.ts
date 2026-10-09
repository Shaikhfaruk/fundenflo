import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { HttpHeader, REQUEST_ID_PATTERN } from '../constants/http.constants.js';
import './request.types.js';

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction) {
  const incoming = request.header(HttpHeader.RequestId);
  request.id = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  response.setHeader(HttpHeader.RequestId, request.id);
  next();
}
