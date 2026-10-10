import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const BACKEND_DIR = resolve(import.meta.dirname, '../../../../backend');

const backendEnv = parseEnv(readFileSync(resolve(BACKEND_DIR, '.env'), 'utf8'));

export const staticOtp = () => {
  const code = process.env.E2E_OTP ?? backendEnv.AUTH_OTP_STATIC_CODE;
  if (!code) throw new Error('Set AUTH_OTP_STATIC_CODE in backend/.env or E2E_OTP for end-to-end tests');
  return code;
};

export const randomMobile = () => `98${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

export const randomEmail = (prefix: string) => `${prefix}.${Date.now()}.${randomInt(0, 1_000_000)}@sustaininsight.com`;

export function inviteStaff(email: string, role: string): string {
  const output = execFileSync('node', ['dist/scripts/invite-staff.js', '--email', email, '--role', role], { cwd: BACKEND_DIR, encoding: 'utf8' });
  const token = /Invitation code: (\S+)/.exec(output)?.[1];
  if (!token) throw new Error(`No invitation code in invite-staff output:\n${output}`);
  return token;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXY';

const letter = () => LETTERS[randomInt(0, LETTERS.length)];

export const randomPan = (holder = 'P') => `${letter()}${letter()}${letter()}${holder}${letter()}${String(randomInt(0, 10_000)).padStart(4, '0')}${letter()}`;
