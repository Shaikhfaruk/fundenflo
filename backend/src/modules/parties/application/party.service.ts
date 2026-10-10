import { Injectable } from '@nestjs/common';

import { EventName } from '../../../common/events/event-names.js';
import { ContactType, type IdentifierType, PartyKind, type RelationshipType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { maskIdentifier } from '../../../engines/party-matching/mask.js';
import { BlindIndex } from '../../../infrastructure/crypto/blind-index.service.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { type ContactSource, IDENTIFIER_INDEX_DOMAIN } from '../domain/party.constants.js';
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
    private readonly blindIndex: BlindIndex,
    private readonly cipher: FieldCipher,
    private readonly outbox: OutboxService,
  ) {}

  createPerson(input: { displayName?: string | null; contact?: ContactInput }) {
    return this.createParty(PartyKind.person, input);
  }

  createBusiness(input: { displayName: string | null; contact?: ContactInput }) {
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

  async linkRelationship(fromPartyId: string, toPartyId: string, type: RelationshipType) {
    return (await this.parties.findRelationship(fromPartyId, toPartyId, type)) ?? this.parties.createRelationship({ fromPartyId, toPartyId, type, startedAt: new Date() });
  }

  businessesOf(personPartyId: string) {
    return this.parties.businessesOf(personPartyId);
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

  async reachableContact(partyId: string, type: ContactType = ContactType.mobile) {
    const contact = (await this.listContacts(partyId, true)).find((candidate) => candidate.type === type && !candidate.doNotContact && !candidate.invalid && candidate.value);
    return contact?.value ? { value: contact.value, masked: contact.masked, hash: this.codec.hash(type, contact.value) } : null;
  }

  async setIdentifier(partyId: string, input: { type: IdentifierType; value: string; verified: boolean; source: string }) {
    const hash = this.blindIndex.hash(IDENTIFIER_INDEX_DOMAIN[input.type], input.value);
    const owners = await this.parties.findIdentifierOwners(input.type, hash);
    if (owners.some((owner) => owner.partyId !== partyId)) throw new AppError(ErrorCode.IDENTIFIER_IN_USE, { details: { type: input.type } });
    const existing = await this.parties.findIdentifier(partyId, input.type);
    if (existing?.verifiedAt && existing.valueHash !== hash) throw new AppError(ErrorCode.IDENTIFIER_IN_USE, { details: { type: input.type, reason: 'a different verified value is already recorded' } });
    const keepVerified = existing?.valueHash === hash ? existing.verifiedAt : null;
    const saved = await this.parties.upsertIdentifier(partyId, input.type, {
      valueEnc: this.cipher.encrypt(input.value, CipherPurpose.PartyIdentifier),
      valueHash: hash,
      valueMasked: maskIdentifier(input.value),
      verifiedAt: input.verified ? (keepVerified ?? new Date()) : keepVerified,
      source: input.source,
    });
    return { type: saved.type, masked: saved.valueMasked, verified: saved.verifiedAt !== null, verifiedAt: saved.verifiedAt };
  }

  async identifier(partyId: string, type: IdentifierType) {
    const found = await this.parties.findIdentifier(partyId, type);
    return found ? { type: found.type, masked: found.valueMasked, verified: found.verifiedAt !== null, verifiedAt: found.verifiedAt } : null;
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
