import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildCollection, COLLECTION_DIR, DIST_DIR, POSTMAN_ROOT } from './build.ts';

type FlowStep = { request: string; variables?: Record<string, string>; waitSeconds?: number };
type Flow = { name: string; requires?: string[]; steps: FlowStep[] };

const BACKEND_DIR = join(POSTMAN_ROOT, '..', 'backend');
const FLOWS_DIR = join(POSTMAN_ROOT, 'flows');
const ENVIRONMENT = join(POSTMAN_ROOT, 'environments', 'local.postman_environment.json');
const NEWMAN = join(BACKEND_DIR, 'node_modules', '.bin', 'newman');
const STAFF_FULL_NAME = 'Postman Flow Runner';

function readBackendEnv(): Map<string, string> {
  const file = join(BACKEND_DIR, '.env');
  if (!existsSync(file)) return new Map();
  return new Map(
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line) => {
        const index = line.indexOf('=');
        return index > 0 ? [[line.slice(0, index), line.slice(index + 1).trim()] as const] : [];
      }),
  );
}

function createStaffInvitation(): Record<string, string> {
  const email = `postman.${Date.now()}.${randomInt(0, 1_000_000)}@sustaininsight.com`;
  const output = execFileSync('node', ['dist/scripts/invite-staff.js', '--email', email, '--role', 'super_admin'], { cwd: BACKEND_DIR, encoding: 'utf8' });
  const token = /Invitation code: (\S+)/.exec(output)?.[1];
  if (!token) throw new Error(`Could not read the invitation code from invite-staff output:\n${output}`);
  return { staffEmail: email, staffInviteToken: token, staffPassword: randomBytes(18).toString('base64url'), staffFullName: STAFF_FULL_NAME };
}

function findItem(relativePath: string): Record<string, unknown> {
  const path = join(COLLECTION_DIR, relativePath);
  if (!existsSync(path)) throw new Error(`Flow step ${relativePath} does not exist in postman/collection`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function stepItem(step: FlowStep, index: number): Record<string, unknown> {
  const item = findItem(step.request);
  const setup: string[] = Object.entries(step.variables ?? {}).map(
    ([name, value]) => `pm.collectionVariables.set(${JSON.stringify(name)}, ${JSON.stringify(value)});`,
  );
  if (step.waitSeconds) setup.push(`setTimeout(() => {}, ${step.waitSeconds * 1000});`);
  const events = (item.event as Array<{ listen: string; script: { exec: string[] } }> | undefined) ?? [];
  const prerequest = setup.length > 0 ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: setup } }] : [];
  return { ...item, name: `${String(index + 1).padStart(2, '0')} ${String(item.name)}`, event: [...prerequest, ...events] };
}

function runFlow(file: string, env: Map<string, string>): boolean {
  const flow = JSON.parse(readFileSync(join(FLOWS_DIR, file), 'utf8')) as Flow;
  const base = buildCollection();
  const collection = { ...base, info: { ...(base.info as object), name: `FundenFlo flow: ${flow.name}` }, item: flow.steps.map(stepItem) };
  const output = join(DIST_DIR, 'flows', file.replace('.flow.json', '.postman_collection.json'));
  writeFileSync(output, `${JSON.stringify(collection, null, 2)}\n`);

  const variables: Record<string, string> = { otp: env.get('AUTH_OTP_STATIC_CODE') ?? '' };
  if (flow.requires?.includes('staffInvitation')) Object.assign(variables, createStaffInvitation());
  const args = ['run', output, '-e', ENVIRONMENT, '--bail', '--color', 'on', ...Object.entries(variables).flatMap(([name, value]) => ['--env-var', `${name}=${value}`])];
  process.stdout.write(`\n▶ ${flow.name}\n`);
  return spawnSync(NEWMAN, args, { stdio: 'inherit' }).status === 0;
}

const env = readBackendEnv();
if (!env.get('AUTH_OTP_STATIC_CODE')) {
  process.stderr.write('Set AUTH_OTP_STATIC_CODE in backend/.env (non-production only) so flows can complete OTP sign-in.\n');
  process.exit(1);
}
mkdirSync(join(DIST_DIR, 'flows'), { recursive: true });
const requested = process.argv.slice(2);
const files = readdirSync(FLOWS_DIR)
  .filter((file) => file.endsWith('.flow.json'))
  .filter((file) => requested.length === 0 || requested.includes(file.replace('.flow.json', '')))
  .sort();
const failed = files.filter((file) => !runFlow(file, env));
if (failed.length > 0) {
  process.stderr.write(`\nFailed flows: ${failed.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write(`\nAll ${files.length} flows passed\n`);
