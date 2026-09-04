import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PackageCheck, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { transitionOrder } from "@/lib/orders";

export function OrderShippingControl({
  orderId,
  publicNumber,
}: {
  orderId: string;
  publicNumber: string;
}) {
  const queryClient = useQueryClient();
  const [trackingCode, setTrackingCode] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedTrackingCode = trackingCode.trim();
  const canConfirm = normalizedTrackingCode.length >= 3 && !saving;

  async function confirmShipment() {
    if (!canConfirm) return;

    setSaving(true);
    setErrorMessage("");

    try {
      await transitionOrder(orderId, "shipped", normalizedTrackingCode);
      setConfirmOpen(false);
      setTrackingCode("");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({
          queryKey: ["admin-order-detail", publicNumber],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);

      toast.success("Pedido marcado como enviado e rastreio salvo.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o envio agora.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
                Envio e rastreio
              </p>
              <h3 className="mt-1 text-base font-black text-gray-950">
                Informe o código antes de marcar como enviado
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                Cole abaixo o código fornecido pela SuperFrete ou pela transportadora. Ao confirmar, o pedido será marcado como enviado e o cliente verá esse mesmo código na área dele.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-sky-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-sky-700">
            <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Próxima etapa: enviado
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-bold text-gray-700">
              Código de rastreio da transportadora
            </span>
            <input
              type="text"
              value={trackingCode}
              onChange={(event) => setTrackingCode(event.target.value)}
              maxLength={120}
              autoComplete="off"
              spellCheck={false}
              placeholder="Ex.: AA123456789BR"
              className="mt-1.5 h-11 w-full rounded-xl border border-sky-200 bg-white px-3 font-mono text-sm font-semibold tracking-wide text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10"
            />
          </label>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-gray-950 px-5 text-sm font-black text-white transition hover:bg-sky-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none motion-reduce:transition-none"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Confirmar envio e salvar rastreio
          </button>
        </div>

        <p className="mt-3 text-xs leading-5 text-gray-500">
          Depois da confirmação, o cliente encontra o código em <strong>Minha Conta → Pedidos → {publicNumber} → Entrega</strong>.
        </p>

        {errorMessage ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!saving) setConfirmOpen(open);
        }}
        title="Confirmar envio do pedido?"
        description={`O pedido será marcado como enviado e o código ${normalizedTrackingCode || "informado"} ficará visível para o cliente. Confira o código antes de continuar.`}
        confirmLabel="Confirmar envio"
        cancelLabel="Revisar código"
        tone="neutral"
        loading={saving}
        onConfirm={confirmShipment}
      />
    </>
  );
}
