import { LeadLostReason } from '../../../common/enums/db.enums.js';
import { LeadEvent, OPEN_LEAD_STATES } from '../../../engines/state-machines/machines/lead.machine.js';
import { LeadAttributionService } from '../../partners/application/lead-attribution.service.js';
import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadService } from './lead.service.js';

@PrivacyParticipantFor(PrivacySection.Leads)
export class LeadPrivacyParticipant implements PrivacyParticipant {
  constructor(
    private readonly leads: LeadRepository,
    private readonly leadService: LeadService,
    private readonly attributions: LeadAttributionService,
  ) {}

  async export(subject: PrivacySubject) {
    const rows = await this.leads.listForParties(subject.partyIds);
    const attributions = new Map((await this.attributions.forLeads(rows.map((row) => row.id))).map((row) => [row.leadId, row]));
    return rows.map((row) => ({ ref: row.ref, status: row.status, categoryKey: row.categoryKey, createdAt: row.createdAt.toISOString(), referredByOrganizationId: attributions.get(row.id)?.organizationId ?? null }));
  }

  async erase(subject: PrivacySubject) {
    let closed = 0;
    for (const lead of await this.leads.listForParties(subject.partyIds)) {
      if (OPEN_LEAD_STATES.includes(lead.status)) {
        await this.leadService.act(lead.id, { event: LeadEvent.Lose, reason: LeadLostReason.other, note: `Data erasure ${subject.requestRef}` });
        closed += 1;
      }
      await this.leads.update(lead.id, { rawPayloadEnc: null });
    }
    return { leadsClosed: closed };
  }
}
