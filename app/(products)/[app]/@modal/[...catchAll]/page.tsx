// Closes the @modal slot on any navigation that is not one of the
// intercepted routes (docs/04-nextjs.md › Les modales en intercepting
// routes): without this catch-all, a soft navigation away from a modal
// route could leave a stale modal slot rendered.
export default function CatchAll() {
  return null;
}
