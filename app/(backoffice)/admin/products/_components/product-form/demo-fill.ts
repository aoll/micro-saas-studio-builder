import type { Theme } from "@/lib/dal/themes";
import type { ProductConfig } from "@/lib/schemas/product-config";
import bioInstaConfig from "@/fixtures/bio-instagram.config.json";
import { fromConfig, type ProductDraft } from "./form-values";

// The demo product the ★ button of each step fills in: BioInsta, the config
// already kept in fixtures/bio-instagram.config.json for the live creation
// (specs/DEMO-mode.md). It has no theme (a `themeId` is a database id), so
// step 2 picks the seeded "playful" theme, falling back to the current one.
const DEMO_THEME_SLUG = "playful";

// The part of a fresh demo draft that belongs to `step` (same split as
// ProductForm's `stepPatch`), or nothing for the recap step, which has no
// field to fill. Fresh client-only ids on every call, like `fromConfig`.
export function demoStepPatch(step: number, themes: Theme[], currentThemeId: string): Partial<ProductDraft> {
  const themeId = themes.find((theme) => theme.slug === DEMO_THEME_SLUG)?.id ?? currentThemeId;
  const demo = fromConfig({ ...(bioInstaConfig as Omit<ProductConfig, "themeId">), themeId });
  switch (step) {
    case 1:
      return { slug: demo.slug, name: demo.name, status: demo.status, locale: demo.locale };
    case 2:
      return { themeId: demo.themeId };
    case 3:
      return { landing: demo.landing };
    case 4:
      return { inputs: demo.inputs };
    case 5:
      return { generation: demo.generation };
    case 6:
      return { pricing: demo.pricing };
    default:
      return {};
  }
}
