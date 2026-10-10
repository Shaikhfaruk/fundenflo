import { AppShell } from '@/components/shell/app-shell';
import { ShellArea } from '@/lib/constants/navigation.constants';

export default function LenderLayout({ children }: LayoutProps<'/[locale]/lender'>) {
  return <AppShell area={ShellArea.Lender}>{children}</AppShell>;
}
