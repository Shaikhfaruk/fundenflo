import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { IdentifierType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { namesCompatible } from '../../../engines/party-matching/lead-match.js';
import { RateLimiter } from '../../../infrastructure/rate-limit/rate-limiter.service.js';
import { InjectPanVerifier, PAN_STATUS_MESSAGES, PAN_UNVERIFIED_MESSAGE, type PanResult, PanStatus, type PanVerifier } from '../../../integrations/kyc/pan-verifier.port.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { PartyService } from '../../parties/application/party.service.js';
import { BorrowerSegment, KYC_SOURCE_PREFIX, PAN_HOLDER_FOR_SUB_SEGMENT, PAN_HOLDER_INDEX, PAN_VERIFY_RATE_LIMIT, PanHolder } from '../domain/borrower.constants.js';
import { BorrowerProfileRepository } from '../infrastructure/borrower-profile.repository.js';
import { BorrowerProfileService } from './borrower-profile.service.js';

export type PanInput = { pan: string; name?: string; dateOfBirth?: string };

type KycSubject = { segmentKey: string; subSegmentKey: string | null; partyId: string; actingPartyId: string };

@Injectable()
export class BorrowerKycService {
  constructor(
    private readonly profiles: BorrowerProfileService,
    private readonly repository: BorrowerProfileRepository,
    private readonly parties: PartyService,
    private readonly limiter: RateLimiter,
    private readonly changes: ChangeRecorder,
    @InjectPanVerifier() private readonly verifier: PanVerifier,
  ) {}

  async verifyPan(id: string, input: PanInput, ability: AppAbility) {
    const profile = await this.profiles.get(id, ability, AppAction.Update);
    const expected = this.expectedHolder(profile);
    if (!expected) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'subSegment', code: 'required', message: 'set the business type before verifying its PAN' }] });
    if (input.pan.charAt(PAN_HOLDER_INDEX) !== expected) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'pan', code: 'holder_mismatch', message: `a ${profile.subSegmentKey ?? profile.segmentKey} PAN has ${expected} as its fourth character` }] });
    const partyId = this.kycPartyId(profile, expected);
    const party = await this.parties.summary(partyId);
    const name = input.name ?? party.displayName;
    if (!name) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'name', code: 'required', message: 'give the name as printed on the PAN' }] });
    const quota = await this.limiter.consume(`pan-verify:profile:${id}`, PAN_VERIFY_RATE_LIMIT.limit, PAN_VERIFY_RATE_LIMIT.windowSeconds);
    if (!quota.allowed) throw new AppError(ErrorCode.RATE_LIMITED, { retryAfterSeconds: quota.retryAfterSeconds });
    const result = await this.verifier.verify({ pan: input.pan, name, dateOfBirth: input.dateOfBirth });
    if (result.status !== PanStatus.Valid) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'pan', code: result.status, message: PAN_STATUS_MESSAGES[result.status] ?? PAN_UNVERIFIED_MESSAGE }] });
    return this.store(id, partyId, input.pan, namesCompatible(result.nameOnRecord, party.displayName ?? name), result);
  }

  async panVerifiedFor(borrowerProfileId: string): Promise<boolean> {
    const profile = await this.repository.findOne({ id: borrowerProfileId });
    const expected = profile ? this.expectedHolder(profile) : undefined;
    if (!profile || !expected) return false;
    return (await this.parties.identifier(this.kycPartyId(profile, expected), IdentifierType.pan))?.verified ?? false;
  }

  @Transactional()
  private async store(borrowerProfileId: string, partyId: string, pan: string, nameMatch: boolean, result: PanResult) {
    const identifier = await this.parties.setIdentifier(partyId, { type: IdentifierType.pan, value: pan, verified: nameMatch, source: `${KYC_SOURCE_PREFIX}:${result.provider}` });
    await this.changes.record({
      action: AuditAction.PanVerified,
      entityType: AuditEntity.BorrowerProfile,
      entityId: borrowerProfileId,
      event: EventName.BorrowerProfileChanged,
      metadata: { partyId, pan: identifier.masked, provider: result.provider, reference: result.reference, nameMatch },
      payload: { borrowerProfileId, partyId, kyc: IdentifierType.pan, nameMatch },
    });
    return { pan: identifier.masked, verified: identifier.verified, nameMatch, nameOnRecord: result.nameOnRecord, partyId, provider: result.provider };
  }

  private expectedHolder(profile: KycSubject): PanHolder | undefined {
    if (profile.segmentKey === BorrowerSegment.Individual) return PanHolder.Person;
    return profile.subSegmentKey ? PAN_HOLDER_FOR_SUB_SEGMENT[profile.subSegmentKey] : undefined;
  }

  private kycPartyId(profile: KycSubject, holder: PanHolder) {
    return holder === PanHolder.Person && profile.segmentKey !== BorrowerSegment.Individual ? profile.actingPartyId : profile.partyId;
  }
}
