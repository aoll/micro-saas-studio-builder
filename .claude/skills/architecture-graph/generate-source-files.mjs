#!/usr/bin/env node
// Reads every file-level node's filePath out of a knowledge-graph.json and
// dumps its current on-disk content into one JSON map, consumed by the
// static-demo fork of CodeViewer.tsx (codeviewer-static-demo.patch) instead
// of the dev-server-only /file-content.json endpoint.
//
// Usage: node generate-source-files.mjs <projectRoot> <knowledge-graph.json> <output.json>
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , projectRoot, graphPath, outputPath] = process.argv;
if (!projectRoot || !graphPath || !outputPath) {
  console.error("Usage: node generate-source-files.mjs <projectRoot> <knowledge-graph.json> <output.json>");
  process.exit(1);
}

const MAX_BYTES = 1024 * 1024; // same cap as the upstream dev-server file reader
const LANGUAGE_BY_EXT = {
  bash: "bash",
  c: "c",
  cc: "cpp",
  cjs: "javascript",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  go: "go",
  h: "c",
  hpp: "cpp",
  html: "markup",
  java: "java",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  sql: "sql",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  yaml: "yaml",
  yml: "yaml",
};
const detectLanguage = (filePath) => LANGUAGE_BY_EXT[filePath.split(".").pop().toLowerCase()] ?? "text";

const graph = JSON.parse(readFileSync(graphPath, "utf8"));
const fileLevelTypes = new Set(["file", "config", "document", "service"]);
const nodes = graph.nodes.filter((n) => fileLevelTypes.has(n.type) && n.filePath);

const out = {};
const skipped = [];
for (const node of nodes) {
  const absolutePath = resolve(projectRoot, node.filePath);
  if (!absolutePath.startsWith(resolve(projectRoot))) {
    skipped.push(`${node.filePath} (escapes projectRoot)`);
    continue;
  }
  let buffer;
  try {
    buffer = readFileSync(absolutePath);
  } catch {
    skipped.push(`${node.filePath} (unreadable)`);
    continue;
  }
  if (buffer.length > MAX_BYTES) {
    skipped.push(`${node.filePath} (too large)`);
    continue;
  }
  if (buffer.includes(0)) {
    skipped.push(`${node.filePath} (binary)`);
    continue;
  }
  const content = buffer.toString("utf8");
  out[node.filePath] = {
    path: node.filePath,
    language: detectLanguage(node.filePath),
    content,
    sizeBytes: buffer.byteLength,
    lineCount: content.length === 0 ? 0 : content.split(/\r\n|\n|\r/).length,
  };
}

writeFileSync(outputPath, JSON.stringify(out));
console.log(`generate-source-files: wrote ${Object.keys(out).length} files, skipped ${skipped.length}`);
if (skipped.length) console.log("skipped:", skipped.slice(0, 20));
