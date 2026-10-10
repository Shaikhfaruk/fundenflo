'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, useState } from 'react';

import { ChoiceChip } from '@/components/ui/choice';
import { Icon, isIconName } from '@/components/ui/icon';
import { IconInput } from '@/components/ui/icon-input';
import { IconTile } from '@/components/ui/icon-tile';
import { Spinner } from '@/components/ui/spinner';
import type { ChecklistItem, DocumentView } from '@/lib/api/types/document.types';
import { DEFAULT_DOCUMENT_ICON, DocumentStatus, IMAGE_MIME_PREFIX, PASSWORD_MAX_LENGTH, PDF_MIME_TYPE, PROCESSING_DOCUMENT_STATUSES } from '@/lib/constants/document.constants';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';
import { formatSizeLimit } from '@/lib/format/file-size';
import { cn } from '@/lib/utils';

export type UploadState = { phase: 'uploading'; fileName: string; progress: number } | { phase: 'failed'; message: string };

type Props = {
  item: ChecklistItem;
  rejected: DocumentView | null;
  upload: UploadState | undefined;
  requested: string[];
  locked: boolean;
  removingId: string | null;
  onUpload: (input: { file: File; documentType: string; password?: string }) => void;
  onCancel: () => void;
  onRemove: (documentId: string) => void;
  onView: (documentId: string) => void;
};

const sourceClass = 'relative flex min-h-11 flex-1 basis-[110px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-subtle px-2.5 text-[13px] font-semibold text-navy transition-colors hover:bg-[#e6ebf1] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';

