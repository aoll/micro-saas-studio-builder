import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { balances, creditTransactions, events, productVersions, products, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";

// SA-03 (specs/SA-03-inscription.md), plan task 5: unit tests mock every
// collaborator (getProduct's `'use cache'` cannot run under Vitest, see
// app/(products)/[app]/api/events/route.test.ts); the "GET twice" suite at
// the bottom uses the real credits and events DAL against a private test
// product, mirroring lib/dal/credits.test.ts's createProduct helper.

class RedirectMarker extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
class NotFoundMarker extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectMarker(url);
  },
  notFound: () => {
    throw new NotFoundMarker();
  },
}));

const cookieStore = { get: vi.fn(() => undefined as { value: string } | undefined) };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

// next/server's after() needs a real request context (generate route.test.ts's
// note): collect callbacks and flush them manually.
const afterCallbacks: Array<() => unknown> = [];
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (task: unknown) => {
      afterCallbacks.push(typeof task === "function" ? (task as () => unknown) : () => task);
    },
  };
});
async function flushAfterCallbacks(): Promise<void> {
  await Promise.all(afterCallbacks.splice(0).map((callback) => callback()));
}

const getProduct = vi.fn();
vi.mock("@/lib/dal/products", () => ({ getProduct: (slug: string) => getProduct(slug) }));
const getSession = vi.fn();
vi.mock("@/lib/dal/session", () => ({ getSession: () => getSession() }));
const grantSignupBonus = vi.fn();
const track = vi.fn();

afterEach(() => {
  getProduct.mockReset();
  getSession.mockReset();
  grantSignupBonus.mockReset();
  track.mockReset();
  cookieStore.get.mockReturnValue(undefined);
  afterCallbacks.length = 0;
  vi.doUnmock("@/lib/dal/credits");
  vi.doUnmock("@/lib/dal/events");
  vi.resetModules();
});

const PRODUCT = { id: "product-1", slug: "lettre-pro", status: "test" };

function ctx(app = "lettre-pro") {
  return { params: Promise.resolve({ app }) };
}

describe("GET [app]/signup/complete: unit", () => {
  it("calls notFound for an unknown product", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(null);
    const { GET } = await import("./route");

    await expect(GET(new Request("https://msb.local/unknown/signup/complete"), ctx("unknown"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(grantSignupBonus).not.toHaveBeenCalled();
  });

  it("calls notFound for a killed product", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue({ ...PRODUCT, status: "killed" });
    const { GET } = await import("./route");

    await expect(GET(new Request("https://msb.local/lettre-pro/signup/complete"), ctx())).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(grantSignupBonus).not.toHaveBeenCalled();
  });

  it("redirects to /signup when there is no session, granting nothing", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(PRODUCT);
    getSession.mockResolvedValue(null);
    const { GET } = await import("./route");

    await expect(GET(new Request("https://msb.local/lettre-pro/signup/complete"), ctx())).rejects.toThrow(
      "redirect:/lettre-pro/signup",
    );
    expect(grantSignupBonus).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("grants the bonus and redirects to /tool with a session", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(PRODUCT);
    getSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    grantSignupBonus.mockResolvedValue({ balance: 3 });
    const { GET } = await import("./route");

    await expect(GET(new Request("https://msb.local/lettre-pro/signup/complete"), ctx())).rejects.toThrow(
      "redirect:/lettre-pro/tool",
    );
    expect(grantSignupBonus).toHaveBeenCalledWith({ userId: "user-1", productId: "product-1" });
  });

  it("tracks the signup event with the anonymous cookie, only after the redirect (after())", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(PRODUCT);
    getSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    grantSignupBonus.mockResolvedValue({ balance: 3 });
    const anonymousId = randomUUID();
    cookieStore.get.mockReturnValue({ value: anonymousId });
    const { GET } = await import("./route");

    await expect(GET(new Request("https://msb.local/lettre-pro/signup/complete"), ctx())).rejects.toThrow(
      "redirect:/lettre-pro/tool",
    );
    expect(track).not.toHaveBeenCalled();

    await flushAfterCallbacks();
    expect(track).toHaveBeenCalledWith({
      type: "signup",
      productId: "product-1",
      userId: "user-1",
      anonymousId,
    });
  });

  it("treats a tampered anonymous cookie as absent (null), never throwing", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(PRODUCT);
    getSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    grantSignupBonus.mockResolvedValue({ balance: 3 });
    cookieStore.get.mockReturnValue({ value: "not-a-uuid" });
    const { GET } = await import("./route");

    await expect(GET(new Request("https://msb.local/lettre-pro/signup/complete"), ctx())).rejects.toThrow(
      "redirect:/lettre-pro/tool",
    );
    await flushAfterCallbacks();
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", userId: "user-1", anonymousId: null }),
    );
  });
});

