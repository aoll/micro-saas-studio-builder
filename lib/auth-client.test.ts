import { describe, expect, it } from "vitest";
import { authClient } from "./auth-client";

describe("authClient", () => {
  it("exposes signOut as a function", () => {
    expect(typeof authClient.signOut).toBe("function");
  });
});
