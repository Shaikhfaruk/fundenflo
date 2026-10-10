import { AppShell } from '@/components/shell/app-shell';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default function PartnerLayout({ children }: LayoutProps<'/[locale]/partner'>) {
  return <AppShell area={ShellArea.Partner}>{children}</AppShell>;
}
