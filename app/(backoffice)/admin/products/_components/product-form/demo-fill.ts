import type { Theme } from "@/lib/dal/themes";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { fromConfig, type ProductDraft } from "./form-values";

// The demo product the ★ button of each step fills in: FrigoChef, an
// invented micro-SaaS that suggests a recipe from the ingredients left in the fridge. It is not
// one of the seeded products (LettrePro, DescriPro, NomDeMarque) nor the
// BioInsta fixture, so it can be created live without a slug collision. It
// has no theme (a `themeId` is a database id): step 2 picks the seeded "neon"
// theme, which no seeded product uses, falling back to the current one.
const DEMO_THEME_SLUG = "neon";

const DEMO_PRODUCT: Omit<ProductConfig, "themeId"> = {
  slug: "frigo-chef",
  name: "FrigoChef",
  status: "test",
  locale: "fr",
  branding: {},
  landing: {
    headline: "Une recette avec ce qu'il reste dans le frigo",
    subheadline: "Listez vos ingrédients, dites combien de temps vous avez, recevez une recette prête à cuisiner.",
    faq: [
      {
        question: "Combien coûte une recette ?",
        answer: "1 crédit par recette. 2 crédits offerts à l'inscription, et la première recette est gratuite.",
      },
      {
        question: "Puis-je tenir compte d'un régime alimentaire ?",
        answer: "Oui : végétarien, sans gluten ou sans lactose, la recette s'adapte à votre choix.",
      },
      {
        question: "Faut-il avoir tous les ingrédients de la recette ?",
        answer:
          "Non : la recette part de ce que vous avez et n'ajoute que des basiques de placard, comme l'huile ou le sel.",
      },
    ],
    seoTitle: "Générateur de recette avec les restes du frigo",
    seoDescription:
      "Trouvez en 15 secondes une recette avec les ingrédients que vous avez déjà. Essai gratuit, sans carte bancaire.",
    exampleOutput:
      "## Omelette aux courgettes et chèvre\n\n**Temps : 15 min**\n\n1. Râpez la courgette et faites-la revenir 5 min.\n2. Battez 3 œufs, versez-les dessus.\n3. Ajoutez le chèvre émietté, pliez, servez.",
    steps: [
      { title: "Listez vos ingrédients", description: "Ce qu'il y a dans le frigo et les placards." },
      { title: "Donnez vos contraintes", description: "Le temps disponible et votre régime." },
      { title: "Cuisinez", description: "Une recette détaillée, générée en quelques secondes." },
    ],
  },
  inputs: [
    { key: "ingredients", label: "Ingrédients disponibles", type: "textarea", required: true, maxLength: 400 },
    { key: "temps", label: "Temps disponible", type: "select", required: true, options: ["15 min", "30 min", "1 h"] },
    {
      key: "regime",
      label: "Régime",
      type: "select",
      required: false,
      options: ["aucun", "végétarien", "sans gluten", "sans lactose"],
    },
  ],
  generation: {
    model: "anthropic/claude-haiku-4.5",
    systemPrompt:
      "Tu es un cuisinier pragmatique. Tu proposes une seule recette réaliste à partir des ingrédients donnés, en n'ajoutant que des basiques de placard, et tu respectes le régime demandé.",
    promptTemplate:
      "Propose une recette réalisable en {{temps}} avec ces ingrédients : {{ingredients}}. Régime : {{regime}}. Donne un titre, puis les étapes numérotées, en markdown.",
    outputType: "markdown",
  },
  pricing: {
    freeCreditsOnSignup: 2,
    anonymousFreeGenerations: 1,
    costPerGeneration: 1,
    packs: [
      { id: "pack-10", credits: 10, priceCents: 390 },
      { id: "pack-40", credits: 40, priceCents: 1190, recommended: true },
      { id: "pack-100", credits: 100, priceCents: 2490 },
    ],
  },
};

// The part of a fresh demo draft that belongs to `step` (same split as
// ProductForm's `stepPatch`), or nothing for the recap step, which has no
// field to fill. Fresh client-only ids on every call, like `fromConfig`.
export function demoStepPatch(step: number, themes: Theme[], currentThemeId: string): Partial<ProductDraft> {
  const themeId = themes.find((theme) => theme.slug === DEMO_THEME_SLUG)?.id ?? currentThemeId;
  const demo = fromConfig({ ...DEMO_PRODUCT, themeId });
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
