import { AppShell } from '@/components/shell/app-shell';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default function AdminLayout({ children }: LayoutProps<'/[locale]/admin'>) {
  return <AppShell area={ShellArea.Staff}>{children}</AppShell>;
}
