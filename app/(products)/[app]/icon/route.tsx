import Icon from "../icon";

// QA2-P1-B2 (specs/qa/QA2-P1-B2-og-icon-404.md): same fix and same reason
// as `../opengraph-image/route.tsx` — see that file's comment for the full
// explanation of `getMetadataRouteSuffix` and why a plain, folder-based
// Route Handler escapes it while the special `icon.tsx` convention file
// (kept unchanged, still auto-wiring the `<link rel="icon">` tag) doesn't.
export async function GET(_request: Request, context: { params: Promise<{ app: string }> }) {
  return Icon(context);
}
