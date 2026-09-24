// Required by parallel routes since Next.js 16 (docs/04-nextjs.md): the
// @modal slot has no content unless a route intercepted by (.)checkout or
// (.)signup is active.
export default function Default() {
  return null;
}
