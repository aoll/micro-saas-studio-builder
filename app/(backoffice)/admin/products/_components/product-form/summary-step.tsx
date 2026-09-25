"use client";

import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PublishState } from "../../_actions";

export type SummaryDraft = { name: string; slug: string; inputsCount: number; packsCount: number };

// BO-05 step 7 (docs/02-ecrans.md): a recap, then « Publier ». Rendered
// inside ProductForm's single <form>: `formAction` is the Publier button's
// own React 19 `formAction` attribute (its own useActionState, next to the
// form's default `action` used by « Enregistrer » on every other step —
// the plan's design decision 3).
export function SummaryStep({
  draft,
  themeName,
  pending,
  state,
  formAction,
}: {
  draft: SummaryDraft;
  themeName: string;
  pending: boolean;
  state: PublishState;
  formAction: (formData: FormData) => void;
}) {
  return (
    <div className="grid gap-4">
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between border-b pb-1">
          <dt className="text-muted-foreground">Nom</dt>
          <dd>{draft.name}</dd>
        </div>
        <div className="flex justify-between border-b pb-1">
          <dt className="text-muted-foreground">Slug</dt>
          <dd>{draft.slug}</dd>
        </div>
        <div className="flex justify-between border-b pb-1">
          <dt className="text-muted-foreground">Thème</dt>
          <dd>{themeName}</dd>
        </div>
        <div className="flex justify-between border-b pb-1">
          <dt className="text-muted-foreground">Champs de l&apos;outil</dt>
          <dd>{draft.inputsCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Packs de crédits</dt>
          <dd>{draft.packsCount}</dd>
        </div>
      </dl>

      <Button type="submit" formAction={formAction} disabled={pending}>
        Publier
      </Button>

      {state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}

      {state.ok && state.url ? (
        <p className="text-sm">
          Produit publié ·{" "}
          <Link href={state.url as Route} className="underline">
            Voir {state.url}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
