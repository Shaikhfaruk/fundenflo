import { Injectable } from '@nestjs/common';

import { EventName } from '../../../common/events/event-names.js';
import { type ContactType, PartyKind } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import type { ContactSource } from '../domain/party.constants.js';
import { PartyRepository } from '../infrastructure/party.repository.js';
import { ContactCodec } from './contact-codec.service.js';

export type ContactInput = {
  type: ContactType;
  value: string;
  verified: boolean;
  primary: boolean;
  source: ContactSource;
};

export type ProfilePatch = {
  displayName?: string;
  preferredLanguage?: string | null;
};

@Injectable()
export class PartyService {
  constructor(
    private readonly parties: PartyRepository,
    private readonly codec: ContactCodec,
    private readonly outbox: OutboxService,
  ) {}

  createPerson(input: { displayName?: string | null; contact?: ContactInput }) {
    return this.createParty(PartyKind.person, input);
  }

  createBusiness(input: { displayName: string; contact?: ContactInput }) {
    return this.createParty(PartyKind.business, input);
  }

  private async createParty(kind: PartyKind, input: { displayName?: string | null; contact?: ContactInput }) {
    const party = await this.parties.create({ kind, displayName: input.displayName ?? null });
    if (input.contact) await this.addContact(party.id, input.contact);
    await this.outbox.publish({ name: EventName.PartyCreated, aggregateType: 'party', aggregateId: party.id, payload: { partyId: party.id, kind: party.kind } });
    return party;
  }

  async addContact(partyId: string, input: ContactInput) {
    const encoded = this.codec.encode(input.type, input.value, CipherPurpose.PartyContact);
    const now = new Date();
    const existing = await this.parties.findContact(partyId, input.type, encoded.hash);
    const contact = existing
      ? await this.parties.updateContact(existing.id, {
          verifiedAt: input.verified ? (existing.verifiedAt ?? now) : existing.verifiedAt,
          isPrimary: input.primary || existing.isPrimary,
          invalidAt: input.verified ? null : existing.invalidAt,
        })
      : await this.parties.createContact({
          partyId,
          type: input.type,
          valueEnc: encoded.encrypted,
          valueHash: encoded.hash,
          valueMasked: encoded.masked,
          isPrimary: input.primary,
          verifiedAt: input.verified ? now : null,
          source: input.source,
        });
    if (input.primary) await this.parties.clearPrimary(partyId, input.type, contact.id);
    return contact;
  }

  async requireContact(partyId: string, contactId: string) {
    const contact = (await this.parties.listContacts(partyId)).find((row) => row.id === contactId);
    if (!contact) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'contactId', code: 'not_a_contact', message: 'not a contact of this person' }] });
    return contact;
  }

  async markContactInvalid(partyId: string, contactId: string): Promise<boolean> {
    const contact = await this.requireContact(partyId, contactId);
    if (contact.invalidAt || contact.verifiedAt) return false;
    await this.parties.updateContact(contact.id, { invalidAt: new Date() });
    return true;
  }

  async hasUsableContact(partyId: string, type: ContactType): Promise<boolean> {
    return (await this.parties.listContacts(partyId)).some((contact) => contact.type === type && !contact.invalidAt && !contact.doNotContact);
  }

  async assertExists(partyId: string): Promise<void> {
    if (!(await this.parties.findById(partyId))) throw new AppError(ErrorCode.NOT_FOUND, { details: { partyId } });
  }

  async contactExists(type: ContactType, value: string): Promise<boolean> {
    return (await this.parties.findContactCandidates(type, this.codec.hash(type, value))).length > 0;
  }

  async summary(partyId: string) {
    const party = await this.parties.findById(partyId);
    if (!party) throw new AppError(ErrorCode.NOT_FOUND, { details: { partyId } });
    return { id: party.id, kind: party.kind, displayName: party.displayName };
  }

  async listContacts(partyId: string, reveal: boolean) {
    return (await this.parties.listContacts(partyId)).map((contact) => ({
      id: contact.id,
      type: contact.type,
      value: reveal ? this.codec.decrypt(contact.valueEnc, CipherPurpose.PartyContact) : null,
      masked: contact.valueMasked,
      primary: contact.isPrimary,
      verified: contact.verifiedAt !== null,
      doNotContact: contact.doNotContact,
      invalid: contact.invalidAt !== null,
    }));
  }

  async getPrimaryContactValue(partyId: string, type: ContactType): Promise<string | null> {
    const contact = await this.parties.findPrimaryContact(partyId, type);
    return contact ? this.codec.decrypt(contact.valueEnc, CipherPurpose.PartyContact) : null;
  }

  async updateProfile(partyId: string, patch: ProfilePatch, expectedVersion: number | undefined) {
    const party = await this.parties.findById(partyId);
    if (!party) throw new AppError(ErrorCode.NOT_FOUND);
    assertVersion(expectedVersion, party.version);
    const result = await this.parties.updateVersioned(partyId, party.version, {
      ...(patch.displayName === undefined ? {} : { displayName: patch.displayName }),
      ...(patch.preferredLanguage === undefined ? {} : { preferredLanguage: patch.preferredLanguage }),
    });
    if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: party.version + 1 } });
  }
}
