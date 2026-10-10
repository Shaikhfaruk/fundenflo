import { AppShell } from '@/components/shell/app-shell';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default function FinanceLayout({ children }: LayoutProps<'/[locale]/finance'>) {
  return <AppShell area={ShellArea.Staff}>{children}</AppShell>;
}
