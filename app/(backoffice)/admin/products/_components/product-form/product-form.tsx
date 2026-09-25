"use client";

import type { Route } from "next";
import { Activity, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Theme } from "@/lib/dal/themes";
import { Button } from "@/components/ui/button";
import { checkSlug, saveProduct, type SaveProductState, uploadLogo } from "../../_actions";
import { FieldsStep } from "./fields-step";
import { toConfig, type ProductDraft } from "./form-values";
import { IdentityStep, type IdentityPatch } from "./identity-step";
import { LandingStep } from "./landing-step";
import { STEPS, StepNav } from "./step-nav";
import { ThemeStep, type ThemePatch } from "./theme-step";
import { stepOfPath, validateStep } from "./validation";

const initialState: SaveProductState = {};

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
    default:
      return {};
  }
}

// BO-05's step form (docs/02-ecrans.md), steps 1 to 4 (BO-05a): identity,
// theme, landing & SEO, fields. `initialDraft` is either a brand-new draft
// (`newProductDraft`, from the `new` page) or an existing product's latest
// version mapped the same way (the `edit` page).
export function ProductForm({
  mode,
  slug,
  initialDraft,
  themes,
  readOnly = false,
  draftVersion,
  publishedVersion,
}: {
  mode: "create" | "edit";
  slug: string | null;
  initialDraft: ProductDraft;
  themes: Theme[];
  readOnly?: boolean;
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
        setBanner("Cette configuration a des erreurs dans une étape pas encore disponible (Génération ou Pricing).");
      }
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

  function patchDraft(patch: Partial<ProductDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
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

  return (
    <div className="grid grid-cols-[200px_1fr] gap-6">
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

        <Activity mode={currentStep === 1 ? "visible" : "hidden"}>
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

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((s) => s - 1)}
          >
            Précédent
          </Button>
          {isLastStep ? (
            <Button type="submit" disabled={pending || readOnly}>
              Enregistrer
            </Button>
          ) : (
            <Button type="button" onClick={handleNext}>
              Suivant
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
