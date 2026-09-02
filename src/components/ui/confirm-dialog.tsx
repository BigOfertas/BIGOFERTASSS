import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmDialogTone = "danger" | "warning" | "neutral";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const danger = tone === "danger";
  const warning = tone === "warning";

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white p-0 shadow-2xl">
        <div className="p-6 sm:p-7">
          <div
            className={`mb-5 flex h-12 w-12 items-center justify-center rounded-full ${
              danger
                ? "bg-red-50 text-red-600"
                : warning
                  ? "bg-amber-50 text-amber-600"
                  : "bg-gray-100 text-gray-700"
            }`}
          >
            {danger ? (
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            )}
          </div>

          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="text-xl font-black tracking-tight text-gray-950">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-gray-600">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-6 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0">
            <AlertDialogCancel
              disabled={loading}
              className="mt-0 h-11 rounded-lg border-gray-300 px-5 font-bold text-gray-700"
            >
              {cancelLabel}
            </AlertDialogCancel>

            <button
              type="button"
              disabled={loading}
              onClick={() => void onConfirm()}
              className={`inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-bold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
                danger
                  ? "bg-red-600 hover:bg-red-700"
                  : warning
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-gray-900 hover:bg-gray-800"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Aguarde...
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
