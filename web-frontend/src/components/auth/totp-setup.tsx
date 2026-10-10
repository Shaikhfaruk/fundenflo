'use client';

import { Copy } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

const QR_SIZE = 192;

export function TotpSetup({ otpauthUrl, secret }: { otpauthUrl: string; secret: string }) {
  const t = useTranslations('auth.staff');
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(otpauthUrl, { margin: 1, width: QR_SIZE, errorCorrectionLevel: 'M' }).then(setImage);
  }, [otpauthUrl]);
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">{t('setupBody')}</p>
      {image ? <Image src={image} alt={t('setupTitle')} width={QR_SIZE} height={QR_SIZE} unoptimized className="rounded-lg bg-white p-2" /> : <div className="size-48 animate-pulse rounded-lg bg-muted" />}
      <div className="flex w-full flex-col gap-1">
        <span className="text-xs text-muted-foreground">{t('setupKey')}</span>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-background px-2 py-1 font-mono text-sm tabular">{secret}</code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('copyKey')}
            onClick={async () => {
              await navigator.clipboard.writeText(secret);
              toast.success(t('copied'));
            }}
          >
            <Copy />
          </Button>
        </div>
      </div>
    </div>
  );
}
