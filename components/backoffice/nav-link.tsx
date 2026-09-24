"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// docs/02-ecrans.md › backoffice navigation: highlights the current page.
export function NavLink({ href, children }: { href: Route; children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href;
  return (
    <Link href={href} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
