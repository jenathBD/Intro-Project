'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  // '/' må kun matche præcist – ellers ville Overblik være aktiv på alle sider.
  // Andre links er også aktive på undersider, fx /projekter/42.
  const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} aria-current={isActive ? 'page' : undefined}>
      {children}
    </Link>
  );
}
