#!/usr/bin/env node
// Patches the built Understand-Anything dashboard bundle (public/architecture/assets/index-*.js)
// to add an "MSB Light" theme preset (mk-theme colors) and make it the default, and an "MSB Blue"
// accent swatch. Re-run after any `architecture-graph` skill regeneration, since the bundle hash
// and this patch both come from the same `vite build` output.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [, , dir] = process.argv;
if (!dir) {
  console.error("usage: node apply-mk-theme.mjs <public/architecture/assets dir>");
  process.exit(1);
}

const files = readdirSync(dir)
  .filter((f) => /^index-.*\.js$/.test(f))
  .map((f) => join(dir, f));
if (files.length !== 1) {
  throw new Error(`expected exactly one index-*.js in ${dir}, found ${files.length}: ${files.join(", ")}`);
}
const file = files[0];
let src = readFileSync(file, "utf8");

function replaceOnce(str, search, replace, label) {
  const count = str.split(search).length - 1;
  if (count !== 1) {
    throw new Error(`anchor for "${label}" found ${count} time(s), expected 1 — dashboard build likely changed, update this script`);
  }
  return str.replace(search, replace);
}

// 1. New accent swatch, appended to the light-theme accent swatches array (Aqn in this build).
src = replaceOnce(
  src,
  '{id:"slate",name:"Slate",accent:"#5a6570",accentDim:"#4e5860",accentBright:"#6e7a85"}]',
  '{id:"slate",name:"Slate",accent:"#5a6570",accentDim:"#4e5860",accentBright:"#6e7a85"},' +
    '{id:"mk-blue",name:"MSB Blue",accent:"#1f74bf",accentDim:"#0c60a3",accentBright:"#558cb9"}]',
  "accent swatches array (Aqn)",
);

// 2. New preset, appended to the presets array (dwe in this build), reusing "Light Minimal"'s
// already-tuned node colors (ponytail: reuse over reinvent) and mk-theme's own root/surface/text
// tokens (docs/01-produit.md, app/globals.css `--color-mk-*`).
src = replaceOnce(
  src,
  '"node-resource":"#818cf8"}}]',
  '"node-resource":"#818cf8"}},{id:"mk-light",name:"MSB Light",isDark:!1,defaultAccentId:"mk-blue",accentSwatches:Aqn,colors:{' +
    'root:"#f5fbff",surface:"#fcfeff",elevated:"#ffffff",panel:"#ebf3f9",' +
    '"text-primary":"#0f171f","text-secondary":"#535c66","text-muted":"#7d8792",' +
    '"node-file":"#3a6a87","node-function":"#488a5b","node-class":"#755d99","node-module":"#a88a56",' +
    '"node-concept":"#966674","node-config":"#14b8a6","node-document":"#38bdf8","node-service":"#8b5cf6",' +
    '"node-table":"#34d399","node-endpoint":"#fb923c","node-pipeline":"#fb7185","node-schema":"#facc15",' +
    '"node-resource":"#818cf8"}}]',
  "presets array (dwe)",
);

// 3. Default theme: MSB Light / MSB Blue instead of Dark Gold. Visitors who already picked a
// theme keep their choice (read from localStorage "ua-theme" before this default applies).
src = replaceOnce(
  src,
  '{presetId:"dark-gold",accentId:"gold"}',
  '{presetId:"mk-light",accentId:"mk-blue"}',
  "default theme config (Sqn)",
);

writeFileSync(file, src);
console.log(`patched ${file}`);
