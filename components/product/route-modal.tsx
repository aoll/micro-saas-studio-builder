"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";

// docs/04-nextjs.md › Les modales en intercepting routes: SA-03/SA-04/SA-05
// each open on top of the outil with their own URL; closing (Escape, the
// close button, or the backdrop) goes back to that URL via router.back(),
// exactly like the browser's own back button. Always open: the intercepted
// page IS the modal's content.
export function RouteModal({ children, title }: { children: ReactNode; title: string }) {
  const router = useRouter();
  const t = useTranslations("common.modal");

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent
        showCloseButton={false}
        className="h-dvh max-h-dvh w-dvw max-w-dvw sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg"
      >
        <DialogTitle>{title}</DialogTitle>
        {children}
        <DialogClose className="absolute top-4 right-4 rounded-xs opacity-70 hover:opacity-100">
          <XIcon />
          <span className="sr-only">{t("close")}</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
