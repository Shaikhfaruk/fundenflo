import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { NotificationPreferenceRepository } from '../infrastructure/notification-preference.repository.js';
import { toPreferenceView } from './notification.views.js';

@PrivacyParticipantFor(PrivacySection.NotificationPreferences)
export class NotificationPreferencePrivacyParticipant implements PrivacyParticipant {
  constructor(private readonly preferences: NotificationPreferenceRepository) {}

  async export(subject: PrivacySubject) {
    return subject.userId ? toPreferenceView(await this.preferences.find(subject.userId)) : null;
  }

  async erase(subject: PrivacySubject) {
    return { preferences: subject.userId ? (await this.preferences.delete(subject.userId)).count : 0 };
  }
}
