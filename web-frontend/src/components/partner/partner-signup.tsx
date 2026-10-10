'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/data/empty-state';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { ChoiceChip, ChoiceRow } from '@/components/ui/choice';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { SecureNote } from '@/components/ui/secure-note';
import { Spinner } from '@/components/ui/spinner';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { segmentsQuery, statesQuery } from '@/lib/api/catalog';
import { partnerSignup } from '@/lib/api/partners';
import { MembershipStatus, SessionContext } from '@/lib/constants/auth.constants';
import { PartnerKind, SERVICE_LANGUAGES } from '@/lib/constants/partner.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { switchContext } from '@/lib/session/client-session';
import { useMe } from '@/lib/session/use-me';

const PINCODE = /^\d{6}$/;
const KINDS: readonly { id: string; icon: IconName }[] = [
  { id: PartnerKind.Ca, icon: 'receipt' },
  { id: PartnerKind.Dsa, icon: 'store' },
  { id: PartnerKind.Connector, icon: 'link' },
];

const toggle = (values: string[], value: string) => (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</h2>
      {children}
    </section>
  );
}

export function PartnerSignup() {
  const t = useTranslations('partner.signup');
  const tLanguages = useTranslations('languages');
  const router = useRouter();
  const queryClient = useQueryClient();
  const toastError = useErrorToast();
  const { refetch: refetchMe } = useMe();
  const segments = useQuery(segmentsQuery());
  const states = useQuery(statesQuery());
  const [kind, setKind] = useState<string>(PartnerKind.Ca);
  const [firmName, setFirmName] = useState('');
  const [membershipNumber, setMembershipNumber] = useState('');
  const [chosenSegments, setChosenSegments] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [stateCodes, setStateCodes] = useState<string[]>([]);
  const [pincodes, setPincodes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [received, setReceived] = useState(false);
  const submit = useMutation({
    mutationFn: async () => {
      const pins = pincodes.split(',').map((value) => value.trim()).filter(Boolean);
      if (pins.some((pin) => !PINCODE.test(pin))) throw new ApiError(400, { code: 'VALIDATION_FAILED', message: t('invalidPincode'), details: [{ path: 'pincodes', code: 'invalid', message: t('invalidPincode') }] });
      return partnerSignup({
        kind,
        firmName: firmName.trim(),
        membershipNumber: membershipNumber.trim() || undefined,
        segments: chosenSegments,
        languages,
        serviceAreas: [...stateCodes.map((stateGstCode) => ({ stateGstCode })), ...pins.map((pincode) => ({ pincode }))],
      });
    },
    meta: { handlesError: true },
    onSuccess: async (profile) => {
      toast.success(t('submitted'));
      const me = (await refetchMe()).data;
      const membership = me?.memberships.find((item) => item.context === SessionContext.Partner && item.organization?.id === profile.organizationId);
      if (membership?.status === MembershipStatus.Active) {
        await switchContext({ membershipId: membership.id });
        queryClient.clear();
        router.replace(AppPath.PartnerHome);
        return;
      }
      setReceived(true);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fieldIssues.length > 0) setErrors(Object.fromEntries(error.fieldIssues.map((issue) => [issue.path.split('.')[0], issue.message])));
      else toastError(error);
    },
  });
  if (received) {
    return (
      <EmptyState
        icon="hourglass"
        title={t('receivedTitle')}
        body={t('receivedBody')}
        action={
          <ButtonLink variant="outline" href={AppPath.AccountSwitch}>
            {t('receivedRoles')}
          </ButtonLink>
        }
      />
    );
  }
  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setErrors({});
        submit.mutate();
      }}
    >
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} description={t('description')} />
      <Section label={t('kind')}>
        <Stagger step={0.06} className="flex flex-col gap-2">
          {KINDS.map((item) => (
            <StaggerItem key={item.id}>
              <ChoiceRow selected={kind === item.id} onSelect={() => setKind(item.id)} icon={item.icon} title={t(`kinds.${item.id}`)} description={t(`kindHints.${item.id}`)} />
            </StaggerItem>
          ))}
        </Stagger>
      </Section>
      <Field data-invalid={Boolean(errors.firmName)}>
        <FieldLabel htmlFor="firmName">{t('firmName')}</FieldLabel>
        <Input id="firmName" autoComplete="organization" value={firmName} onChange={(event) => setFirmName(event.target.value)} aria-invalid={Boolean(errors.firmName)} required />
        {errors.firmName ? <FieldError>{errors.firmName}</FieldError> : null}
      </Field>
      {kind === PartnerKind.Ca ? (
        <Field data-invalid={Boolean(errors.membershipNumber)}>
          <FieldLabel htmlFor="membershipNumber">{t('membershipNumber')}</FieldLabel>
          <Input id="membershipNumber" inputMode="numeric" value={membershipNumber} onChange={(event) => setMembershipNumber(event.target.value)} aria-invalid={Boolean(errors.membershipNumber)} />
          <FieldDescription>{t('membershipHint')}</FieldDescription>
          {errors.membershipNumber ? <FieldError>{errors.membershipNumber}</FieldError> : null}
        </Field>
      ) : null}
      <Section label={t('segments')}>
        <div className="flex flex-wrap gap-2">
          {segments.data?.items.map((segment) => (
            <ChoiceChip key={segment.key} selected={chosenSegments.includes(segment.key)} label={segment.label} onToggle={() => setChosenSegments((values) => toggle(values, segment.key))} />
          ))}
        </div>
      </Section>
      <Section label={t('languages')}>
        <div className="flex flex-wrap gap-2">
          {SERVICE_LANGUAGES.map((code) => (
            <ChoiceChip key={code} selected={languages.includes(code)} label={tLanguages(code)} onToggle={() => setLanguages((values) => toggle(values, code))} />
          ))}
        </div>
      </Section>
      <Section label={t('states')}>
        <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto rounded-xl bg-subtle p-3">
          {states.data?.items.map((state) => (
            <ChoiceChip key={state.gstCode} selected={stateCodes.includes(state.gstCode)} label={state.name} onToggle={() => setStateCodes((values) => toggle(values, state.gstCode))} className="min-h-10 text-[13px]" />
          ))}
        </div>
      </Section>
      <Field data-invalid={Boolean(errors.pincodes ?? errors.serviceAreas)}>
        <FieldLabel htmlFor="pincodes">{t('pincodes')}</FieldLabel>
        <Input id="pincodes" inputMode="numeric" value={pincodes} onChange={(event) => setPincodes(event.target.value)} aria-invalid={Boolean(errors.pincodes ?? errors.serviceAreas)} />
        <FieldDescription>{t('pincodesHint')}</FieldDescription>
        {(errors.pincodes ?? errors.serviceAreas) ? <FieldError>{errors.pincodes ?? errors.serviceAreas}</FieldError> : null}
      </Field>
      <Button type="submit" className="mt-2 w-full" disabled={!firmName.trim() || submit.isPending}>
        {submit.isPending ? <Spinner /> : null}
        {t('submit')}
        {submit.isPending ? null : <Icon name="arrow-forward" size={18} />}
      </Button>
      <SecureNote>{t('secure')}</SecureNote>
    </form>
  );
}
