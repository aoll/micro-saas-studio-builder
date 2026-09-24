import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui's `cn()`, aliased to `@/components/utils` instead of the usual
// `lib/utils.ts` (components.json `utils` alias): decision 3 of
// .claude/plans/CONTRACT-ui.plan.md, so shadcn stays a self-contained
// `components/**` tree, departing from docs/09-arborescence.md's
// `lib/utils.ts` on purpose (recorded in the PR body).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
