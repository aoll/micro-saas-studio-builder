import type { Decision } from "@/lib/decision";
import { Badge } from "@/components/ui/badge";

// docs/02-ecrans.md › BO-02: badge « à couper » / « à scaler » next to the
// status badge. Renders nothing when evaluate() suggests no change.
export function DecisionBadge({ decision }: { decision: Decision }) {
  if (decision === null) return null;
  if (decision === "kill") return <Badge variant="destructive">à couper</Badge>;
  return <Badge variant="default">à scaler</Badge>;
}
