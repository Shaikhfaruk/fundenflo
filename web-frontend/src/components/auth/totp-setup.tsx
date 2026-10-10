'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Icon } from '@/components/ui/icon';
import { Duration, EASE_OUT } from '@/lib/constants/motion.constants';

const QR_SIZE = 168;
const QR_COLOR = { dark: '#0a192f', light: '#ffffff' } as const;

export function TotpSetup({ otpauthUrl, secret }: { otpauthUrl: string; secret: string }) {
  const t = useTranslations('auth.staff');
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(otpauthUrl, { margin: 1, width: QR_SIZE * 2, errorCorrectionLevel: 'M', color: QR_COLOR }).then(setImage);
  }, [otpauthUrl]);
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-subtle p-4">
      <div className="relative rounded-xl bg-card p-2 shadow-card">
        {image ? (
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: Duration.Base, ease: EASE_OUT }}>
            <Image src={image} alt={t('setupTitle')} width={QR_SIZE} height={QR_SIZE} unoptimized />
          </motion.div>
        ) : (
          <div className="size-[168px] rounded-lg skeleton-shimmer" />
        )}
      </div>
      <div className="flex w-full flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{t('setupKey')}</span>
        <div className="flex items-center gap-2 rounded-lg bg-card py-1 pr-1 pl-3">
          <code className="flex-1 truncate font-mono text-sm font-semibold text-navy tabular">{secret}</code>
          <button
            type="button"
            aria-label={t('copyKey')}
            className="flex size-9 items-center justify-center rounded-md text-navy hover:bg-subtle"
            onClick={async () => {
              await navigator.clipboard.writeText(secret);
              toast.success(t('copied'));
            }}
          >
            <Icon name="copy" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
