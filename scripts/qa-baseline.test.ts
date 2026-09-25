import { describe, expect, it } from "vitest";
import { diffBaseline, parseLsTree } from "./qa-baseline";

describe("parseLsTree", () => {
  it("keeps app code, drops tests and blank lines, sorts by path", () => {
    const output = [
      "bbb lib/dal/history.ts",
      "ccc lib/dal/history.test.ts",
      "ddd e2e/demo-mode.spec.ts",
      "",
      "aaa app/(products)/[app]/tool/page.tsx",
      "eee app/(products)/[app]/tool/_components/tool-form.spec.tsx",
    ].join("\n");

    expect(parseLsTree(output)).toEqual([
      { path: "app/(products)/[app]/tool/page.tsx", hash: "aaa" },
      { path: "lib/dal/history.ts", hash: "bbb" },
    ]);
  });

  it("keeps a path that contains spaces whole", () => {
    expect(parseLsTree("abc messages/fr/a b.json")).toEqual([{ path: "messages/fr/a b.json", hash: "abc" }]);
  });
});

describe("diffBaseline", () => {
  it("sorts every current path into added, changed or unchanged, and lists the removed ones", () => {
    const baseline = [
      { path: "a.ts", hash: "1" },
      { path: "b.ts", hash: "2" },
      { path: "gone.ts", hash: "3" },
    ];
    const current = [
      { path: "a.ts", hash: "1" },
      { path: "b.ts", hash: "9" },
      { path: "new.ts", hash: "4" },
    ];

    expect(diffBaseline(baseline, current)).toEqual({
      added: ["new.ts"],
      changed: ["b.ts"],
      removed: ["gone.ts"],
      unchanged: ["a.ts"],
    });
  });

  it("treats every file as added when there is no baseline yet (first pass)", () => {
    expect(diffBaseline(null, [{ path: "a.ts", hash: "1" }])).toEqual({
      added: ["a.ts"],
      changed: [],
      removed: [],
      unchanged: [],
    });
  });
});
