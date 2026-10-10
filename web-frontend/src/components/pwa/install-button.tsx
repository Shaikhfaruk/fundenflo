'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallButton({ variant = 'outline' }: { variant?: 'outline' | 'ghost' | 'default' }) {
  const t = useTranslations('pwa');
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const clear = () => setPromptEvent(null);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', clear);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', clear);
    };
  }, []);
  if (!promptEvent) return null;
  return (
    <Button
      variant={variant}
      onClick={async () => {
        await promptEvent.prompt();
        await promptEvent.userChoice;
        setPromptEvent(null);
      }}
    >
      <Download />
      {t('install')}
    </Button>
  );
}
