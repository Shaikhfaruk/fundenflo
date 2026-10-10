'use client';

import { useTranslations } from 'next-intl';

import { Icon } from '@/components/ui/icon';
import type { LeadContact } from '@/lib/api/types/lead.types';
import { formatPhone } from '@/lib/format/phone';

export function LeadContacts({ contacts }: { contacts: LeadContact[] }) {
  const t = useTranslations('leadWork');
  return (
    <ul className="flex flex-col gap-2">
      {contacts.map((contact) => (
        <li key={`${contact.type}-${contact.masked}`} className="flex flex-wrap items-center gap-2 text-sm">
          <Icon name={contact.type === 'email' ? 'mail' : 'phone'} size={16} className="text-muted-foreground" />
          {contact.value && contact.type === 'mobile' ? (
            <a href={`tel:${contact.value}`} className="font-semibold text-foreground tabular select-all hover:underline">
              {formatPhone(contact.value)}
            </a>
          ) : (
            <span className="font-semibold text-foreground tabular select-all">{contact.value ?? contact.masked}</span>
          )}
          {contact.primary ? <span className="rounded-xs bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{t('primary')}</span> : null}
          {contact.doNotContact ? <span className="rounded-xs bg-error-soft px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{t('doNotContact')}</span> : null}
          {contact.invalid ? <span className="rounded-xs bg-error-soft px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{t('invalid')}</span> : null}
        </li>
      ))}
    </ul>
  );
}
