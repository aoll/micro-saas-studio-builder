"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "./margin";

export type PromptTestResult = {
  ok?: boolean;
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  error?: string;
};

// BO-05 step 5's « Tester le prompt » (docs/02-ecrans.md): one sample field
// per input, a real generation run through `testPrompt`, and the measured
// tokens/cost — `onTested` lifts the result to ProductForm so step 6's
// margin panel can use it once available (the plan's design decision 6).
export function PromptTester({
  fields,
  onTest,
  onTested,
}: {
  // B-N2 (.claude/qa/reports/2026-09-25-full-3.md): same reasoning as
  // generation-step.tsx — the client-only `id` (FieldDraft.id,
  // form-values.ts) is the React key, not the editable `key`, which can
  // transiently duplicate another field's while the admin is editing it.
  fields: { id: string; key: string; label: string; required: boolean }[];
  onTest: (sample: Record<string, string>) => Promise<PromptTestResult>;
  onTested?: (result: PromptTestResult) => void;
}) {
  const [sample, setSample] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PromptTestResult>({});

  async function handleTest() {
    setPending(true);
    const nextSample = Object.fromEntries(fields.map((field) => [field.key, sample[field.key] ?? ""]));
    const testResult = await onTest(nextSample);
    setPending(false);
    setResult(testResult);
    onTested?.(testResult);
  }

  return (
    <div className="grid gap-3 rounded-md border p-3">
      {fields.map((field) => (
        <div key={field.id} className="grid gap-1.5">
          <Label htmlFor={`prompt-tester-${field.key}`}>{field.label}</Label>
          <Input
            id={`prompt-tester-${field.key}`}
            value={sample[field.key] ?? ""}
            onChange={(event) => setSample((current) => ({ ...current, [field.key]: event.target.value }))}
          />
        </div>
      ))}

      <Button type="button" onClick={handleTest} disabled={pending}>
        {pending ? "Test en cours…" : "Tester le prompt"}
      </Button>

      {result.error ? (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      ) : null}

      {result.ok ? (
        <div className="grid gap-1 text-sm">
          <p className="whitespace-pre-wrap">{result.output}</p>
          <p className="text-muted-foreground">
            {result.inputTokens} entrée / {result.outputTokens} sortie · {formatUsd(result.costMicros ?? 0)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
