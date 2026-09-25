import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { users } from "@/lib/db/auth-schema";
import { balances, creditTransactions, events, productVersions, products, themes } from "@/lib/db/schema";
import type { ProductConfig } from "@/lib/schemas/product-config";

// QA1-P1-Q2 (specs/qa/QA1-P1-Q2-inscription-par-produit.md), plan step 1:
// the shared grant+track helper, extracted from
// signup/complete/route.ts (SA-03) so both the magic-link redirect target
// and the new claimSignupBonus Server Action call the exact same,
// already-idempotent logic. Unit tests here mirror route.test.ts's mocking
// style (getProduct's `'use cache'` cannot run under Vitest); the "twice"
// suite at the bottom uses the real credits and events DAL against private
// test products, mirroring lib/dal/credits.test.ts's createProduct helper.

const cookieStore = { get: vi.fn(() => undefined as { value: string } | undefined) };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

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

describe("claimSignupBonus: unit", () => {
  it("returns not_found for a missing product, without calling getSession", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(null);
    const { claimSignupBonus } = await import("./claim");

    await expect(claimSignupBonus("unknown")).resolves.toEqual({ status: "not_found" });
    expect(getSession).not.toHaveBeenCalled();
    expect(grantSignupBonus).not.toHaveBeenCalled();
  });

  it("returns not_found for a killed product", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue({ ...PRODUCT, status: "killed" });
    const { claimSignupBonus } = await import("./claim");

    await expect(claimSignupBonus("lettre-pro")).resolves.toEqual({ status: "not_found" });
    expect(grantSignupBonus).not.toHaveBeenCalled();
  });

  it("returns no_session when there is no session, granting nothing", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(PRODUCT);
    getSession.mockResolvedValue(null);
    const { claimSignupBonus } = await import("./claim");

    await expect(claimSignupBonus("lettre-pro")).resolves.toEqual({ status: "no_session" });
    expect(grantSignupBonus).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("grants the bonus and returns the balance with a session", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(PRODUCT);
    getSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    grantSignupBonus.mockResolvedValue({ balance: 3 });
    const { claimSignupBonus } = await import("./claim");

    await expect(claimSignupBonus("lettre-pro")).resolves.toEqual({ status: "granted", balance: 3 });
    expect(grantSignupBonus).toHaveBeenCalledWith({ userId: "user-1", productId: "product-1" });
  });

  it("tracks the signup event with the anonymous cookie, only after settling (after())", async () => {
    vi.doMock("@/lib/dal/credits", () => ({ grantSignupBonus: (args: unknown) => grantSignupBonus(args) }));
    vi.doMock("@/lib/dal/events", () => ({ track: (event: unknown) => track(event) }));
    getProduct.mockResolvedValue(PRODUCT);
    getSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    grantSignupBonus.mockResolvedValue({ balance: 3 });
    const anonymousId = randomUUID();
    cookieStore.get.mockReturnValue({ value: anonymousId });
    const { claimSignupBonus } = await import("./claim");

    await claimSignupBonus("lettre-pro");
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
    const { claimSignupBonus } = await import("./claim");

    await claimSignupBonus("lettre-pro");
    await flushAfterCallbacks();
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", userId: "user-1", anonymousId: null }),
    );
  });
});

describe("claimSignupBonus: real ledger and events (called twice, and across products)", () => {
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
    await db.insert(users).values({ id, name: "Claim test user", email: `${id}@claim.test`, emailVerified: true });
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
    const slug = `claim-test-${randomUUID()}`;
    const config: ProductConfig = { ...(version!.config as ProductConfig), slug, themeId: editorial!.id };

    const [product] = await db
      .insert(products)
      .values({ slug, status: "test", themeId: editorial!.id, currentVersion: 1, locale: "fr", createdBy: admin!.id })
      .returning({ id: products.id });
    await db.insert(productVersions).values({ productId: product!.id, version: 1, config, createdBy: admin!.id });
    createdProductIds.push(product!.id);
    return { id: product!.id, slug };
  }

  it("calling it twice only credits +3 once, writes one signup_bonus row, and tracks the signup event only once", async () => {
    vi.doUnmock("@/lib/dal/credits");
    vi.doUnmock("@/lib/dal/events");
    vi.resetModules();

    const userId = await createUser();
    const product = await createProduct();
    getProduct.mockResolvedValue({ id: product.id, slug: product.slug, status: "test" });
    getSession.mockResolvedValue({ user: { id: userId, role: "user" } });

    const { claimSignupBonus } = await import("./claim");

    await claimSignupBonus(product.slug);
    await flushAfterCallbacks();
    await claimSignupBonus(product.slug);
    await flushAfterCallbacks();

    const [balanceRow] = await db
      .select()
      .from(balances)
      .where(and(eq(balances.userId, userId), eq(balances.productId, product.id)));
    expect(balanceRow?.balance).toBe(3);

    const bonusRows = await db
      .select()
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.reason, "signup_bonus"),
          eq(creditTransactions.productId, product.id),
        ),
      );
    expect(bonusRows).toHaveLength(1);

    const signupEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.type, "signup"), eq(events.productId, product.id)));
    expect(signupEvents).toHaveLength(1);
  });

  it("claiming product B's bonus never moves product A's balance", async () => {
    vi.doUnmock("@/lib/dal/credits");
    vi.doUnmock("@/lib/dal/events");
    vi.resetModules();

    const userId = await createUser();
    const productA = await createProduct();
    const productB = await createProduct();

    // A already has a balance from a prior signup on A.
    getProduct.mockResolvedValue({ id: productA.id, slug: productA.slug, status: "test" });
    getSession.mockResolvedValue({ user: { id: userId, role: "user" } });
    const { claimSignupBonus } = await import("./claim");
    await claimSignupBonus(productA.slug);
    await flushAfterCallbacks();

    const [beforeBalanceA] = await db
      .select()
      .from(balances)
      .where(and(eq(balances.userId, userId), eq(balances.productId, productA.id)));
    expect(beforeBalanceA?.balance).toBe(3);

    // Now claim B.
    getProduct.mockResolvedValue({ id: productB.id, slug: productB.slug, status: "test" });
    await claimSignupBonus(productB.slug);
    await flushAfterCallbacks();

    const [afterBalanceA] = await db
      .select()
      .from(balances)
      .where(and(eq(balances.userId, userId), eq(balances.productId, productA.id)));
    expect(afterBalanceA?.balance).toBe(3);

    const [balanceB] = await db
      .select()
      .from(balances)
      .where(and(eq(balances.userId, userId), eq(balances.productId, productB.id)));
    expect(balanceB?.balance).toBe(3);
  });
});