export function DocumentSlotCard({ item, rejected, upload, requested, locked, removingId, onUpload, onCancel, onRemove, onView }: Props) {
  const t = useTranslations('flow.documents');
  const [typeKey, setTypeKey] = useState(item.documentTypes.find((entry) => requested.includes(entry.key))?.key ?? item.documentTypes[0]?.key ?? item.key);
  const requestedLabels = item.documentTypes.filter((entry) => requested.includes(entry.key)).map((entry) => entry.label ?? entry.key);
  const [withPassword, setWithPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const type = item.documentTypes.find((entry) => entry.key === typeKey) ?? item.documentTypes[0];
  const accepts = type?.acceptedMimeTypes ?? [PDF_MIME_TYPE];
  const takesPdf = accepts.includes(PDF_MIME_TYPE);
  const takesImages = accepts.some((mime) => mime.startsWith(IMAGE_MIME_PREFIX));
  const uploading = upload?.phase === 'uploading';
  const processing = item.documents.some((document) => PROCESSING_DOCUMENT_STATUSES.includes(document.status));
  const allVerified = item.documents.length > 0 && item.documents.every((document) => document.status === DocumentStatus.Verified);
  const showRejected = rejected !== null && !item.satisfied;
  const icon = isIconName(type?.icon) ? type.icon : DEFAULT_DOCUMENT_ICON;
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !type) return;
    if (!accepts.includes(file.type)) {
      setInvalid(t('wrongType'));
      return;
    }
    if (file.size > type.maxSizeBytes) {
      setInvalid(t('tooLarge', { limit: formatSizeLimit(type.maxSizeBytes) }));
      return;
    }
    setInvalid(null);
    onUpload({ file, documentType: type.key, password: withPassword && password ? password : undefined });
  };
  const badge = uploading ? (
    <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold text-navy tabular">{t('uploadingPercent', { percent: upload.progress })}</span>
  ) : processing ? (
    <Spinner className="mt-1 size-5 text-gold-ink" aria-label={t('checking')} />
  ) : item.satisfied ? (
    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] uppercase', allVerified ? 'bg-success-soft text-success' : 'bg-info-soft text-info')}>{allVerified ? t('verified') : t('received')}</span>
  ) : showRejected || upload?.phase === 'failed' ? (
    <span className="rounded-full bg-error-soft px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-destructive uppercase">{t('notAccepted')}</span>
  ) : (
    <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">{requestedLabels.length > 0 ? t('requested') : item.required ? t('pending') : t('optional')}</span>
  );
  const canAdd = !uploading && !locked;
  const sources = (
    <div className="flex flex-wrap gap-2">
      <label className={sourceClass}>
        <input type="file" className="sr-only" accept={accepts.join(',')} onChange={choose} disabled={!canAdd} aria-label={t('uploadFor', { name: item.label })} />
        <Icon name="upload" size={17} />
        {item.satisfied ? t('addAnother') : t('upload')}
      </label>
      {takesImages ? (
        <label className={cn(sourceClass, 'sm:hidden')}>
          <input type="file" className="sr-only" accept={accepts.filter((mime) => mime.startsWith(IMAGE_MIME_PREFIX)).join(',')} capture="environment" onChange={choose} disabled={!canAdd} aria-label={t('scanFor', { name: item.label })} />
          <Icon name="scan" size={17} />
          {t('scan')}
        </label>
      ) : null}
    </div>
  );
  return (
    <motion.article layout transition={{ duration: Duration.Fast }} className="flex flex-col gap-3.5 rounded-xl bg-card p-4 shadow-card" aria-label={item.required ? item.label : t('optionalLabel', { name: item.label })}>
      <div className="flex items-start gap-3.5">
        <IconTile icon={icon} size="lg" tone={item.satisfied ? 'success' : 'subtle'} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <h3 className="font-heading text-[17px] leading-6 font-semibold text-foreground">{item.label}</h3>
          {uploading ? <p className="truncate text-[13px] text-muted-foreground">{t('uploadingFile', { name: upload.fileName })}</p> : item.description ? <p className="text-[13px]/[19px] text-muted-foreground">{item.description}</p> : null}
        </div>
        {badge}
      </div>
      {requestedLabels.length > 0 ? (
        <p className="flex items-center gap-1.5 rounded-sm bg-gold-soft px-2.5 py-1.5 text-xs font-semibold text-[#5d4200]">
          <Icon name="info" size={14} />
          {t('lenderWants', { names: requestedLabels.join(', ') })}
        </p>
      ) : null}
      {item.documentTypes.length > 1 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{t('uploadAs')}</span>
          <div className="flex flex-wrap gap-2">
            {item.documentTypes.map((entry) => (
              <ChoiceChip key={entry.key} selected={entry.key === typeKey} label={entry.label ?? entry.key} onToggle={() => setTypeKey(entry.key)} className="min-h-9 text-[13px]" />
            ))}
          </div>
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {uploading ? (
          <motion.div key="progress" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
              <motion.div className="h-full rounded-full bg-gold" initial={{ width: 0 }} animate={{ width: `${upload.progress}%` }} transition={{ duration: Duration.Fast, ease: EASE_OUT }} />
            </div>
            <button type="button" onClick={onCancel} className="min-h-8 text-xs font-semibold text-navy">
              {t('cancel')}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {item.documents.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {item.documents.map((document) => {
            const busy = PROCESSING_DOCUMENT_STATUSES.includes(document.status);
            return (
              <li key={document.id} className="flex items-center gap-2 rounded-lg bg-subtle/60 px-2.5 py-2">
                <Icon name="document" size={15} className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{document.fileName}</span>
                <span className={cn('flex items-center gap-1 text-[11px] font-semibold', document.status === DocumentStatus.Verified ? 'text-success' : busy ? 'text-gold-ink' : 'text-info')}>
                  {document.status === DocumentStatus.Verified ? <Icon name="check-circle" size={13} /> : null}
                  {busy ? t('checking') : document.status === DocumentStatus.Verified ? t('verifiedByCheck') : t('withTeam')}
                </span>
                <button type="button" onClick={() => onView(document.id)} disabled={busy} className="flex size-8 items-center justify-center rounded-md text-navy hover:bg-card disabled:opacity-40" aria-label={t('view', { name: document.fileName })}>
                  <Icon name="visibility" size={16} />
                </button>
                {locked ? null : (
                  <button type="button" onClick={() => onRemove(document.id)} disabled={removingId === document.id} className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-destructive disabled:opacity-40" aria-label={t('remove', { name: document.fileName })}>
                    {removingId === document.id ? <Spinner className="size-4" /> : <Icon name="delete" size={16} />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      <AnimatePresence initial={false}>
        {invalid || upload?.phase === 'failed' || showRejected ? (
          <motion.p key="error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-1.5 rounded-sm bg-error-soft px-2.5 py-2 text-xs/[17px] text-destructive" role="alert">
            <Icon name="error" size={15} className="mt-px" />
            <span>{invalid ?? (upload?.phase === 'failed' ? upload.message : rejected ? t('rejected', { name: rejected.fileName, reason: t(`reasons.${rejected.rejectReason ?? 'other'}`) }) : null)}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>
      {item.satisfied && !uploading ? (
        <div className="flex">{sources}</div>
      ) : uploading ? null : (
        <div className="flex flex-col gap-2.5">
          {sources}
          {takesPdf ? (
            withPassword ? (
              <div className="flex flex-col gap-1">
                <IconInput icon="key" type="password" value={password} maxLength={PASSWORD_MAX_LENGTH} onChange={(event) => setPassword(event.target.value)} placeholder={t('passwordPlaceholder')} aria-label={t('passwordLabel', { name: item.label })} revealLabel={{ show: t('showPassword'), hide: t('hidePassword') }} autoComplete="off" />
                <span className="px-1 text-[11px] text-muted-foreground">{t('passwordHint')}</span>
              </div>
            ) : (
              <button type="button" onClick={() => setWithPassword(true)} className="self-start px-1 text-xs font-semibold text-gold-ink underline-offset-4 hover:underline">
                {t('hasPassword')}
              </button>
            )
          ) : null}
        </div>
      )}
    </motion.article>
  );
}
