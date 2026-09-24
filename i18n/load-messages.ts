import type { ProductConfig } from "@/lib/schemas/product-config";
import files from "@/messages/manifest";

// One zone file per namespace (docs/09-arborescence.md, messages/{fr,en}/*.json):
// each spec adds its own `messages/<locale>/<zone>.json`, picked up
// automatically by messages/manifest.ts's `import.meta.glob` (moved there:
// Turbopack's glob only resolves descending patterns, see that file).

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
    if (!path.includes(`/${locale}/`)) continue;
    messages[zoneName(path)] = content;
  }
  // Never render a page with silently missing translations (the Turbopack
  // glob regression that fixed by messages/manifest.ts, docs/11
  // "no silent failure"): an empty result or a locale without its common
  // zone means messages/manifest.ts stopped globbing files, not that this
  // product genuinely has none.
  if (Object.keys(messages).length === 0 || !("common" in messages)) {
    throw new Error(`loadMessages(${locale}): no messages resolved, check messages/manifest.ts`);
  }
  return messages;
}
