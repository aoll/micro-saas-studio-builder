"use client";

import type { Route } from "next";
import { Activity, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Theme } from "@/lib/dal/themes";
import type { ProductConfig } from "@/lib/schemas/product-config";
import { Button } from "@/components/ui/button";
import {
  checkSlug,
  estimateGenerationCost,
  publish,
  saveProduct,
  testPrompt,
  type PublishState,
  type SaveProductState,
  uploadLogo,
} from "../../_actions";
import { FieldsStep } from "./fields-step";
import { fromConfig, toConfig, type ProductDraft } from "./form-values";
import { GenerationStep, type GenerationPatch } from "./generation-step";
import { IdentityStep, type IdentityPatch } from "./identity-step";
import { ImportConfigPanel } from "./import-config-panel";
import { LandingPreview } from "./landing-preview";
import { LandingStep } from "./landing-step";
import { estimateMargins } from "./margin";
import { PricingStep } from "./pricing-step";
import type { PromptTestResult } from "./prompt-tester";
import { PromptTester } from "./prompt-tester";
import { STEPS, StepNav } from "./step-nav";
import { SummaryStep } from "./summary-step";
import { ThemeStep, type ThemePatch } from "./theme-step";
import { stepOfPath, validateStep } from "./validation";

const initialState: SaveProductState = {};
const initialPublishState: PublishState = {};

// A patch of `productConfigSchema`'s fields that belong to a given step,
// merged onto `validateStep`'s baseline (see validation.ts).
function stepPatch(step: number, draft: ProductDraft) {
  switch (step) {
    case 1:
      return { slug: draft.slug, name: draft.name, status: draft.status, locale: draft.locale };
    case 2:
      return { themeId: draft.themeId, branding: draft.branding };
    case 3:
      return { landing: draft.landing };
    case 4:
      return { inputs: toConfig(draft).inputs };
    case 5:
      return { generation: draft.generation };
    case 6:
      return { pricing: draft.pricing };
    default:
      return {};
  }
}

