import type { Theme } from "@/lib/dal/themes";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { fromConfig, type ProductDraft } from "./form-values";

// The demo product the ★ button of each step fills in: MailRelance, an
// invented micro-SaaS that writes polite payment-reminder emails. It is not
// one of the seeded products (LettrePro, DescriPro, NomDeMarque) nor the
// BioInsta fixture, so it can be created live without a slug collision. It
// has no theme (a `themeId` is a database id): step 2 picks the seeded "neon"
// theme, which no seeded product uses, falling back to the current one.
const DEMO_THEME_SLUG = "neon";

const DEMO_PRODUCT: Omit<ProductConfig, "themeId"> = {
  slug: "mail-relance",
  name: "MailRelance",
  status: "test",
  locale: "fr",
  branding: {},
  landing: {
    headline: "Relancez vos clients sans les froisser",
    subheadline: "Décrivez la facture impayée, choisissez le ton, recevez un email de relance prêt à envoyer.",
    faq: [
      {
        question: "Combien coûte une relance ?",
        answer: "1 crédit par email. 2 crédits offerts à l'inscription, et la première génération est gratuite.",
      },
      {
        question: "Puis-je adapter le ton ?",
        answer: "Oui : cordial pour un premier rappel, ferme pour une relance tardive.",
      },
      {
        question: "Mes données sont-elles conservées ?",
        answer: "Seul l'historique de vos générations est gardé sur votre compte, pour retrouver un email.",
      },
    ],
    seoTitle: "Générateur d'email de relance de facture",
    seoDescription:
      "Rédigez en 15 secondes un email de relance de facture impayée, au bon ton. Essai gratuit, sans carte bancaire.",
    exampleOutput:
      "Objet : Rappel de la facture n° 2026-042\n\nBonjour Claire,\n\nSauf erreur de ma part, la facture n° 2026-042 de 1 200 € arrivée à échéance le 12 mars n'a pas encore été réglée. Pourriez-vous me confirmer sa date de paiement ?\n\nBien cordialement,\nAlex",
    steps: [
      { title: "Décrivez la situation", description: "Le client, la facture et le retard." },
      { title: "Choisissez le ton", description: "Cordial ou ferme, selon la relance." },
      { title: "Envoyez l'email", description: "Un email prêt à copier, généré en quelques secondes." },
    ],
  },
  inputs: [
    { key: "client", label: "Nom du client", type: "text", required: true, maxLength: 80 },
    { key: "contexte", label: "Facture et retard", type: "textarea", required: true, maxLength: 500 },
    { key: "ton", label: "Ton", type: "select", required: true, options: ["cordial", "ferme"] },
  ],
  generation: {
    model: "anthropic/claude-haiku-4.5",
    systemPrompt:
      "Tu es un assistant de gestion administrative. Tu écris des emails de relance courts, polis et précis, sans menace ni invention de montant ou de date que l'utilisateur n'a pas fournis.",
    promptTemplate:
      "Rédige un email de relance pour {{client}}. Situation : {{contexte}}. Ton : {{ton}}. Donne un objet puis le corps de l'email, sans commentaire.",
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
