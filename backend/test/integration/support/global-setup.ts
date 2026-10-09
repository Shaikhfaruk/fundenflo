import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { exportJWK, generateKeyPair } from 'jose';
import { GenericContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';

import { AZURITE_ACCOUNT, AZURITE_IMAGE, TEST_OTP_CODE } from './test.constants.js';

declare module 'vitest' {
  export interface ProvidedContext {
    testEnv: Record<string, string>;
  }
}

export default async function setup(project: TestProject) {
  const postgres = await new PostgreSqlContainer('postgres:18').withDatabase('fundenflo').withUsername('fundenflo').withPassword('fundenflo').start();
  const valkey = await new GenericContainer('valkey/valkey:8')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();

  const azurite = await new GenericContainer(AZURITE_IMAGE)
    .withCommand(['azurite-blob', '--blobHost', '0.0.0.0', '--loose', '--skipApiVersionCheck'])
    .withExposedPorts(10000)
    .withWaitStrategy(Wait.forLogMessage(/Azurite Blob service successfully listens/))
    .start();
  const blobEndpoint = `http://${azurite.getHost()}:${azurite.getMappedPort(10000)}/${AZURITE_ACCOUNT.name}`;

  const databaseUrl = postgres.getConnectionUri();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });

  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  const signingKey = { ...(await exportJWK(privateKey)), kid: randomUUID(), alg: 'ES256' };
  const dataKeyId = `dk-${randomUUID()}`;

  project.provide('testEnv', {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: databaseUrl,
    REDIS_URL: `redis://${valkey.getHost()}:${valkey.getMappedPort(6379)}`,
    JWT_ISSUER: 'fundenflo-api',
    JWT_AUDIENCE: 'fundenflo-clients',
    JWT_SIGNING_KEYS: JSON.stringify([signingKey]),
    CRYPTO_DRIVER: 'local',
    CRYPTO_ACTIVE_KEY_ID: dataKeyId,
    CRYPTO_LOCAL_KEYS: JSON.stringify({ [dataKeyId]: randomBytes(32).toString('base64') }),
    BLIND_INDEX_KEY: randomBytes(32).toString('base64'),
    OTP_HASH_KEY: randomBytes(32).toString('base64'),
    AUTH_OTP_STATIC_CODE: TEST_OTP_CODE,
    SMS_DRIVER: 'log',
    EMAIL_DRIVER: 'log',
    STORAGE_DRIVER: 'azure_blob',
    STORAGE_CONNECTION_STRING: `DefaultEndpointsProtocol=http;AccountName=${AZURITE_ACCOUNT.name};AccountKey=${AZURITE_ACCOUNT.key};BlobEndpoint=${blobEndpoint};`,
    STORAGE_CONTAINER: 'fundenflo-test',
  });

  return async () => {
    await azurite.stop();
    await valkey.stop();
    await postgres.stop();
  };
}
