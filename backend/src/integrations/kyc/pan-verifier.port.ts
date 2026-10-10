import { Inject } from '@nestjs/common';

export const PAN_VERIFIER = Symbol('PAN_VERIFIER');

export const InjectPanVerifier = () => Inject(PAN_VERIFIER);

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const PanStatus = {
  Valid: 'valid',
  Invalid: 'invalid',
  NotFound: 'not_found',
} as const;

export type PanStatus = (typeof PanStatus)[keyof typeof PanStatus];

export type PanQuery = { pan: string; name: string; dateOfBirth?: string };

export type PanResult = {
  status: PanStatus;
  nameOnRecord: string | null;
  provider: string;
  reference: string | null;
};

export interface PanVerifier {
  verify(query: PanQuery): Promise<PanResult>;
}
