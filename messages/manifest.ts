// Turbopack's `import.meta.glob` (docs/turbopack.md):
// - only resolves patterns that *descend* from the calling file (`./sub/*`
//   works; `../*` silently matches nothing, even for a single literal
//   existing path). This call therefore lives inside messages/ itself,
//   above the locale folders it globs, instead of in i18n/load-messages.ts
//   (which would need `../messages/*/*.json`).
// - for JSON files, `{ import: "default" }` resolves to `undefined`: the
//   parsed JSON *is* the eager module value, it isn't wrapped in
//   `{ default: ... }` the way a JS/TS module's `export default` would be.
//   Both points confirmed empirically against Next.js 16.3.6; neither is
//   documented.
const files = import.meta.glob("./*/*.json", { eager: true }) as Record<string, Record<string, unknown>>;

export default files;
