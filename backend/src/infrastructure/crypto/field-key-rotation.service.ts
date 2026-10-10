import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { MaintenanceTask } from '../maintenance/maintenance-task.decorator.js';
import { CIPHER_FORMAT_VERSION, ENCRYPTED_COLUMNS, type EncryptedColumn, KEY_ROTATION_BATCH, KEY_ROTATION_SETTING, KEY_ROTATION_START_KEY, KEY_ROTATION_TIME_BUDGET_MS } from './crypto.constants.js';
import { FieldCipher } from './field-cipher.service.js';

type Candidate = { key: string; token: string };

export type KeyRotationRun = { rotated: number; failed: number; complete: boolean };

export type KeyRotationBacklog = { table: string; column: string; rows: number };

const quoted = (identifier: string) => Prisma.raw(`"${identifier}"`);

const valueOf = (column: EncryptedColumn, alias?: string) => {
  const target = alias ? Prisma.raw(`${alias}."${column.column}"`) : quoted(column.column);
  return column.jsonField ? Prisma.sql`(${target} ->> ${column.jsonField})` : target;
};

@Injectable()
export class FieldKeyRotation {
  private readonly logger = new Logger(FieldKeyRotation.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: FieldCipher,
  ) {}

  @MaintenanceTask('crypto.reencrypt-retired-keys')
  async rotateDue(): Promise<number> {
    return (await this.rotate(Date.now() + KEY_ROTATION_TIME_BUDGET_MS)).rotated;
  }

  async rotate(deadline: number): Promise<KeyRotationRun> {
    const run: KeyRotationRun = { rotated: 0, failed: 0, complete: true };
    for (const column of ENCRYPTED_COLUMNS) {
      let cursor = KEY_ROTATION_START_KEY;
      for (;;) {
        if (Date.now() >= deadline) return { ...run, complete: false };
        const batch = await this.candidates(column, cursor);
        if (batch.length === 0) break;
        const outcome = await this.rewrite(column, batch);
        run.rotated += outcome.rotated;
        run.failed += outcome.failed;
        cursor = batch.at(-1)?.key ?? cursor;
        if (batch.length < KEY_ROTATION_BATCH) break;
      }
    }
    return run;
  }

  async backlog(): Promise<KeyRotationBacklog[]> {
    const prefix = this.currentPrefix();
    const rows: KeyRotationBacklog[] = [];
    for (const column of ENCRYPTED_COLUMNS) {
      const value = valueOf(column);
      const [count] = await this.prisma.$queryRaw<Array<{ rows: bigint }>>`SELECT count(*) AS rows FROM ${quoted(column.table)} WHERE ${value} IS NOT NULL AND NOT starts_with(${value}, ${prefix})`;
      rows.push({ table: column.table, column: column.column, rows: Number(count?.rows ?? 0) });
    }
    return rows;
  }

  private currentPrefix() {
    return `${CIPHER_FORMAT_VERSION}:${this.cipher.activeKeyId}:`;
  }

  private candidates(column: EncryptedColumn, cursor: string) {
    const key = quoted(column.key);
    const value = valueOf(column);
    return this.prisma.$queryRaw<Candidate[]>`
      SELECT ${key}::text AS key, ${value} AS token
      FROM ${quoted(column.table)}
      WHERE ${key} > ${cursor}::uuid AND ${value} IS NOT NULL AND NOT starts_with(${value}, ${this.currentPrefix()})
      ORDER BY ${key}
      LIMIT ${KEY_ROTATION_BATCH}`;
  }

  private async rewrite(column: EncryptedColumn, batch: Candidate[]) {
    const keys: string[] = [];
    const previous: string[] = [];
    const next: string[] = [];
    let failed = 0;
    for (const row of batch) {
      try {
        next.push(this.cipher.reencrypt(row.token, column.purpose));
        keys.push(row.key);
        previous.push(row.token);
      } catch (error) {
        failed += 1;
        this.logger.warn({ table: column.table, column: column.column, key: row.key, reason: error instanceof Error ? error.message : String(error) }, 'Encrypted value could not be read for key rotation');
      }
    }
    if (keys.length === 0) return { rotated: 0, failed };
    const target = column.jsonField ? Prisma.sql`jsonb_set(t.${quoted(column.column)}, ${`{${column.jsonField}}`}::text[], to_jsonb(v.token))` : Prisma.sql`v.token`;
    const rotated = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config(${KEY_ROTATION_SETTING}, 'on', true)`;
      return tx.$executeRaw`
        UPDATE ${quoted(column.table)} AS t SET ${quoted(column.column)} = ${target}
        FROM unnest(${keys}::uuid[], ${previous}::text[], ${next}::text[]) AS v(key, previous, token)
        WHERE t.${quoted(column.key)} = v.key AND ${valueOf(column, 't')} = v.previous`;
    });
    return { rotated, failed };
  }
}
