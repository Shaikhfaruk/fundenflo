import { PartyMergeParticipantKey } from '../domain/party.constants.js';
import { type MergeIssue, type MergeParties, movedIds, type PartyMergeParticipant } from '../domain/party-merge.types.js';
import { PartyRepository } from '../infrastructure/party.repository.js';
import { PartyMergeParticipantFor } from './party-merge.registry.js';

type ContactMove = { id: string; isPrimary: boolean };

type ContactFlags = { id: string; verifiedAt: string | null; doNotContact: boolean };

type CoreUndo = { contacts: ContactMove[]; flags: ContactFlags[]; identifiers: string[]; relationshipsFrom: string[]; relationshipsTo: string[] };

@PartyMergeParticipantFor(PartyMergeParticipantKey.Core)
export class PartyCoreMergeParticipant implements PartyMergeParticipant {
  constructor(private readonly parties: PartyRepository) {}

  async check({ sourceId, targetId }: MergeParties): Promise<MergeIssue[]> {
    const source = await this.parties.listIdentifiers(sourceId);
    const target = await this.parties.listIdentifiers(targetId);
    return source.flatMap((identifier) => {
      const other = target.find((candidate) => candidate.type === identifier.type);
      return other && other.valueHash !== identifier.valueHash ? [{ path: `identifiers.${identifier.type}`, code: 'identifier_conflict', message: `the two parties have different ${identifier.type.toUpperCase()} numbers` }] : [];
    });
  }

  async merge({ sourceId, targetId }: MergeParties): Promise<CoreUndo> {
    const sourceContacts = await this.parties.listContacts(sourceId);
    const targetContacts = await this.parties.listContacts(targetId);
    const byKey = new Map(targetContacts.map((contact) => [`${contact.type}:${contact.valueHash}`, contact]));
    const primaryTypes = new Set(targetContacts.filter((contact) => contact.isPrimary).map((contact) => contact.type));
    const undo: CoreUndo = { contacts: [], flags: [], identifiers: [], relationshipsFrom: [], relationshipsTo: [] };
    for (const contact of sourceContacts) {
      const existing = byKey.get(`${contact.type}:${contact.valueHash}`);
      if (!existing) {
        await this.parties.moveContact(contact.id, targetId, contact.isPrimary && !primaryTypes.has(contact.type));
        undo.contacts.push({ id: contact.id, isPrimary: contact.isPrimary });
        continue;
      }
      const verifiedAt = existing.verifiedAt ?? contact.verifiedAt;
      const doNotContact = existing.doNotContact || contact.doNotContact;
      if (verifiedAt !== existing.verifiedAt || doNotContact !== existing.doNotContact) {
        undo.flags.push({ id: existing.id, verifiedAt: existing.verifiedAt?.toISOString() ?? null, doNotContact: existing.doNotContact });
        await this.parties.updateContact(existing.id, { verifiedAt, doNotContact });
      }
    }
    const sourceIdentifiers = await this.parties.listIdentifiers(sourceId);
    const targetIdentifiers = await this.parties.listIdentifiers(targetId);
    undo.identifiers = sourceIdentifiers.filter((identifier) => !targetIdentifiers.some((other) => other.type === identifier.type)).map((identifier) => identifier.id);
    await this.parties.moveIdentifiers(undo.identifiers, targetId);
    const relationships = (await this.parties.relationshipsTouching(sourceId)).filter((relationship) => relationship.fromPartyId !== targetId && relationship.toPartyId !== targetId);
    undo.relationshipsFrom = relationships.filter((relationship) => relationship.fromPartyId === sourceId).map((relationship) => relationship.id);
    undo.relationshipsTo = relationships.filter((relationship) => relationship.toPartyId === sourceId).map((relationship) => relationship.id);
    await this.parties.moveRelationshipEnds(undo.relationshipsFrom, 'fromPartyId', targetId);
    await this.parties.moveRelationshipEnds(undo.relationshipsTo, 'toPartyId', targetId);
    return undo;
  }

  async revert({ sourceId }: MergeParties, undo: unknown) {
    const core = undo as Partial<CoreUndo> | null;
    for (const contact of core?.contacts ?? []) await this.parties.moveContact(contact.id, sourceId, contact.isPrimary);
    for (const flags of core?.flags ?? []) await this.parties.updateContact(flags.id, { verifiedAt: flags.verifiedAt ? new Date(flags.verifiedAt) : null, doNotContact: flags.doNotContact });
    await this.parties.moveIdentifiers(movedIds(undo, 'identifiers'), sourceId);
    await this.parties.moveRelationshipEnds(movedIds(undo, 'relationshipsFrom'), 'fromPartyId', sourceId);
    await this.parties.moveRelationshipEnds(movedIds(undo, 'relationshipsTo'), 'toPartyId', sourceId);
  }
}
