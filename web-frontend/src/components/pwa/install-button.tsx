'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallButton({ variant = 'outline', className }: { variant?: 'outline' | 'ghost' | 'default' | 'gold'; className?: string }) {
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
      className={className}
      onClick={async () => {
        await promptEvent.prompt();
        await promptEvent.userChoice;
        setPromptEvent(null);
      }}
    >
      <Icon name="install" size={18} />
      {t('install')}
    </Button>
  );
}
