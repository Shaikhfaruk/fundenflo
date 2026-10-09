import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { ApiClientActor, UserActor } from '../../../common/context/actor.js';
import { ApiClientStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { randomToken, safeEqual, sha256 } from '../../../infrastructure/crypto/secure-random.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { API_KEY_LAST_USED_RESOLUTION_MS, API_KEY_PATTERN, API_KEY_PREFIX, API_KEY_PREFIX_BYTES, API_KEY_SECRET_BYTES, type ApiScope } from '../domain/access.constants.js';
import { ApiClientRepository } from '../infrastructure/api-client.repository.js';
import { toApiClientView } from './access.views.js';

export type ApiClientInput = { name: string; scopes: ApiScope[]; leadSourceId?: string; expiresAt?: Date };

export type AuthenticatedApiClient = { actor: ApiClientActor; scopes: string[]; leadSourceId: string | null };

@Injectable()
export class ApiClientService {
  constructor(
    private readonly clients: ApiClientRepository,
    private readonly changes: ChangeRecorder,
  ) {}

  async list() {
    return (await this.clients.list()).map(toApiClientView);
  }

  @Transactional()
  async create(input: ApiClientInput, actor: UserActor) {
    const prefix = randomToken(API_KEY_PREFIX_BYTES);
    const key = `${API_KEY_PREFIX}_${prefix}.${randomToken(API_KEY_SECRET_BYTES)}`;
    const client = await this.clients.create({
      name: input.name,
      keyPrefix: prefix,
      keyHash: sha256(key),
      scopes: [...new Set(input.scopes)],
      leadSourceId: input.leadSourceId ?? null,
      expiresAt: input.expiresAt ?? null,
      createdByUserId: actor.userId,
    });
    await this.changes.record({
      action: AuditAction.ApiClientCreated,
      entityType: AuditEntity.ApiClient,
      entityId: client.id,
      event: EventName.ApiClientChanged,
      metadata: { name: client.name, scopes: client.scopes, leadSourceId: client.leadSourceId },
    });
    return { client: toApiClientView(client), key };
  }

  @Transactional()
  async revoke(id: string) {
    const client = await this.clients.findById(id);
    if (!client) throw new AppError(ErrorCode.NOT_FOUND);
    if (client.status === ApiClientStatus.revoked) return toApiClientView(client);
    const revoked = await this.clients.update(id, { status: ApiClientStatus.revoked, revokedAt: new Date() });
    await this.changes.record({ action: AuditAction.ApiClientRevoked, entityType: AuditEntity.ApiClient, entityId: id, event: EventName.ApiClientChanged, metadata: { name: client.name } });
    return toApiClientView(revoked);
  }

  async authenticate(rawKey: string | undefined): Promise<AuthenticatedApiClient> {
    const match = rawKey ? API_KEY_PATTERN.exec(rawKey.trim()) : null;
    const client = match?.[1] ? await this.clients.findByPrefix(match[1]) : null;
    const now = new Date();
    if (!client || !rawKey || !safeEqual(sha256(rawKey.trim()), client.keyHash) || client.status !== ApiClientStatus.active || (client.expiresAt && client.expiresAt <= now)) {
      throw new AppError(ErrorCode.API_KEY_INVALID);
    }
    if (!client.lastUsedAt || now.getTime() - client.lastUsedAt.getTime() > API_KEY_LAST_USED_RESOLUTION_MS) await this.clients.touch(client.id, now);
    return { actor: { type: 'api_client', apiClientId: client.id, name: client.name }, scopes: client.scopes, leadSourceId: client.leadSourceId };
  }
}
