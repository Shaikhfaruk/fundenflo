import { describe, expect, it } from 'vitest';

import { NotificationChannel } from '../../../common/enums/db.enums.js';
import { NOTIFICATION_TEMPLATE_SEEDS } from '../../../scripts/seed-data/notification-templates.js';
import { NotificationTemplateKey } from './notification.constants.js';
import { templateIssues } from './template-rules.js';

describe('templateIssues', () => {
  it('accepts every seeded template', () => {
    for (const seed of NOTIFICATION_TEMPLATE_SEEDS) {
      expect(templateIssues({ key: seed.key as NotificationTemplateKey, channel: seed.channel, subject: seed.subject, body: seed.body }), `${seed.key}/${seed.channel}`).toEqual([]);
    }
  });

  it('rejects placeholders the sender does not provide', () => {
    expect(templateIssues({ key: NotificationTemplateKey.AnalysisCompleted, channel: NotificationChannel.sms, subject: null, body: 'Case {{ref}} for {{name}} is ready' })).toEqual([expect.objectContaining({ code: 'unknown_placeholder', message: expect.stringContaining('{{name}}') })]);
  });

  it('keeps the code in OTP messages and the link in consent requests', () => {
    expect(templateIssues({ key: NotificationTemplateKey.AuthOtp, channel: NotificationChannel.sms, subject: null, body: 'Your FundenFlo code expires in {{minutes}} minutes' }).map((issue) => issue.code)).toEqual(['placeholder_required']);
    expect(templateIssues({ key: NotificationTemplateKey.ConsentRequest, channel: NotificationChannel.sms, subject: null, body: 'Please confirm {{ref}}' }).map((issue) => issue.code)).toEqual(['placeholder_required']);
  });

  it('needs a subject for email and push and none for SMS', () => {
    expect(templateIssues({ key: NotificationTemplateKey.AnalysisCompleted, channel: NotificationChannel.push, subject: null, body: 'Case {{ref}} is ready' }).map((issue) => issue.path)).toEqual(['subject']);
    expect(templateIssues({ key: NotificationTemplateKey.AnalysisCompleted, channel: NotificationChannel.sms, subject: 'Ready', body: 'Case {{ref}} is ready' }).map((issue) => issue.code)).toEqual(['not_allowed']);
  });
});
