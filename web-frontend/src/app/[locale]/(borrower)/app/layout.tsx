import { AppShell } from '@/components/shell/app-shell';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default function BorrowerLayout({ children }: LayoutProps<'/[locale]/app'>) {
  return <AppShell area={ShellArea.Borrower}>{children}</AppShell>;
}