describe("GET [app]/signup/complete: real ledger and events (GET twice)", () => {
  const createdUserIds: string[] = [];
  const createdProductIds: string[] = [];

  afterAll(async () => {
    for (const id of createdProductIds) {
      await db.delete(events).where(eq(events.productId, id));
      await db.delete(creditTransactions).where(eq(creditTransactions.productId, id));
      await db.delete(balances).where(eq(balances.productId, id));
      await db.delete(productVersions).where(eq(productVersions.productId, id));
      await db.delete(products).where(eq(products.id, id));
    }
    for (const id of createdUserIds) {
      await db.delete(creditTransactions).where(eq(creditTransactions.userId, id));
      await db.delete(balances).where(eq(balances.userId, id));
      await db.delete(events).where(eq(events.userId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  });

  async function createUser(): Promise<string> {
    const id = randomUUID();
    await db.insert(users).values({ id, name: "Signup test user", email: `${id}@signup.test`, emailVerified: true });
    createdUserIds.push(id);
    return id;
  }

  // A private product copied from lettre-pro's config (credits.test.ts's
  // pattern), so this suite never touches the seeded product nor shares
  // balances with other specs' tests.
  async function createProduct(): Promise<{ id: string; slug: string }> {
    const lettrePro = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
    const editorial = await db.query.themes.findFirst({ where: eq(themes.slug, "editorial") });
    const version = await db.query.productVersions.findFirst({
      where: and(eq(productVersions.productId, lettrePro!.id), eq(productVersions.version, lettrePro!.currentVersion)),
    });
    const admin = await db.query.users.findFirst({ where: eq(users.role, "admin") });
    const slug = `signup-test-${randomUUID()}`;
    const config: ProductConfig = { ...(version!.config as ProductConfig), slug, themeId: editorial!.id };

    const [product] = await db
      .insert(products)
      .values({ slug, status: "test", themeId: editorial!.id, currentVersion: 1, locale: "fr", createdBy: admin!.id })
      .returning({ id: products.id });
    await db.insert(productVersions).values({ productId: product!.id, version: 1, config, createdBy: admin!.id });
    createdProductIds.push(product!.id);
    return { id: product!.id, slug };
  }

  it("granting the bonus twice only credits +3 once, writes one signup_bonus row, and tracks a signup event on each completed sign-in (2)", async () => {
    vi.doUnmock("@/lib/dal/credits");
    vi.doUnmock("@/lib/dal/events");
    vi.resetModules();

    const userId = await createUser();
    const product = await createProduct();
    getProduct.mockResolvedValue({ id: product.id, slug: product.slug, status: "test" });
    getSession.mockResolvedValue({ user: { id: userId, role: "user" } });
    const anonymousId = randomUUID();
    cookieStore.get.mockReturnValue({ value: anonymousId });

    const { GET } = await import("./route");

    await expect(
      GET(new Request(`https://msb.local/${product.slug}/signup/complete`), ctx(product.slug)),
    ).rejects.toThrow(`redirect:/${product.slug}/tool`);
    await flushAfterCallbacks();

    await expect(
      GET(new Request(`https://msb.local/${product.slug}/signup/complete`), ctx(product.slug)),
    ).rejects.toThrow(`redirect:/${product.slug}/tool`);
    await flushAfterCallbacks();

    const [balanceRow] = await db
      .select()
      .from(balances)
      .where(and(eq(balances.userId, userId), eq(balances.productId, product.id)));
    expect(balanceRow?.balance).toBe(3);

    const bonusRows = await db
      .select()
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.reason, "signup_bonus")));
    expect(bonusRows).toHaveLength(1);

    const signupEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.type, "signup")));
    expect(signupEvents).toHaveLength(2); // after() ran twice; grantSignupBonus is what's idempotent
    expect(signupEvents[0]?.anonymousId).toBe(anonymousId);
  });
});
