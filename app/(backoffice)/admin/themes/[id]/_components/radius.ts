// BO-08's radius slider (plan's design decision 5): 0 to 2rem, step 0.125.
// The frozen `themeTokensSchema` accepts either `rem` or `px`, but the
// slider only ever produces `rem`, so the round trip through the schema is
// exact (no float noise from a px conversion back out).
const PX_PER_REM = 16;
const MIN_REM = 0;
const MAX_REM = 2;

// Reads a persisted radius (rem or px) back into the slider's rem number.
export function radiusToRem(radius: string): number {
  const match = /^(\d+(?:\.\d+)?)(rem|px)$/.exec(radius);
  if (!match) return 0;
  const value = Number(match[1]);
  return match[2] === "px" ? value / PX_PER_REM : value;
}

// Formats the slider's rem number back to a CSS length, clamped to the
// slider's own range so an out-of-range value (e.g. a stale draft) never
// produces a length the schema would reject.
export function remToRadius(rem: number): string {
  const clamped = Math.min(MAX_REM, Math.max(MIN_REM, rem));
  return `${clamped}rem`;
}
