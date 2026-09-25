import { describe, expect, it } from "vitest";
import { activityHref, parsePageParam, readPageParam } from "./pagination";

describe("parsePageParam", () => {
  it("returns 1 for an undefined value", () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it("parses a valid page string", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("takes the first value of an array", () => {
    expect(parsePageParam(["2", "5"])).toBe(2);
  });

  it.each(["0", "-1", "1.5", "abc", ""])("falls back to 1 for %s", (value) => {
    expect(parsePageParam(value)).toBe(1);
  });
});

describe("readPageParam", () => {
  it("reads each list's own query key", () => {
    const searchParams = { genPage: "2", purPage: "3", movPage: "4" };
    expect(readPageParam(searchParams, "generations")).toBe(2);
    expect(readPageParam(searchParams, "purchases")).toBe(3);
    expect(readPageParam(searchParams, "movements")).toBe(4);
  });

  it("defaults to 1 when a list's key is absent", () => {
    expect(readPageParam({}, "generations")).toBe(1);
  });
});

describe("activityHref", () => {
  it("omits the query string entirely when every list is on page 1", () => {
    expect(activityHref("nom-de-marque", {}, { key: "generations", page: 1 })).toBe(
      "/admin/products/nom-de-marque/activity",
    );
  });

  it("writes only the changed list's page", () => {
    expect(activityHref("nom-de-marque", {}, { key: "generations", page: 2 })).toBe(
      "/admin/products/nom-de-marque/activity?genPage=2",
    );
  });

  it("keeps the other lists' current pages untouched", () => {
    const href = activityHref("nom-de-marque", { generations: 3, purchases: 2 }, { key: "movements", page: 4 });
    expect(href).toBe("/admin/products/nom-de-marque/activity?genPage=3&purPage=2&movPage=4");
  });

  it("drops a list's page param when it goes back to page 1", () => {
    const href = activityHref("nom-de-marque", { generations: 3 }, { key: "generations", page: 1 });
    expect(href).toBe("/admin/products/nom-de-marque/activity");
  });
});
