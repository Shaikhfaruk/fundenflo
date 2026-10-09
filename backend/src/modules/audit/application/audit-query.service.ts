import { Injectable } from '@nestjs/common';

import { type Page, type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { AuditEvent } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { AUDIT_VERIFY_MAX_ROWS } from '../domain/audit.constants.js';

export type AuditFilters = PageQuery & {
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: Date;
  to?: Date;
};

export type AuditEventView = {
  id: string;
  seq: string;
  occurredAt: string;
  actorType: string;
  actorUserId: string | null;
  actorMembershipId: string | null;
  actorContext: string | null;
  sessionId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  ip: string | null;
  metadata: unknown;
  hash: string | null;
};

export type ChainVerification = {
  valid: boolean;
  checked: number;
  fromSeq: string | null;
  toSeq: string | null;
  brokenAt: { seq: string; id: string; reason: 'hash_mismatch' | 'link_mismatch' } | null;
};

type VerifyRow = { seq: bigint; id: string; hashOk: boolean; linkOk: boolean };

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: AuditFilters): Promise<Page<AuditEventView>> {
    const window = pageWindow(filters);
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        id: window.idFilter,
        actorUserId: filters.actorUserId,
        entityType: filters.entityType,
        entityId: filters.entityId,
        action: filters.action,
        occurredAt: filters.from || filters.to ? { gte: filters.from, lte: filters.to } : undefined,
      },
      orderBy: { id: 'desc' },
      take: window.take,
    });
    return toPage(rows, filters.limit, toView);
  }

  async verifyChain(fromSeq: bigint | undefined, limit: number): Promise<ChainVerification> {
    const take = Math.min(limit, AUDIT_VERIFY_MAX_ROWS);
    const start = fromSeq ?? 0n;
    const rows = await this.prisma.$queryRaw<VerifyRow[]>`
      WITH window_rows AS (
        SELECT a.*, lag(a.hash) OVER (ORDER BY a.seq) AS expected_prev, a.seq = min(a.seq) OVER () AS is_first
        FROM (
          SELECT * FROM audit_events WHERE seq >= ${start} ORDER BY seq LIMIT ${take}
        ) a
      ), anchor AS (
        SELECT hash FROM audit_events WHERE seq < ${start} ORDER BY seq DESC LIMIT 1
      )
      SELECT w.seq, w.id,
             w.hash = audit_event_hash(w.prev_hash, w.id, w.occurred_at, w.actor_type::text, w.actor_user_id, w.action, w.entity_type, w.entity_id, w.metadata) AS "hashOk",
             CASE WHEN w.is_first THEN w.prev_hash IS NOT DISTINCT FROM (SELECT hash FROM anchor)
                  ELSE w.prev_hash IS NOT DISTINCT FROM w.expected_prev END AS "linkOk"
      FROM window_rows w
      ORDER BY w.seq`;

    const broken = rows.find((row) => !row.hashOk || !row.linkOk);
    return {
      valid: !broken,
      checked: rows.length,
      fromSeq: rows[0]?.seq.toString() ?? null,
      toSeq: rows.at(-1)?.seq.toString() ?? null,
      brokenAt: broken ? { seq: broken.seq.toString(), id: broken.id, reason: broken.hashOk ? 'link_mismatch' : 'hash_mismatch' } : null,
    };
  }
}

function toView(row: AuditEvent): AuditEventView {
  return {
    id: row.id,
    seq: row.seq.toString(),
    occurredAt: row.occurredAt.toISOString(),
    actorType: row.actorType,
    actorUserId: row.actorUserId,
    actorMembershipId: row.actorMembershipId,
    actorContext: row.actorContext,
    sessionId: row.sessionId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    requestId: row.requestId,
    ip: row.ip,
    metadata: row.metadata,
    hash: row.hash,
  };
}
