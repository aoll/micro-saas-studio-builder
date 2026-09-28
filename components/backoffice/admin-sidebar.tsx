import { getSession } from "@/lib/dal/session";
import { NavLink } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

// Same admin/owner check as lib/dal/session.ts's requireAdmin, duplicated
// here on purpose: requireAdmin() redirects to /admin/login, which would
// loop when this sidebar renders on the login page itself (it doesn't:
// (backoffice)/layout.tsx wraps /admin/login too). null (not a redirect)
// when there is no admin session.
const ADMIN_ROLES = new Set(["admin", "owner"]);

export async function AdminSidebar() {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.has(session.user.role)) return null;

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r bg-card/60 p-4 backdrop-blur">
      <ul className="grid gap-1">
        <li>
          <NavLink href="/admin">Portefeuille</NavLink>
        </li>
        <li>
          <NavLink href="/admin/themes">Thèmes</NavLink>
        </li>
        <li>
          <NavLink href="/admin/settings">Réglages</NavLink>
        </li>
      </ul>
      <SignOutButton />
    </nav>
  );
}
