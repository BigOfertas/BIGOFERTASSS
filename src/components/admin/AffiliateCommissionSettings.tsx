import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Loader2, Save, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchAffiliateCommissionRules,
  fetchAffiliateFixedSettings,
  listAdminAffiliates,
  saveAffiliateCommissionOverrides,
  saveAffiliateFixedSettings,
  type AffiliateCommissionTier,
} from "@/lib/admin-affiliates";
import { getUserFacingError } from "@/lib/user-facing-error";

const TIER_MINIMUMS = [1, 5, 8, 15, 25, 35] as const;
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function money(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function tierLabel(minUnits: number) {
  if (minUnits === 1) return "Padrão (1 a 4 peças)";
  return `A partir de ${minUnits} peças`;
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function AffiliateCommissionSettings() {
  const queryClient = useQueryClient();
  const [tierValues, setTierValues] = useState<Record<number, string>>({});
  const [holdDays, setHoldDays] = useState("");
  const [minimumWithdrawal, setMinimumWithdrawal] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);
  const [overrideValues, setOverrideValues] = useState<Record<number, string>>({});
  const [overridesInitialized, setOverridesInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["admin-affiliate-fixed-settings"],
    queryFn: fetchAffiliateFixedSettings,
    staleTime: 15_000,
  });
  const affiliatesQuery = useQuery({
    queryKey: ["admin-affiliate-fixed-settings", "affiliates"],
    queryFn: () => listAdminAffiliates(""),
    staleTime: 15_000,
  });
  const rulesQuery = useQuery({
    queryKey: ["admin-affiliate-fixed-settings", "rules", selectedAffiliateId],
    queryFn: () => fetchAffiliateCommissionRules(selectedAffiliateId!),
    enabled: Boolean(selectedAffiliateId),
    staleTime: 0,
  });

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data || initialized) return;
    setTierValues(Object.fromEntries(data.commissionTiers.map((tier) => [tier.minUnits, String(tier.amountPerUnit)])));
    setHoldDays(data.holdDays === null ? "" : String(data.holdDays));
    setMinimumWithdrawal(data.minimumWithdrawal === null ? "" : String(data.minimumWithdrawal));
    setWithdrawalMethod(data.withdrawalMethod ?? "");
    setInitialized(true);
  }, [initialized, settingsQuery.data]);

  useEffect(() => {
    const data = rulesQuery.data;
    if (!data || overridesInitialized) return;
    setOverrideValues(Object.fromEntries(data.overrides.map((tier) => [tier.minUnits, String(tier.amountPerUnit)])));
    setOverridesInitialized(true);
  }, [overridesInitialized, rulesQuery.data]);

  const globalTiers = useMemo<AffiliateCommissionTier[]>(() =>
    TIER_MINIMUMS.flatMap((minUnits) => {
      const amountPerUnit = parseMoney(tierValues[minUnits] ?? "");
      return amountPerUnit === null ? [] : [{ minUnits, amountPerUnit }];
    }), [tierValues]);

  const complete = globalTiers.length === TIER_MINIMUMS.length
    && (!holdDays.trim() || (Number.isInteger(Number(holdDays)) && Number(holdDays) >= 0 && Number(holdDays) <= 365))
    && (!minimumWithdrawal.trim() || parseMoney(minimumWithdrawal) !== null)
    && (!withdrawalMethod.trim() || withdrawalMethod.trim().length >= 2);
  const activationComplete = complete && holdDays.trim() !== "" && minimumWithdrawal.trim() !== "" && withdrawalMethod.trim().length >= 2;

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-affiliate"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-affiliate-fixed-settings"] }),
      ]);
    },
  });

  async function run(action: () => Promise<unknown>, success: string) {
    if (mutation.isPending) return;
    setStatusMessage("");
    setErrorMessage("");
    try {
      await mutation.mutateAsync(action);
      setStatusMessage(success);
    } catch (error) {
      setErrorMessage(getUserFacingError(error, "Não foi possível salvar as comissões agora."));
    }
  }

  function settingsPayload(enabled: boolean) {
    return {
      enabled,
      rulesComplete: activationComplete,
      commissionTiers: globalTiers,
      holdDays: holdDays.trim() ? Number(holdDays) : null,
      minimumWithdrawal: minimumWithdrawal.trim() ? parseMoney(minimumWithdrawal) : null,
      withdrawalMethod: withdrawalMethod.trim() || null,
    };
  }

  const selectedAffiliate = (affiliatesQuery.data ?? []).find((row) => row.affiliate_id === selectedAffiliateId) ?? null;
  const ruleGlobals = rulesQuery.data?.globalTiers ?? settingsQuery.data?.commissionTiers ?? [];

  if (settingsQuery.isLoading) {
    return <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-red-600" /><p className="mt-3 text-sm font-semibold text-gray-500">Carregando comissões...</p></div>;
  }

  if (settingsQuery.error || !settingsQuery.data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-5 text-sm font-bold text-red-700">Não foi possível carregar a configuração de comissões.</div>;
  }

  return (
    <section className="space-y-5">
      {statusMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{statusMessage}</p> : null}
      {errorMessage ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errorMessage}</p> : null}

      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-red-600">Comissão geral dos influenciadores</p>
            <h2 className="mt-1 text-xl font-black text-gray-950">Valor fixo por peça</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">O valor da faixa é pago por peça do pedido. A faixa mais alta atingida vale para todas as peças daquele pedido. Todos os valores ficam visíveis ao mesmo tempo para facilitar promoções futuras.</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${settingsQuery.data.enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{settingsQuery.data.enabled ? "Programa ativo" : "Programa desligado"}</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {TIER_MINIMUMS.map((minUnits) => (
            <label key={minUnits} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs font-bold text-gray-700">
              {tierLabel(minUnits)}
              <div className="mt-2 flex items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-50">
                <span className="text-sm font-black text-gray-500">R$</span>
                <input type="number" min="0.01" step="0.01" value={tierValues[minUnits] ?? ""} onChange={(event) => setTierValues((current) => ({ ...current, [minUnits]: event.target.value }))} className="h-10 min-w-0 flex-1 border-0 bg-transparent pl-2 text-sm font-black text-gray-950 outline-none" />
              </div>
            </label>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-bold text-gray-800">Liberação (dias)<input type="number" min="0" max="365" step="1" value={holdDays} onChange={(event) => setHoldDays(event.target.value)} placeholder="A definir" className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50" /></label>
          <label className="text-sm font-bold text-gray-800">Saque mínimo (R$)<input type="number" min="0.01" step="0.01" value={minimumWithdrawal} onChange={(event) => setMinimumWithdrawal(event.target.value)} placeholder="A definir" className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50" /></label>
          <label className="text-sm font-bold text-gray-800">Forma de pagamento<input value={withdrawalMethod} onChange={(event) => setWithdrawalMethod(event.target.value)} maxLength={60} placeholder="A definir" className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50" /></label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" disabled={mutation.isPending || !complete} onClick={() => void run(() => saveAffiliateFixedSettings(settingsPayload(settingsQuery.data.enabled)), "Configuração geral salva.")} className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:opacity-50"><Save className="mr-2 h-4 w-4" />Salvar alterações</button>
          {!settingsQuery.data.enabled ? (
            <button type="button" disabled={mutation.isPending || !activationComplete} onClick={() => void run(() => saveAffiliateFixedSettings(settingsPayload(true)), "Programa de afiliados ativado.")} className="inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700 disabled:bg-gray-300">Ativar programa</button>
          ) : (
            <button type="button" disabled={mutation.isPending || !complete} onClick={() => void run(() => saveAffiliateFixedSettings(settingsPayload(false)), "Programa de afiliados desativado. O histórico foi preservado.")} className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50">Desativar programa</button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 h-5 w-5 flex-none text-red-600" /><div><h2 className="font-black text-gray-950">Comissão individual por afiliado</h2><p className="mt-1 text-sm leading-6 text-gray-500">Escolha um afiliado para criar exceções. Ao editar, as seis faixas aparecem juntas. Campo vazio significa “usar o valor geral”.</p></div></div>

        {affiliatesQuery.isLoading ? <div className="py-8 text-center text-sm text-gray-500">Carregando afiliados...</div> : (affiliatesQuery.data ?? []).length === 0 ? <div className="py-8 text-center text-sm text-gray-500">Nenhum afiliado cadastrado.</div> : (
          <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {(affiliatesQuery.data ?? []).map((row) => (
              <button key={row.affiliate_id} type="button" onClick={() => { setSelectedAffiliateId(row.affiliate_id); setOverridesInitialized(false); setOverrideValues({}); }} className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm transition ${selectedAffiliateId === row.affiliate_id ? "border-red-300 bg-red-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}><span className="min-w-0"><span className="block truncate font-black text-gray-950">{row.full_name || row.email || "Afiliado"}</span><span className="mt-0.5 block text-xs font-mono text-gray-500">{row.referral_code}</span></span><Settings2 className="ml-3 h-4 w-4 flex-none text-gray-400" /></button>
            ))}
          </div>
        )}

        {selectedAffiliateId ? (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50/40 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-red-600">Editando comissão individual</p><h3 className="mt-1 font-black text-gray-950">{selectedAffiliate?.full_name || selectedAffiliate?.email || "Afiliado"}</h3></div><button type="button" onClick={() => setSelectedAffiliateId(null)} className="rounded-lg p-2 text-gray-500 hover:bg-white" aria-label="Fechar edição individual"><X className="h-4 w-4" /></button></div>
            {rulesQuery.isLoading ? <div className="py-8 text-center text-sm text-gray-500">Carregando regras...</div> : rulesQuery.error ? <div className="py-8 text-center text-sm font-bold text-red-700">Não foi possível carregar as regras desse afiliado.</div> : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  {TIER_MINIMUMS.map((minUnits) => {
                    const global = ruleGlobals.find((tier) => tier.minUnits === minUnits)?.amountPerUnit ?? 0;
                    return <label key={minUnits} className="rounded-lg border border-gray-200 bg-white p-3 text-xs font-bold text-gray-700">{tierLabel(minUnits)}<p className="mt-1 text-[11px] font-semibold text-gray-400">Geral: {money(global)}</p><input type="number" min="0.01" step="0.01" value={overrideValues[minUnits] ?? ""} onChange={(event) => setOverrideValues((current) => ({ ...current, [minUnits]: event.target.value }))} placeholder="Usar geral" className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-black outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50" /></label>;
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-gray-500">Exemplo: para uma promoção exclusiva acima de 35 peças, deixe as outras cinco faixas vazias e informe apenas o novo valor em “A partir de 35 peças”.</p>
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={mutation.isPending} onClick={() => { const overrides = TIER_MINIMUMS.flatMap((minUnits) => { const raw = (overrideValues[minUnits] ?? "").trim(); if (!raw) return []; const amountPerUnit = parseMoney(raw); return amountPerUnit === null ? [] : [{ minUnits, amountPerUnit }]; }); const invalid = TIER_MINIMUMS.some((minUnits) => (overrideValues[minUnits] ?? "").trim() && parseMoney(overrideValues[minUnits] ?? "") === null); if (invalid) { setErrorMessage("Revise os valores individuais informados."); return; } void run(() => saveAffiliateCommissionOverrides(selectedAffiliateId, overrides), "Comissão individual salva."); }} className="inline-flex h-10 items-center rounded-lg bg-gray-950 px-4 text-sm font-black text-white hover:bg-black disabled:opacity-50"><Save className="mr-2 h-4 w-4" />Salvar comissão individual</button><button type="button" disabled={mutation.isPending} onClick={() => { setOverrideValues({}); void run(() => saveAffiliateCommissionOverrides(selectedAffiliateId, []), "Valores individuais removidos. Este afiliado voltou a usar a regra geral."); }} className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Usar tudo do geral</button></div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
