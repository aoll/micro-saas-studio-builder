import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/auth-schema";
import { productVersions, products, themes } from "../lib/db/schema";
import { requireDatabaseUrl } from "../lib/require-database-url";
import { productConfigSchema } from "../lib/schemas/product-config";
import { SEED_OWNER } from "../scripts/seed";

// I18N-SEO (specs/I18N-SEO.md). Not run yet (written now, run in the E2E
// phase, docs/11-implementation.md › V4 Package): playwright.config.ts's
// webServer builds and starts against the seeded database (lettre-pro, fr,
// editorial theme, primary #8a5a34 — scripts/seed.ts).
//
// Pixel colours are read with the browser's own Canvas API
// (createImageBitmap + getImageData) instead of a PNG-decoding npm
// package: no new dependency, and it exercises the exact bytes a browser
// would show a recruiter pasting the URL into a link-preview tool.

// A representative sample of French sub-app copy (messages/fr/*.json):
// none of it may appear on an English (locale=en) product's pages.
const FR_DENYLIST = [
  "Connexion",
  "Crédits",
  "Générer",
  "Paiement",
  "Historique",
  "Mon compte",
  "Rechargez",
  "Essayer gratuitement",
  "Créez un compte",
];

async function connectDb() {
  const sql = postgres(requireDatabaseUrl(), { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema: { products, productVersions, themes, users } });
  return { sql, db };
}

// Inserts a product from lettre-pro's fixture, translated to English, with
// a fresh slug. Returns the slug and a cleanup function (call in `finally`,
// mirroring e2e/not-found.spec.ts's killed-product test).
async function createEnglishProduct(options: { status: "test" | "scale" | "killed"; themeSlug: string }) {
  const { sql, db } = await connectDb();
  const slug = `seo-en-${randomUUID()}`;
  const owner = await db.query.users.findFirst({ where: eq(users.email, SEED_OWNER.email) });
  const theme = await db.query.themes.findFirst({ where: eq(themes.slug, options.themeSlug) });
  if (!owner || !theme) throw new Error(`seo.spec.ts: seed not applied (owner or theme "${options.themeSlug}")`);

  const rawConfig: unknown = JSON.parse(
    readFileSync(new URL("../fixtures/lettre-pro.config.json", import.meta.url), "utf8"),
  );
  const config = productConfigSchema.parse({
    ...(rawConfig as object),
    slug,
    name: "LetterPro",
    status: options.status,
    locale: "en",
    themeId: theme.id,
    landing: {
      headline: "Generate your cover letter in 30 seconds",
      subheadline: "An AI tool that writes a compelling cover letter from your role, experience and desired tone.",
      faq: [
        {
          question: "How much does a generation cost?",
          answer:
            "1 credit per letter generated. You get 3 free credits on signup, and the first generation is free even without an account.",
        },
        {
          question: "Can I edit the result?",
          answer: "Yes: copy the generated text and adapt it freely before sending it to your recruiter.",
        },
        {
          question: "Which languages are supported?",
          answer: "English for now; every product in the studio has its own configuration language.",
        },
      ],
      seoTitle: "AI cover letter generator",
      seoDescription: "Create a professional cover letter in 30 seconds with AI. Free to try, no credit card required.",
      exampleOutput:
        "Dear Hiring Manager,\n\nWith several years of experience in web development, I would like to join your team...",
      steps: [
        { title: "Describe the role", description: "State the target role, the company and your experience." },
        { title: "Choose the tone", description: "Formal or dynamic, depending on the company's culture." },
        { title: "Get your letter", description: "A ready-to-send letter, generated in seconds." },
      ],
    },
    inputs: [
      { key: "poste", label: "Target role", type: "text", required: true },
      { key: "entreprise", label: "Company", type: "text", required: true },
      { key: "experience", label: "Your experience", type: "textarea", required: true },
      { key: "ton", label: "Tone", type: "select", required: true, options: ["formal", "dynamic"] },
    ],
    generation: {
      model: "anthropic/claude-haiku-4.5",
      promptTemplate:
        "Write a cover letter for the {{poste}} position at {{entreprise}}. Candidate experience: {{experience}}. Tone: {{ton}}.",
      outputType: "markdown",
    },
  });

  try {
    await db.insert(products).values({
      slug,
      status: config.status,
      themeId: theme.id,
      currentVersion: 1,
      locale: config.locale,
      isSeed: false,
      createdBy: owner.id,
    });
    const product = await db.query.products.findFirst({ where: eq(products.slug, slug) });
    if (!product) throw new Error(`seo.spec.ts: failed to insert product ${slug}`);
    await db.insert(productVersions).values({ productId: product.id, version: 1, config, createdBy: owner.id });

    return {
      slug,
      config,
      cleanup: async () => {
        await db.delete(productVersions).where(eq(productVersions.productId, product.id));
        await db.delete(products).where(eq(products.id, product.id));
        await sql.end({ timeout: 5 });
      },
    };
  } catch (error) {
    await sql.end({ timeout: 5 });
    throw error;
  }
}

test.describe("robots.txt and sitemap.xml", () => {
  test("robots.txt disallows /admin entirely, not a slug like admin-xyz, and points at the sitemap", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toMatch(/Disallow:\s*\/admin\$/);
    expect(body).toMatch(/Disallow:\s*\/admin\//);
    expect(body).toMatch(/Sitemap:\s*https?:\/\/.+\/sitemap\.xml/);
  });

  test("sitemap.xml lists the seeded lettre-pro landing, never /admin", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain("/lettre-pro</loc>");
    expect(body).not.toContain("/admin");
  });
});

