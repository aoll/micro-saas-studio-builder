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
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className="block rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground"
    >
      {children}
    </Link>
  );
}
