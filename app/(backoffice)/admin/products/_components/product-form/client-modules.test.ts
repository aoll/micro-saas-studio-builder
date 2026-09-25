import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every module of this folder ends up in the browser bundle of the product
// form. A `node:` import there is polyfilled by the bundler (crypto-browserify
// has no randomUUID) and crashed the form on load (QA1 B1).
const modules = readdirSync(import.meta.dirname).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));

describe("product form client modules", () => {
  it.each(modules)("%s imports no Node.js built-in", (file) => {
    const source = readFileSync(`${import.meta.dirname}/${file}`, "utf8");
    expect(source).not.toMatch(/from\s+["']node:/);
  });
});
