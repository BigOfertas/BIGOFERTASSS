import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Power, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

import { AffiliateAccountPanel } from "@/components/account/AffiliateAccountPanel";
import {
  activateMyAffiliate,
  deactivateMyAffiliate,
  fetchMyAffiliateDashboard,
} from "@/lib/affiliates";
import { getUserFacingError } from "@/lib/user-facing-error";

export function AffiliateSelfServicePanel() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const dashboardQuery = useQuery({
    queryKey: ["my-affiliate-dashboard"],
    queryFn: fetchMyAffiliateDashboard,
    staleTime: 20_000,
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (action: "activate" | "deactivate") => {
      if (action === "activate") return activateMyAffiliate();
      return deactivateMyAffiliate();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-affiliate-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["my-affiliate-referrals"] });
      await queryClient.invalidateQueries({ queryKey: ["my-affiliate-commissions"] });
      await queryClient.invalidateQueries({ queryKey: ["my-affiliate-withdrawals"] });
    },
  });

  async function runLifecycle(action: "activate" | "deactivate") {
    if (lifecycleMutation.isPending) return;
    setMessage("");
    setErrorMessage("");
    try {
      await lifecycleMutation.mutateAsync(action);
      setMessage(
        action === "activate"
          ? "Seu perfil de afiliado está ativo e seu link exclusivo está pronto."
          : "Seu link de afiliado foi desativado. Seu histórico e suas comissões continuam preservados.",
      );
    } catch (error) {
      setErrorMessage(
        getUserFacingError(error, "Não foi possível atualizar seu perfil de afiliado agora."),
      );
    }
  }

  if (dashboardQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600 motion-reduce:animate-none" />
        <p className="mt-3 text-sm font-semibold text-gray-600">Carregando sua área de afiliados...</p>
      </div>
    );
  }

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white px-6 py-12 text-center shadow-sm">
        <RefreshCw className="mx-auto h-7 w-7 text-red-500" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-black text-gray-950">Não foi possível carregar esta área</h2>
        <button
          type="button"
          onClick={() => void dashboardQuery.refetch()}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard.isAffiliate) {
    return (
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 px-5 py-8 text-white sm:px-7 sm:py-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Programa de afiliados
          </span>
          <h2 className="mt-5 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
            Ganhe indicando novos clientes
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
            Ative seu perfil e o sistema cria um link exclusivo para você. As novas contas cadastradas por esse link ficam vinculadas à sua indicação.
          </p>
          <button
            type="button"
            disabled={!dashboard.programEnabled || lifecycleMutation.isPending}
            onClick={() => void runLifecycle("activate")}
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-500"
          >
            {lifecycleMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {dashboard.programEnabled ? "Quero ser afiliado" : "Programa temporariamente indisponível"}
          </button>
        </div>
        <div className="px-5 py-5 text-sm leading-6 text-gray-600 sm:px-7">
          O link é único, não expira e permanece o mesmo enquanto sua conta existir. Ele só deixa de aceitar novas indicações quando você desativa sua participação ou exclui sua conta.
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <AffiliateAccountPanel />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-gray-950">
              {dashboard.status === "active" ? "Seu link está ativo" : "Seu link está desativado"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
              {dashboard.status === "active"
                ? "Se você não quiser mais receber novas indicações, pode desativar seu link. Seu histórico e suas comissões não são apagados."
                : "Se decidir voltar ao programa, seu mesmo link exclusivo pode ser reativado."}
            </p>
          </div>
          <button
            type="button"
            disabled={lifecycleMutation.isPending || (dashboard.status === "disabled" && !dashboard.programEnabled)}
            onClick={() => void runLifecycle(dashboard.status === "active" ? "deactivate" : "activate")}
            className={`inline-flex h-10 flex-none items-center justify-center rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              dashboard.status === "active"
                ? "border border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:text-red-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {lifecycleMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Power className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {dashboard.status === "active" ? "Desativar meu link" : "Reativar meu link"}
          </button>
        </div>
      </section>
    </div>
  );
}
