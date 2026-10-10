'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hourglass } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { useErrorToast } from '@/hooks/use-error-toast';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/api-error';
import { segmentsQuery, statesQuery } from '@/lib/api/catalog';
import { partnerSignup } from '@/lib/api/partners';
import { PartnerKind, SERVICE_LANGUAGES } from '@/lib/constants/partner.constants';
import { AppPath } from '@/lib/constants/routes.constants';
import { MembershipStatus, SessionContext } from '@/lib/constants/auth.constants';
import { switchContext } from '@/lib/session/client-session';
import { useMe } from '@/lib/session/use-me';

const PINCODE = /^\d{6}$/;
const KINDS = Object.values(PartnerKind);

const toggle = (values: string[], value: string, on: boolean) => (on ? [...new Set([...values, value])] : values.filter((item) => item !== value));

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
      <Empty className="max-w-xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Hourglass />
          </EmptyMedia>
          <EmptyTitle>{t('receivedTitle')}</EmptyTitle>
          <EmptyDescription>{t('receivedBody')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <ButtonLink variant="outline" href={AppPath.AccountSwitch}>
            {t('receivedRoles')}
          </ButtonLink>
        </EmptyContent>
      </Empty>
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={t('title')} description={t('description')} />
      <Card>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setErrors({});
              submit.mutate();
            }}
          >
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">{t('kind')}</FieldLegend>
                <RadioGroup value={kind} onValueChange={(value) => setKind(String(value))} className="grid gap-2 sm:grid-cols-3">
                  {KINDS.map((value) => (
                    <label key={value} className="flex items-center gap-2 rounded-lg border p-3 text-sm has-data-checked:border-primary/40 has-data-checked:bg-primary/5">
                      <RadioGroupItem value={value} />
                      {t(`kinds.${value}`)}
                    </label>
                  ))}
                </RadioGroup>
              </FieldSet>
              <Field data-invalid={Boolean(errors.firmName)}>
                <FieldLabel htmlFor="firmName">{t('firmName')}</FieldLabel>
                <Input id="firmName" autoComplete="organization" value={firmName} onChange={(event) => setFirmName(event.target.value)} required />
                {errors.firmName ? <FieldError>{errors.firmName}</FieldError> : null}
              </Field>
              {kind === PartnerKind.Ca ? (
                <Field data-invalid={Boolean(errors.membershipNumber)}>
                  <FieldLabel htmlFor="membershipNumber">{t('membershipNumber')}</FieldLabel>
                  <Input id="membershipNumber" inputMode="numeric" value={membershipNumber} onChange={(event) => setMembershipNumber(event.target.value)} />
                  <FieldDescription>{t('membershipHint')}</FieldDescription>
                  {errors.membershipNumber ? <FieldError>{errors.membershipNumber}</FieldError> : null}
                </Field>
              ) : null}
              <FieldSet>
                <FieldLegend variant="label">{t('segments')}</FieldLegend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {segments.data?.items.map((segment) => (
                    <label key={segment.key} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={chosenSegments.includes(segment.key)} onCheckedChange={(on) => setChosenSegments((values) => toggle(values, segment.key, on))} />
                      {segment.label}
                    </label>
                  ))}
                </div>
              </FieldSet>
              <FieldSet>
                <FieldLegend variant="label">{t('languages')}</FieldLegend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SERVICE_LANGUAGES.map((code) => (
                    <label key={code} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={languages.includes(code)} onCheckedChange={(on) => setLanguages((values) => toggle(values, code, on))} />
                      {tLanguages(code)}
                    </label>
                  ))}
                </div>
              </FieldSet>
              <FieldSet>
                <FieldLegend variant="label">{t('states')}</FieldLegend>
                <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                  {states.data?.items.map((state) => (
                    <label key={state.gstCode} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={stateCodes.includes(state.gstCode)} onCheckedChange={(on) => setStateCodes((values) => toggle(values, state.gstCode, on))} />
                      {state.name}
                    </label>
                  ))}
                </div>
              </FieldSet>
              <Field data-invalid={Boolean(errors.pincodes ?? errors.serviceAreas)}>
                <FieldLabel htmlFor="pincodes">{t('pincodes')}</FieldLabel>
                <Input id="pincodes" inputMode="numeric" value={pincodes} onChange={(event) => setPincodes(event.target.value)} />
                <FieldDescription>{t('pincodesHint')}</FieldDescription>
                {errors.pincodes ?? errors.serviceAreas ? <FieldError>{errors.pincodes ?? errors.serviceAreas}</FieldError> : null}
              </Field>
            </FieldGroup>
            <Button type="submit" size="lg" className="self-start" disabled={!firmName.trim() || submit.isPending}>
              {submit.isPending ? <Spinner /> : null}
              {t('submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
