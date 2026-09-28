import { createNavigation } from "next-intl/navigation";
import { marketingRouting } from "./marketing-routing";

// Only what the marketing group actually uses (knip is part of
// `pnpm check`, docs/10-tooling-dev.md): `Link` for internal navigation to
// `/making-of` that must keep the current locale's prefix, and
// `getPathname` for the locale switcher, which needs a plain `<a href>`
// (finding 4 of the plan: a soft `<Link>` navigation between `/` and `/en`
// could reuse the shared root layout segment and leave a stale
// `<html lang>`).
export const { Link, getPathname } = createNavigation(marketingRouting);
