import { ensureStaffPool } from './support/staff-pool';

export default async function globalSetup() {
  await ensureStaffPool();
}
