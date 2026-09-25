import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadMessages } from "./load-messages";

// I18N-SEO (specs/I18N-SEO.md): a repo-wide guard on top of each zone's own
// fr/en parity test (messages/landing.test.ts, messages/pricing.test.ts…),
// which only cover the zones their own spec shipped. This one walks every
// zone file that exists today, so a future spec's zone is covered for free.

const MESSAGES_ROOT = path.join(process.cwd(), "messages");
type Locale = "fr" | "en";

function zoneFiles(locale: Locale): string[] {
  return readdirSync(path.join(MESSAGES_ROOT, locale))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function readZone(locale: Locale, file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(MESSAGES_ROOT, locale, file), "utf8")) as Record<string, unknown>;
}

// Every leaf value's path, e.g. `header.credits`.
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

// ICU argument names, e.g. `count` in `{count, plural, one {# crédit}
// other {# crédits}}` or `name` in `{name} · pack`. An argument name is
// only recognized when the identifier right after `{` is immediately
// followed by `,` or `}` (an argument declaration); a nested plural/select
// branch's text, e.g. `one {Costs # credit per generation}`, starts with a
// word too but is followed by more text, not `,`/`}`, so it is not matched.
function icuArgs(value: string): string[] {
  const matches = value.matchAll(/\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*[,}]/g);
  return [...new Set([...matches].map((match) => match[1]!))].sort();
}

function collectIcuArgs(value: unknown, prefix = ""): Record<string, string[]> {
  if (typeof value === "string") return { [prefix]: icuArgs(value) };
  if (typeof value !== "object" || value === null) return {};
  return Object.entries(value).reduce<Record<string, string[]>>((acc, [key, child]) => {
    Object.assign(acc, collectIcuArgs(child, prefix ? `${prefix}.${key}` : key));
    return acc;
  }, {});
}

// Every `useTranslations("ns")` / `getTranslations("ns")` (or `"ns.sub"`)
// call under the sub-app and its shared product components: the namespace
// (text before the first dot) must be a zone that both locales carry.
function scanNamespaces(dir: string): Set<string> {
  const namespaces = new Set<string>();
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true }) as unknown as {
    name: string;
    parentPath: string;
  }[];
  for (const entry of entries) {
    if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
    const filePath = path.join(entry.parentPath, entry.name);
    const source = readFileSync(filePath, "utf8");
    for (const match of source.matchAll(/\b(?:useTranslations|getTranslations)\(\s*["']([^"']+)["']/g)) {
      namespaces.add(match[1]!.split(".")[0]!);
    }
  }
  return namespaces;
}

describe("messages/{fr,en} parity", () => {
  it("has the exact same zone files in fr and en", () => {
    expect(zoneFiles("en")).toEqual(zoneFiles("fr"));
  });

  for (const file of zoneFiles("fr")) {
    describe(file, () => {
      it("has identical key paths in fr and en", () => {
        const fr = keyPaths(readZone("fr", file)).sort();
        const en = keyPaths(readZone("en", file)).sort();
        expect(en).toEqual(fr);
      });

      it("has identical ICU arguments per key in fr and en", () => {
        const fr = collectIcuArgs(readZone("fr", file));
        const en = collectIcuArgs(readZone("en", file));
        for (const key of Object.keys(fr)) {
          expect(en[key], `ICU arguments for "${file}" › "${key}"`).toEqual(fr[key]);
        }
      });
    });
  }
});

describe('loadMessages("en")', () => {
  it("resolves the exact same zone set as fr", async () => {
    const fr = await loadMessages("fr");
    const en = await loadMessages("en");
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
});

describe("namespace usage under app/(products) and components/product", () => {
  it("only references zones that exist in both locales", () => {
    const zones = new Set(zoneFiles("fr").map((file) => file.replace(/\.json$/, "")));
    const used = new Set([
      ...scanNamespaces(path.join(process.cwd(), "app", "(products)")),
      ...scanNamespaces(path.join(process.cwd(), "components", "product")),
    ]);
    for (const namespace of used) {
      expect(zones.has(namespace), `namespace "${namespace}" has no messages/{fr,en}/${namespace}.json`).toBe(true);
    }
  });

  it("found at least one namespace (guards a broken scan)", () => {
    const used = new Set([
      ...scanNamespaces(path.join(process.cwd(), "app", "(products)")),
      ...scanNamespaces(path.join(process.cwd(), "components", "product")),
    ]);
    expect(used.size).toBeGreaterThan(0);
  });
});
