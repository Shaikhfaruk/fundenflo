import { JourneyModeProvider } from '@/components/journey/journey-mode';
import { AppShell } from '@/components/shell/app-shell';
import { JourneyMode } from '@/lib/constants/journey.constants';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default function PartnerLayout({ children }: LayoutProps<'/[locale]/partner'>) {
  return (
    <AppShell area={ShellArea.Partner}>
      <JourneyModeProvider mode={JourneyMode.Partner}>{children}</JourneyModeProvider>
    </AppShell>
  );
}
