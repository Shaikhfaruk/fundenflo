export const REVOCATION_GRACE_SECONDS = 60;

export const RevocationKey = {
  session: (id: string) => `revoked:session:${id}`,
  membership: (id: string) => `revoked:membership:${id}`,
  user: (id: string) => `revoked:user:${id}`,
} as const;
