import { z } from "zod";

// A CSS color value only: `#hex` or a function call (`oklch()`, `hsl()`,
// `rgb()`, `rgba()`…) whose arguments are digits, `.`, `%`, spaces, `/` or
// `,`. Values are injected verbatim into `style` (docs/04-nextjs.md), so
// anything that could break out of that context (`;`, `}`, `url(`…) is
// rejected.
const cssColorSchema = z
  .string()
  .regex(
    /^(#[0-9a-fA-F]{3,8}|[a-z-]+\([0-9.%\s/,]+\))$/,
    "must be a #hex color or a color function call (oklch, hsl, rgb…)",
  );

// The shadcn/ui CSS variable set (docs/01-produit.md › Thèmes).
const colorTokensSchema = z.object({
  background: cssColorSchema,
  foreground: cssColorSchema,
  card: cssColorSchema,
  cardForeground: cssColorSchema,
  primary: cssColorSchema,
  primaryForeground: cssColorSchema,
  secondary: cssColorSchema,
  secondaryForeground: cssColorSchema,
  muted: cssColorSchema,
  mutedForeground: cssColorSchema,
  accent: cssColorSchema,
  accentForeground: cssColorSchema,
  destructive: cssColorSchema,
  border: cssColorSchema,
  input: cssColorSchema,
  ring: cssColorSchema,
});

// Tokens of a theme (table `themes`, docs/07). `fontKey` and `radius` are
// laid out on the layout's `<html>` element next to the color variables.
export const themeTokensSchema = z.object({
  light: colorTokensSchema,
  dark: colorTokensSchema,
  fontKey: z.string().min(1),
  radius: z.string().regex(/^\d+(\.\d+)?(rem|px)$/, "must be a CSS length in rem or px"),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

// The landing page layout a theme renders (docs/01-produit.md › Thèmes).
export const landingVariantSchema = z.enum(["centered", "split", "minimal"]);

export type LandingVariant = z.infer<typeof landingVariantSchema>;
