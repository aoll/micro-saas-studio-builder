import { describe, expect, it } from "vitest";
import files from "./manifest";

describe("messages/manifest", () => {
  it("globs every locale/zone JSON file, keyed by a path under its locale folder", () => {
    const paths = Object.keys(files);
    expect(paths.some((path) => path.includes("/fr/common.json"))).toBe(true);
    expect(paths.some((path) => path.includes("/en/common.json"))).toBe(true);
  });

  it("eagerly resolves each entry to the parsed JSON content, not a loader", () => {
    const frCommonPath = Object.keys(files).find((path) => path.includes("/fr/common.json"))!;
    expect(files[frCommonPath]).toMatchObject({ header: { signIn: "Connexion" } });
  });
});
