"use client";

import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useRef, useState } from "react";
import { useBalanceDelta } from "@/components/product/balance";
import { DynamicField } from "@/components/product/dynamic-field";
import { ResultCard } from "@/components/product/result-card";
import { Button } from "@/components/ui/button";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { toolInputSchema, type ToolInputFieldErrors } from "../_lib/tool-input-schema";
import { GenerationFailedError, readUiMessageStream } from "./read-ui-message-stream";

type Field = ProductConfig["inputs"][number];
type Status = "idle" | "submitting" | "streaming" | "error";

// SA-02: generated from `config.inputs` (DynamicField, one render per
// field type), streams the result from api/generate (readUiMessageStream,
// orchestrator decision 4: no @ai-sdk/react), and applies the optimistic
// balance overlay (components/product/balance.tsx) for the whole submit →
// stream → refresh transition.
export function ToolForm({
  slug,
  inputs,
  costPerGeneration,
}: {
  slug: string;
  inputs: Field[];
  costPerGeneration: number;
}) {
  const t = useTranslations("tool");
  const router = useRouter();
  const addDelta = useBalanceDelta();

  const [fieldErrors, setFieldErrors] = useState<ToolInputFieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const lastInputRef = useRef<Record<string, string> | null>(null);

  function statusMessage(httpStatus: number): string {
    if (httpStatus === 429) return t("errors.rateLimited");
    if (httpStatus === 403) return t("errors.bot");
    if (httpStatus === 409) return t("errors.duplicate");
    return t("errors.unexpected");
  }

  async function submit(inputValues: Record<string, string>) {
    const validation = toolInputSchema(inputs, inputValues);
    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    setFieldErrors({});
    setErrorMessage(null);
    setText("");
    setStatus("submitting");
    lastInputRef.current = inputValues;
    const idempotencyKey = crypto.randomUUID();
    let isAnonymous = false;

    startTransition(async () => {
      addDelta(-costPerGeneration);
      try {
        const response = await fetch(`/${slug}/api/generate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: inputValues, idempotencyKey }),
        });

        if (response.status === 402) {
          router.push(`/${slug}/pricing`);
          return;
        }
        if (response.status === 401) {
          // typedRoutes only accepts a template literal directly in a JSX
          // href; router.push() is outside JSX, hence the cast (the route
          // itself exists, SA-03).
          router.push(`/${slug}/signup` as Route);
          return;
        }
        if (response.status === 400) {
          const body = (await response.json()) as { fieldErrors?: ToolInputFieldErrors };
          setFieldErrors(body.fieldErrors ?? {});
          setStatus("idle");
          return;
        }
        if (!response.ok || !response.body) {
          setErrorMessage(statusMessage(response.status));
          setStatus("error");
          return;
        }

        isAnonymous = response.headers.get("x-free-generations-left") !== null;
        setGenerationId(response.headers.get("x-generation-id"));
        setStatus("streaming");

        try {
          for await (const delta of readUiMessageStream(response.body)) {
            setText((previous) => previous + delta);
          }
          setStatus("idle");
          if (response.headers.get("x-free-generations-left") === "0") {
            // Same as above: router.push() is outside JSX, so the cast stays.
            router.push(`/${slug}/signup` as Route);
          }
        } catch (streamError) {
          setStatus("error");
          if (streamError instanceof GenerationFailedError) {
            setErrorMessage(isAnonymous ? t("errors.failedFree") : t("errors.failedRefunded"));
          } else {
            setErrorMessage(t("errors.unexpected"));
            console.error("[ToolForm] stream reading failed", streamError);
          }
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage(t("errors.unexpected"));
        console.error("[ToolForm] generate request failed", error);
      } finally {
        router.refresh();
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const inputValues = Object.fromEntries(inputs.map((field) => [field.key, String(formData.get(field.key) ?? "")]));
    void submit(inputValues);
  }

  function handleRegenerate() {
    if (lastInputRef.current) void submit(lastInputRef.current);
  }

  const busy = status === "submitting" || status === "streaming";

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit} className="grid gap-4">
        {inputs.map((field) => (
          <DynamicField
            key={field.key}
            field={field}
            error={fieldErrors[field.key] ? t(`errors.${fieldErrors[field.key]}`) : undefined}
          />
        ))}
        <p className="text-sm text-muted-foreground">{t("costLine", { count: costPerGeneration })}</p>
        <Button type="submit" disabled={busy}>
          {status === "submitting" || status === "streaming"
            ? t("generating")
            : t("generate", { count: costPerGeneration })}
        </Button>
      </form>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
          {status === "error" ? (
            <Button type="button" variant="link" onClick={handleRegenerate}>
              {t("retry")}
            </Button>
          ) : null}
        </p>
      ) : null}

      {text ? (
        <ResultCard
          output={{ kind: "markdown", text }}
          fileName={`${slug}-${generationId ?? "draft"}`}
          onRegenerate={handleRegenerate}
          streaming={status === "streaming"}
        />
      ) : null}
    </div>
  );
}