// BO-05's full 7-step form (docs/02-ecrans.md): identity, theme, landing &
// SEO, fields (BO-05a), then generation, pricing and the recap that
// publishes (BO-05b). `initialDraft` is either a brand-new draft
// (`newProductDraft`, from the `new` page) or an existing product's latest
// version mapped the same way (the `edit` page).
export function ProductForm({
  mode,
  slug,
  initialDraft,
  themes,
  draftVersion,
  publishedVersion,
}: {
  mode: "create" | "edit";
  slug: string | null;
  initialDraft: ProductDraft;
  themes: Theme[];
  draftVersion?: number;
  publishedVersion?: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>(initialDraft);
  const [slugEdited, setSlugEdited] = useState(mode === "edit");
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [state, formAction, pending] = useActionState(saveProduct.bind(null, slug), initialState);

  // A create-mode publish creates the product on its first success: every
  // publish after that must take the edit path (saveVersion + publish),
  // never createProduct again (plan's design decision 3, risk "second
  // create-mode publish re-creates"). `.bind(null, publishSlug)` is
  // recreated every render so `useActionState` picks up the new slug (it
  // re-binds its own action queue in a passive effect whenever the action
  // argument's identity changes), and `createdSlug` itself is set from the
  // derived-state block below rather than an effect, so the next render
  // (and its rebind) happens before anything else can dispatch a submit.
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const publishSlug = mode === "edit" ? slug : createdSlug;
  const [publishState, publishFormAction, publishPending] = useActionState(
    publish.bind(null, publishSlug),
    initialPublishState,
  );

  // Step 5's « Tester le prompt » result, lifted so step 6's margin panel
  // can prefer the measured cost over the reference estimate once a test
  // has run (plan's design decision 2 and 6).
  const [lastTest, setLastTest] = useState<PromptTestResult | undefined>(undefined);
  const [estimatedCostMicros, setEstimatedCostMicros] = useState(0);
  useEffect(() => {
    let cancelled = false;
    estimateGenerationCost(draft.generation.model).then((result) => {
      if (!cancelled) setEstimatedCostMicros(result.costMicros);
    });
    return () => {
      cancelled = true;
    };
  }, [draft.generation.model]);

  // Derived state, adjusted during render rather than in an effect (React's
  // documented pattern for "adjusting state when a value changes"): each
  // `state` returned by `saveProduct` is a fresh object, so `!==` reliably
  // detects a new action response without an extra flag.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.errors) {
      setErrors(state.errors);
      if (state.step !== undefined && state.step <= STEPS.length) {
        setCurrentStep(state.step);
        setBanner(undefined);
      } else {
        setBanner("Cette configuration a des erreurs dans une étape pas encore disponible.");
      }
    }
  }

  const [handledPublishState, setHandledPublishState] = useState(publishState);
  if (publishState !== handledPublishState) {
    setHandledPublishState(publishState);
    if (publishState.errors) {
      setErrors((current) => ({ ...current, ...publishState.errors }));
      if (publishState.step !== undefined && publishState.step <= STEPS.length) {
        setCurrentStep(publishState.step);
        setBanner(undefined);
      }
    }
    // Captured here rather than in the effect below (both run during the
    // same commit either way, but this keeps every render's `publishSlug`
    // in sync with the state it derives from, with no extra render lag):
    // the next render immediately rebinds `publish.bind(null, publishSlug)`
    // with the created slug, so a second publish takes the edit path.
    if (publishState.ok && publishState.slug && mode === "create") {
      setCreatedSlug(publishState.slug);
    }
  }

  // Side effects (toast, navigation) stay in an effect: they are not state
  // derivations.
  useEffect(() => {
    if (state.ok && state.slug) {
      toast.success(`Brouillon enregistré · version ${state.version}`);
      if (mode === "create") router.replace(`/admin/products/${state.slug}/edit` as Route);
    }
    if (state.formError) toast.error(state.formError);
  }, [state, mode, router]);

  useEffect(() => {
    if (publishState.ok && publishState.slug) {
      toast.success(`Produit publié · version ${publishState.version}`);
      if (mode === "edit") router.refresh();
    }
    if (publishState.formError) toast.error(publishState.formError);
  }, [publishState, mode, router]);

  function patchDraft(patch: Partial<ProductDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  // QA1-P1-M1's import panel (step 1, create mode only, plan decision 3):
  // an imported slug is treated as explicit as a typed one, so it runs
  // through the same availability check `handleIdentityChange` already
  // does. A successful import and a validation-error import never both
  // fire per click (ImportConfigPanel calls exactly one of onImport /
  // onErrors), so there is no race between `setErrors({})` here and a
  // `handleImportErrors` call from the same click.
  function handleImport(config: ProductConfig) {
    setDraft(fromConfig(config));
    setSlugEdited(true);
    setErrors({});
    toast.success("Configuration importée");
    checkSlug(config.slug).then((result) => {
      if (!result.available) setErrors((current) => ({ ...current, slug: result.error ?? "Slug indisponible" }));
    });
  }

  function handleImportErrors(patchErrors: Record<string, string>) {
    setErrors((current) => ({ ...current, ...patchErrors }));
    toast.error("Configuration importée avec des erreurs à corriger");
  }

  function clearError(path: string) {
    setErrors((current) => {
      if (!(path in current)) return current;
      const { [path]: _drop, ...rest } = current;
      return rest;
    });
  }

  function handleIdentityChange(patch: IdentityPatch) {
    const { slugEdited: nextSlugEdited, ...draftPatch } = patch;
    if (nextSlugEdited !== undefined) setSlugEdited(nextSlugEdited);
    if (Object.keys(draftPatch).length > 0) patchDraft(draftPatch);

    if (mode === "create" && draftPatch.slug !== undefined) {
      const candidate = draftPatch.slug;
      checkSlug(candidate).then((result) => {
        if (result.available) clearError("slug");
        else setErrors((current) => ({ ...current, slug: result.error ?? "Slug indisponible" }));
      });
    }
  }

  async function handleUploadLogo(file: File) {
    const data = new FormData();
    data.set("file", file);
    return uploadLogo({}, data);
  }

  async function handleTestPrompt(sample: Record<string, string>): Promise<PromptTestResult> {
    const data = new FormData();
    const config = toConfig(draft);
    data.set("config", JSON.stringify({ inputs: config.inputs, generation: config.generation }));
    data.set("sample", JSON.stringify(sample));
    return testPrompt(publishSlug, {}, data);
  }

  function handleNext() {
    const stepErrors = validateStep(currentStep, stepPatch(currentStep, draft));
    if (Object.keys(stepErrors).length > 0) {
      setErrors((current) => ({ ...current, ...stepErrors }));
      return;
    }
    setCurrentStep((step) => Math.min(step + 1, STEPS.length));
  }

  const stepHasError: Record<number, boolean> = {};
  for (const path of Object.keys(errors)) stepHasError[stepOfPath(path.split("."))] = true;

  const configJson = JSON.stringify(toConfig(draft));
  const isLastStep = currentStep === STEPS.length;

  const selectedTheme = themes.find((theme) => theme.id === draft.themeId) ?? themes[0];
  const aiCostMicros = lastTest?.ok ? (lastTest.costMicros ?? 0) : estimatedCostMicros;
  const costSource: "measured" | "estimated" = lastTest?.ok ? "measured" : "estimated";
  const margins = estimateMargins(draft.pricing.packs, draft.pricing.costPerGeneration, aiCostMicros);

  return (
    <div className="grid grid-cols-[200px_1fr_320px] gap-6">
      <StepNav current={currentStep} onSelect={setCurrentStep} stepErrors={stepHasError} />
      <form action={formAction} className="grid gap-6">
        <input type="hidden" name="config" value={configJson} readOnly />

        {mode === "edit" &&
        draftVersion !== undefined &&
        publishedVersion !== undefined &&
        draftVersion !== publishedVersion ? (
          <p className="text-sm text-muted-foreground">
            brouillon v{draftVersion} · en ligne v{publishedVersion}
          </p>
        ) : null}
        {banner ? (
          <p role="alert" className="text-sm text-destructive">
            {banner}
          </p>
        ) : null}

        {/* "Enregistrer" (the form's default submit) comes before "Publier"
            (SummaryStep's own formAction) in DOM order, so pressing Enter in
            any text field submits a draft save, never a publish. */}
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((s) => s - 1)}
          >
            Précédent
          </Button>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              Enregistrer
            </Button>
            {!isLastStep ? (
              <Button type="button" onClick={handleNext}>
                Suivant
              </Button>
            ) : null}
          </div>
        </div>

        <Activity mode={currentStep === 1 ? "visible" : "hidden"}>
          {mode === "create" ? (
            <ImportConfigPanel
              themes={themes}
              currentThemeId={draft.themeId}
              onImport={handleImport}
              onErrors={handleImportErrors}
            />
          ) : null}
          <IdentityStep
            mode={mode}
            name={draft.name}
            slug={draft.slug}
            status={draft.status}
            locale={draft.locale}
            slugEdited={slugEdited}
            errors={errors}
            onChange={handleIdentityChange}
          />
        </Activity>
        <Activity mode={currentStep === 2 ? "visible" : "hidden"}>
          <ThemeStep
            themes={themes}
            themeId={draft.themeId}
            branding={draft.branding}
            errors={errors}
            onChange={(patch: ThemePatch) => patchDraft(patch)}
            onUploadLogo={handleUploadLogo}
          />
        </Activity>
        <Activity mode={currentStep === 3 ? "visible" : "hidden"}>
          <LandingStep
            landing={draft.landing}
            errors={errors}
            onChange={(patch) => patchDraft({ landing: { ...draft.landing, ...patch } })}
          />
        </Activity>
        <Activity mode={currentStep === 4 ? "visible" : "hidden"}>
          <FieldsStep fields={draft.inputs} errors={errors} onChange={(inputs) => patchDraft({ inputs })} />
        </Activity>
        <Activity mode={currentStep === 5 ? "visible" : "hidden"}>
          <div className="grid gap-6">
            <GenerationStep
              generation={draft.generation}
              inputs={draft.inputs}
              errors={errors}
              onChange={(patch: GenerationPatch) => patchDraft({ generation: { ...draft.generation, ...patch } })}
            />
            <PromptTester
              fields={draft.inputs.map((field) => ({ key: field.key, label: field.label, required: field.required }))}
              onTest={handleTestPrompt}
              onTested={setLastTest}
            />
          </div>
        </Activity>
        <Activity mode={currentStep === 6 ? "visible" : "hidden"}>
          <PricingStep
            pricing={draft.pricing}
            margins={margins}
            costSource={costSource}
            errors={errors}
            onChange={(patch) => patchDraft({ pricing: { ...draft.pricing, ...patch } })}
          />
        </Activity>
        <Activity mode={currentStep === 7 ? "visible" : "hidden"}>
          <SummaryStep
            draft={{
              name: draft.name,
              slug: draft.slug,
              inputsCount: draft.inputs.length,
              packsCount: draft.pricing.packs.length,
            }}
            themeName={selectedTheme?.name ?? ""}
            pending={publishPending}
            state={publishState}
            formAction={publishFormAction}
          />
        </Activity>
      </form>

      {selectedTheme ? (
        <LandingPreview
          slug={draft.slug || "votre-produit"}
          landing={draft.landing}
          pricing={draft.pricing}
          theme={selectedTheme}
          branding={draft.branding}
        />
      ) : null}
    </div>
  );
}
