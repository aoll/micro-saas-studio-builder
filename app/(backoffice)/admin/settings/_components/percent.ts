// BO-09 (specs/BO-09-seuils.md): the two conversion thresholds are entered
// in % (docs/02-ecrans.md › BO-09: "conversion « à couper », conversion «
// à scaler » en %"), stored as a rate in [0, 1] (docs/07's
// `numeric(5,4)`). Rounded to 4 decimals before Zod sees it, so a value
// merely re-saved unchanged never drifts from the stored rate by a
// floating-point rounding error.
const RATE_DECIMALS = 1e4;

export function percentToRate(percent: number): number {
  return Math.round((percent / 100) * RATE_DECIMALS) / RATE_DECIMALS;
}

export function rateToPercent(rate: number): number {
  return Math.round(rate * RATE_DECIMALS * 100) / RATE_DECIMALS;
}

// A `<input type="number">`'s raw string value: `""` (cleared field) must
// fail Zod's `.number()` check rather than silently becoming `0`, so it
// parses to `NaN` like an unparsable string does.
export function parsePercentInput(raw: string): number {
  return raw === "" ? NaN : Number(raw);
}
