import 'server-only';

import type { MeView, NextAction } from '@/lib/api/types/auth.types';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
};

export type AuthResult = TokenPair & {
  user: MeView;
  nextAction: NextAction | null;
};
