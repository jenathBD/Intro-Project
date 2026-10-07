import { CollapsibleNav } from '@/components/collapsible-nav';
import { NavLink } from '@/components/nav-link';

const NAV_ITEMS = [
  { href: '/', label: 'Overblik' },
  { href: '/projekter', label: 'Projekter' },
  { href: '/allokering', label: 'Allokering' },
  { href: '/medarbejdere', label: 'Medarbejdere' }];

export function Sidebar() {
  return (
    <CollapsibleNav>
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} href={item.href}>
          {item.label}
        </NavLink>
      ))}
    </CollapsibleNav>
  );
}
