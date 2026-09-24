import type { ProductConfig } from "@/lib/schemas/product-config";

// One zone file per namespace (docs/09-arborescence.md, messages/{fr,en}/*.json):
// each spec adds its own `messages/<locale>/<zone>.json`, picked up here
// automatically. `import.meta.glob` is eager so the bundle only ships the
// active locale's messages (Turbopack and Vite both support it,
// .claude/plans/CONTRACT-ui.plan.md). Untyped here: Next's own
// `ImportMeta.glob` (node_modules/next/types/global.d.ts) and Vite's are
// both non-generic-or-incompatible once merged, so the cast happens where
// the result is consumed instead of at the call site.
const files = import.meta.glob("../messages/*/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;

// Namespace: the zone file's base name (`common.json` -> `common`).
function zoneName(path: string): string {
  return path
    .split("/")
    .pop()!
    .replace(/\.json$/, "");
}

export async function loadMessages(locale: ProductConfig["locale"]): Promise<Record<string, unknown>> {
  const messages: Record<string, unknown> = {};
  for (const [path, content] of Object.entries(files)) {
    if (!path.includes(`/messages/${locale}/`)) continue;
    messages[zoneName(path)] = content;
  }
  return messages;
}
