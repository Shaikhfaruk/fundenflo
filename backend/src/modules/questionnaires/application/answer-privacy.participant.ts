import { PrivacyParticipantFor } from '../../privacy/application/privacy-participant.registry.js';
import { PrivacySection } from '../../privacy/domain/privacy.constants.js';
import type { PrivacyParticipant, PrivacySubject } from '../../privacy/domain/privacy-participant.types.js';
import { AnswerRepository } from '../infrastructure/answer.repository.js';

const ANSWERS_EXPORT_LIMIT = 5_000;

@PrivacyParticipantFor(PrivacySection.Answers)
export class AnswerPrivacyParticipant implements PrivacyParticipant {
  constructor(private readonly answers: AnswerRepository) {}

  async export(subject: PrivacySubject) {
    return (await this.answers.listForParties(subject.partyIds, ANSWERS_EXPORT_LIMIT)).map((answer) => ({ question: answer.questionKey, value: answer.value, channel: answer.channel, answeredAt: answer.createdAt.toISOString() }));
  }

  async erase(subject: PrivacySubject) {
    return { answers: (await this.answers.deleteForParties(subject.partyIds)).count };
  }
}
