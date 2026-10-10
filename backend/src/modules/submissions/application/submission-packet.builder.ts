import { Injectable } from '@nestjs/common';

import { stableStringify } from '../../../common/utils/stable-json.js';
import type { LenderSubmission, MatchResult, SubmissionPacket } from '../../../generated/prisma/client.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { sha256 } from '../../../infrastructure/crypto/secure-random.js';
import { ApplicationPartyService } from '../../applications/application/application-party.service.js';
import type { ApplicationSubject } from '../../applications/application/application.service.js';
import { ScoringService } from '../../assessments/application/scoring.service.js';
import { FactService } from '../../attributes/application/fact.service.js';
import { DocumentService } from '../../documents/application/document.service.js';
import { PACKET_FACTS_MAX, PACKET_FORMAT_VERSION } from '../domain/submission.constants.js';

type StoredPacket = { format: number; enc: string };

@Injectable()
export class SubmissionPacketBuilder {
  constructor(
    private readonly facts: FactService,
    private readonly parties: ApplicationPartyService,
    private readonly scoring: ScoringService,
    private readonly documents: DocumentService,
    private readonly cipher: FieldCipher,
  ) {}

  async build(submission: LenderSubmission, application: ApplicationSubject, match: MatchResult) {
    const documents = await this.documents.analysable(application.partyId, application.id);
    const coParties = [];
    for (const party of await this.parties.coParties(application.id)) coParties.push({ role: party.role, name: party.name, facts: await this.factsOf(party.partyId) });
    const snapshot = {
      format: PACKET_FORMAT_VERSION,
      submission: { id: submission.id, ref: submission.ref, lenderId: submission.lenderId, product: { id: submission.productDocumentId, key: submission.productKey, versionId: submission.productVersionId } },
      application: {
        id: application.id,
        ref: application.ref,
        segment: application.segmentKey,
        subSegment: application.subSegmentKey,
        category: application.categoryKey,
        purpose: application.purposeKey,
        purposeNote: application.purposeNote,
        amountPaise: application.amountPaise,
        tenureMonths: application.tenureMonths,
        location: application.location,
      },
      borrower: { name: application.businessName, facts: await this.factsOf(application.partyId) },
      applicant: application.actingPartyId === application.partyId ? null : { name: application.applicantName, facts: await this.factsOf(application.actingPartyId) },
      coParties,
      assessment: await this.scoring.summary(application.latestScoreResultId),
      match: { resultId: match.id, outcome: match.outcome, fit: match.fit, rank: match.rank, reasons: match.reasons },
      documents: documents.map((document) => ({ id: document.id, documentType: document.documentType.key, fileName: document.fileName, uploadedAt: document.createdAt.toISOString() })),
    };
    const stored: StoredPacket = { format: PACKET_FORMAT_VERSION, enc: this.cipher.encryptJson(snapshot, CipherPurpose.SubmissionPacket) };
    return { snapshot: stored, documentIds: documents.map((document) => document.id), hash: sha256(stableStringify(snapshot)) };
  }

  read(packet: SubmissionPacket): unknown {
    const stored = packet.snapshot as Partial<StoredPacket> | null;
    return stored?.enc ? this.cipher.decryptJson<unknown>(stored.enc, CipherPurpose.SubmissionPacket) : null;
  }

  private async factsOf(partyId: string) {
    return (await this.facts.snapshot(partyId)).slice(0, PACKET_FACTS_MAX).map((fact) => ({ attributeKey: fact.attributeKey, value: fact.value, provenance: fact.provenance, observedAt: fact.observedAt, stale: fact.stale }));
  }
}
