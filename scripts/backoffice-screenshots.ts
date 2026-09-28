import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { SEED_ADMIN } from "./seed";

// Captures the backoffice screens shown on the landing ("Le backoffice en
// images", app/(marketing)/_components/backoffice-screens.tsx) into
// public/landing/. Run it against a freshly seeded database so the figures
// are the demo's own:
//
//   pnpm db:seed && pnpm dev   # in another terminal
//   pnpm screenshots:backoffice
//
// BASE_URL overrides the target (default http://localhost:3000). Nothing is
// written to the database: the product form is filled from a fixture but
// never saved or published.
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = join(process.cwd(), "public/landing");
const VIEWPORT = { width: 1280, height: 800 };

// Hides the Next.js dev-tools badge, which only exists on `next dev`.
const HIDE_DEV_OVERLAY = "nextjs-portal { display: none !important; }";

async function capture(page: Page, name: string) {
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY });
  // Lets fonts, charts and the diffuse ground settle.
  await page.waitForTimeout(1000);
  // JPEG: the diffuse gradient ground compresses badly as PNG.
  const path = join(OUT_DIR, `${name}.jpg`);
  await page.screenshot({ path, type: "jpeg", quality: 85 });
  console.log(`✓ ${path}`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2, baseURL: BASE_URL });
  try {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(SEED_ADMIN.email);
    await page.getByLabel("Mot de passe").fill(SEED_ADMIN.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL(/\/admin$/);

    await page.goto("/admin", { waitUntil: "networkidle" });
    await capture(page, "backoffice-portfolio");

    await page.goto("/admin/products/lettre-pro", { waitUntil: "networkidle" });
    await capture(page, "backoffice-product");

    // The product form, filled from the same fixture as the two-minute demo
    // (e2e/product-form.spec.ts), on the step whose preview shows a landing.
    const fixture = readFileSync(join(process.cwd(), "fixtures/bio-instagram.config.json"), "utf-8");
    await page.goto("/admin/products/new", { waitUntil: "networkidle" });
    await page.getByLabel("Coller une configuration JSON").fill(fixture);
    await page.getByRole("button", { name: "Importer" }).click();
    await page.getByText("Configuration importée").waitFor();
    await page.getByRole("button", { name: /^2\./ }).click();
    await page.locator('[role="radio"]', { hasText: "Neon" }).click();
    await page.getByRole("button", { name: /^3\./ }).click();
    await page.getByText("Configuration importée").waitFor({ state: "hidden" });
    await capture(page, "backoffice-product-form");
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
