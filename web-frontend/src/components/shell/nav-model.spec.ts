import { describe, expect, it } from 'vitest';

import { Role } from '@/lib/constants/auth.constants';
import { ShellArea } from '@/lib/constants/navigation.constants';
import { activeHref, navigationFor } from './nav-model';

const staffKeys = (role: string) => navigationFor(ShellArea.Staff, role).flatMap((group) => group.items.map((item) => item.key));

describe('navigation', () => {
  it('gives a person without a role only the account and role switcher', () => {
    expect(navigationFor('none', undefined).flatMap((group) => group.items.map((item) => item.key))).toEqual(['switchRole', 'account']);
  });

  it('picks the most specific active item', () => {
    const items = navigationFor(ShellArea.Borrower, Role.Borrower).flatMap((group) => group.items);
    expect(activeHref(items, '/app/applications/new')).toBe('/app/applications/new');
    expect(activeHref(items, '/app/applications/123')).toBe('/app');
    expect(activeHref(items, '/elsewhere')).toBeNull();
  });

  it('shows staff items only to roles that can use them', () => {
    expect(staffKeys(Role.OpsLead)).toContain('leads');
    expect(staffKeys(Role.Finance)).not.toContain('leads');
  });
});
