import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND } from "@/config/brand";
import { REFUND_REASON_LABELS, type RefundReason } from "@/lib/orders";

const REASONS = Object.entries(REFUND_REASON_LABELS) as Array<
  [RefundReason, string]
>;

export function RefundRequestDialog({
  open,
  onOpenChange,
  loading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onSubmit: (reason: RefundReason, message: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<RefundReason>("arrependimento");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("arrependimento");
      setMessage("");
      setErrorMessage("");
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (reason === "outro" && message.trim().length < 3) {
      setErrorMessage("Conte brevemente o motivo da solicitação.");
      return;
    }

    setErrorMessage("");

    try {
      await onSubmit(reason, message);
    } catch {
      setErrorMessage(
        "Não foi possível enviar sua solicitação agora. Tente novamente.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white p-0 shadow-2xl">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="border-b border-gray-100 bg-gradient-to-br from-orange-50 to-white p-6 sm:p-7">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-700">
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl font-black tracking-tight text-gray-950">
                Solicitar reembolso
              </DialogTitle>
              <DialogDescription className="leading-6 text-gray-600">
                A {BRAND.officialName} receberá sua solicitação e entrará em contato.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 p-6 sm:p-7">
            <label className="block text-sm font-bold text-gray-800">
              Motivo
              <select
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as RefundReason)
                }
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
              >
                {REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-gray-800">
              Mensagem{" "}
              {reason !== "outro" ? (
                <span className="font-normal text-gray-400">(opcional)</span>
              ) : null}
              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value.slice(0, 1000))
                }
                required={reason === "outro"}
                minLength={reason === "outro" ? 3 : undefined}
                rows={4}
                placeholder="Se quiser, explique brevemente o que aconteceu."
                className="mt-2 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
              />
              <span className="mt-1 block text-right text-[11px] font-medium text-gray-400">
                {message.length}/1000
              </span>
            </label>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900">
              O reembolso será analisado após o contato com você.
            </div>

            {errorMessage ? (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {errorMessage}
              </p>
            ) : null}

            <DialogFooter className="gap-2 border-t border-gray-100 pt-5 sm:space-x-0">
              <button
                type="button"
                disabled={loading}
                onClick={() => onOpenChange(false)}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Enviando...
                  </>
                ) : (
                  "Enviar solicitação"
                )}
              </button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
