// BO-05 step 1: derives the slug from the product name as the admin types,
// until they edit the slug field by hand (docs/02-ecrans.md › BO-05 en
// détail). Output stays within `slugSchema`'s bounds (product-config.ts),
// reserved words aside: those are only rejected once submitted, so the
// checkSlug action can show "ce slug est réservé" on a real value.
const MAX_SLUG_LENGTH = 60;

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (é -> e)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}
