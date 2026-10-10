import { AppShell } from '@/components/shell/app-shell';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default function OpsLayout({ children }: LayoutProps<'/[locale]/ops'>) {
  return <AppShell area={ShellArea.Staff}>{children}</AppShell>;
}
