import { getRequestConfig } from "next-intl/server";
import { app } from "next/root-params";
import { getProduct } from "@/lib/dal/products";
import { loadMessages } from "./load-messages";

// Without i18n routing (docs/08-stack.md): the locale is not a URL segment,
// it comes from the current product's config, read via the [app] root
// param (docs/04-nextjs.md, next/root-params). No product (a route outside
// [app], or an unknown slug) falls back to fr, the backoffice's language.
export default getRequestConfig(async () => {
  const slug = await app();
  const product = slug ? await getProduct(slug) : null;
  const locale = product?.locale ?? "fr";
  return { locale, messages: await loadMessages(locale) };
});
