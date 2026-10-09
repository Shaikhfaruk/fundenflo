import { NotificationChannel, OrganizationStatus, OrganizationType, PartyKind } from '../../common/enums/db.enums.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { FUNDENFLO_ORGANIZATION_NAME } from '../../modules/access/domain/access.constants.js';
import type { NotificationTemplateKey } from '../../modules/notifications/domain/notification.constants.js';
import { DLT_TEMPLATE_ENV, NOTIFICATION_TEMPLATE_SEEDS, type TemplateSeed } from './notification-templates.js';

export type SeedResult = {
  organizationId: string;
  templates: number;
};

function dltTemplateId(template: TemplateSeed, env: NodeJS.ProcessEnv): string | null {
  if (template.channel !== NotificationChannel.sms) return null;
  const variable = DLT_TEMPLATE_ENV[template.key as NotificationTemplateKey];
  return (variable && env[variable]?.trim()) || null;
}

export async function runSeed(prisma: PrismaClient, env: NodeJS.ProcessEnv): Promise<SeedResult> {
  const organization =
    (await prisma.organization.findFirst({ where: { type: OrganizationType.fundenflo } })) ??
    (await prisma.$transaction(async (tx) => {
      const party = await tx.party.create({ data: { kind: PartyKind.business, displayName: FUNDENFLO_ORGANIZATION_NAME } });
      return tx.organization.create({
        data: { partyId: party.id, type: OrganizationType.fundenflo, name: FUNDENFLO_ORGANIZATION_NAME, status: OrganizationStatus.active },
      });
    }));

  for (const template of NOTIFICATION_TEMPLATE_SEEDS) {
    const providerTemplateId = dltTemplateId(template, env);
    await prisma.notificationTemplate.upsert({
      where: { key_channel_locale: { key: template.key, channel: template.channel, locale: template.locale } },
      create: { ...template, providerTemplateId },
      update: providerTemplateId ? { providerTemplateId } : {},
    });
  }

  return { organizationId: organization.id, templates: NOTIFICATION_TEMPLATE_SEEDS.length };
}
