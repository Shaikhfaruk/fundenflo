import { ensureStaffPool, prepareStaffSessions } from './support/staff-pool';

export default async function globalSetup() {
  await ensureStaffPool();
  await prepareStaffSessions();
}