test.describe("Icon and Open Graph image", () => {
  test("the <link>/<meta> tags point at real images in the product's theme colours", async ({ page, request }) => {
    const { sql, db } = await connectDb();
    let primaryHex: string;
    try {
      const product = await db.query.products.findFirst({ where: eq(products.slug, "lettre-pro") });
      if (!product) throw new Error("seo.spec.ts: seed missing (lettre-pro)");
      const theme = await db.query.themes.findFirst({ where: eq(themes.id, product.themeId) });
      if (!theme) throw new Error("seo.spec.ts: seed missing (lettre-pro's theme)");
      primaryHex = (theme.tokens as { light: { primary: string } }).light.primary;
    } finally {
      await sql.end({ timeout: 5 });
    }
    expect(primaryHex).toMatch(/^#[0-9a-fA-F]{6}$/);
    const expectedRgb = {
      r: parseInt(primaryHex.slice(1, 3), 16),
      g: parseInt(primaryHex.slice(3, 5), 16),
      b: parseInt(primaryHex.slice(5, 7), 16),
    };

    await page.goto("/lettre-pro");

    // Follow-up (SEO metadata, docs/04-nextjs.md): the landing's canonical
    // URL, resolved against [app]/layout.tsx's metadataBase.
    const canonicalHref = await page.locator('link[rel="canonical"]').first().getAttribute("href");
    expect(canonicalHref).toMatch(/\/lettre-pro$/);

    const iconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
    expect(iconHref).toBeTruthy();
    const iconResponse = await request.get(iconHref!);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toBe("image/png");

    const ogHref = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(ogHref).toBeTruthy();
    const ogResponse = await request.get(ogHref!);
    expect(ogResponse.ok()).toBe(true);
    expect(ogResponse.headers()["content-type"]).toBe("image/png");

    // The icon is a solid primary-colored background behind the initial:
    // its top-left pixel is a safe, letter-free sample point.
    const pixel = await page.evaluate(async (url) => {
      const blob = await fetch(url).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const [r, g, b] = ctx.getImageData(1, 1, 1, 1).data;
      return { r, g, b };
    }, iconHref!);
    expect(pixel).toEqual(expectedRgb);
  });

  test("404s (icon and OG image) for an unknown product", async ({ request }) => {
    const iconResponse = await request.get(`/introuvable-${randomUUID()}/icon`);
    expect(iconResponse.status()).toBe(404);
    const ogResponse = await request.get(`/introuvable-${randomUUID()}/opengraph-image`);
    expect(ogResponse.status()).toBe(404);
  });
});

test.describe("An English (locale=en) product, across the sub-app", () => {
  test("landing, tool, signup, pricing, checkout, history and account all render in English", async ({ page }) => {
    const created = await createEnglishProduct({ status: "scale", themeSlug: "neon" });
    try {
      const { slug, config } = created;

      // 1. Landing.
      let response = await page.goto(`/${slug}`);
      expect(response?.status()).toBe(200);
      expect(await page.locator("html").getAttribute("lang")).toBe("en");
      await expect(page.getByRole("heading", { level: 1, name: config.landing.headline })).toBeVisible();
      await expect(page.getByRole("link", { name: "Try it free" }).first()).toBeVisible();

      // 2. Tool: an anonymous visitor gets one free generation, then the
      // second attempt is redirected to /signup (same flow as
      // e2e/tool.spec.ts, in English).
      await page.goto(`/${slug}/tool`);
      await page.getByLabel("Target role").fill("Frontend Engineer");
      await page.getByLabel("Company").fill("Dotworld");
      await page.getByLabel("Your experience").fill("3 years in React and TypeScript");
      await page.getByLabel("Tone").selectOption("dynamic");
      await page.getByRole("button", { name: /Generate/ }).click();
      await expect(page.getByText("Result")).toBeVisible();
      await page.getByRole("button", { name: "Regenerate" }).click();
      await expect(page).toHaveURL(new RegExp(`/${slug}/signup$`));

      // 3. Signup.
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByRole("button", { name: "Get my sign-in link" })).toBeVisible();

      // 4. Pricing.
      response = await page.goto(`/${slug}/pricing`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("link", { name: /Buy/ }).first()).toBeVisible();

      // 5. Checkout, full page (direct link, not the modal).
      response = await page.goto(`/${slug}/checkout/pack-10`);
      expect(response?.status()).toBe(200);
      await expect(page.getByText("Payment").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Pay .*\(simulated\)/ })).toBeVisible();

      // 6. History (empty, anonymous).
      response = await page.goto(`/${slug}/history`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
      await expect(page.getByText("No generation yet")).toBeVisible();

      // 7. Account (prompts sign up, anonymous).
      response = await page.goto(`/${slug}/account`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
      await expect(page.getByText("Create an account to see your credits")).toBeVisible();

      // No French copy leaked onto any of the 7 pages above.
      const bodyText = (await page.locator("body").innerText()) ?? "";
      for (const frWord of FR_DENYLIST) {
        expect(bodyText).not.toContain(frWord);
      }
    } finally {
      await created.cleanup();
    }
  });

  test('a killed English product still 404s in English, with lang="en"', async ({ page }) => {
    const created = await createEnglishProduct({ status: "killed", themeSlug: "neon" });
    try {
      const response = await page.goto(`/${created.slug}`);
      expect(response?.status()).toBe(404);
      expect(await page.locator("html").getAttribute("lang")).toBe("en");
      await expect(page.getByText("has closed or does not exist", { exact: false })).toBeVisible();
      for (const frWord of FR_DENYLIST) {
        await expect(page.getByText(frWord)).toHaveCount(0);
      }
    } finally {
      await created.cleanup();
    }
  });
});
