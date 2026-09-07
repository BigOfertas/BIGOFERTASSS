import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import {
  requestMyAffiliateWithdrawal,
  type AffiliateDashboard,
  type PixKeyType,
} from "@/lib/affiliates";
import { getUserFacingError } from "@/lib/user-facing-error";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const PIX_TYPES: Array<{ value: PixKeyType; label: string }> = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
];

function money(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function AffiliateWithdrawalForm({ dashboard }: { dashboard: AffiliateDashboard }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const minimum = dashboard.minimumWithdrawal ?? 60;
  const parsedAmount = Number(amount.replace(",", "."));
  const validAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= minimum &&
    parsedAmount <= dashboard.availableAmount;
  const validPixKey = pixKey.trim().length >= 3 && pixKey.trim().length <= 140;
  const canRequest =
    dashboard.programEnabled &&
    dashboard.status === "active" &&
    dashboard.rulesComplete &&
    dashboard.withdrawalMethod?.toUpperCase() === "PIX" &&
    dashboard.availableAmount >= minimum;

  const helperText = useMemo(() => {
    if (!dashboard.programEnabled) {
      return "Os saques ficam disponíveis quando o programa estiver ativo.";
    }
    if (dashboard.status !== "active") {
      return "Sua participação precisa estar ativa para solicitar saque.";
    }
    if (!dashboard.rulesComplete) {
      return "As regras de saque ainda não estão completas.";
    }
    if (dashboard.availableAmount < minimum) {
      return `Você poderá sacar quando o saldo disponível chegar a ${money(minimum)}.`;
    }
    return `Saque mínimo: ${money(minimum)}. Seu saldo disponível não expira e permanece aqui até você solicitar o pagamento.`;
  }, [
    dashboard.availableAmount,
    dashboard.programEnabled,
    dashboard.rulesComplete,
    dashboard.status,
    minimum,
  ]);

  const mutation = useMutation({
    mutationFn: () => requestMyAffiliateWithdrawal(parsedAmount, pixKeyType, pixKey.trim()),
    onSuccess: async () => {
      setMessage(
        "Solicitação de saque enviada. O pagamento será feito por PIX após a conferência.",
      );
      setErrorMessage("");
      setAmount("");
      setPixKey("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-affiliate-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["my-affiliate-withdrawals"] }),
      ]);
    },
    onError: (error) => {
      setMessage("");
      setErrorMessage(getUserFacingError(error, "Não foi possível solicitar o saque agora."));
    },
  });

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <WalletCards className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-black text-gray-950">Solicitar saque por PIX</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">{helperText}</p>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-[0.7fr_0.8fr_1.5fr_auto] md:items-end">
        <label className="text-sm font-bold text-gray-800">
          Valor do saque
          <div className="mt-1.5 flex h-11 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-50">
            <span className="text-sm font-black text-gray-500">R$</span>
            <input
              type="number"
              min={minimum}
              max={dashboard.availableAmount}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={!canRequest || mutation.isPending}
              className="min-w-0 flex-1 border-0 bg-transparent pl-2 text-sm font-bold outline-none disabled:text-gray-400"
              placeholder={String(minimum).replace(".", ",")}
            />
          </div>
          {canRequest ? (
            <button
              type="button"
              onClick={() => setAmount(String(dashboard.availableAmount))}
              className="mt-1.5 text-xs font-bold text-red-600 hover:text-red-700"
            >
              Sacar todo o saldo disponível
            </button>
          ) : null}
        </label>

        <label className="text-sm font-bold text-gray-800">
          Tipo de chave PIX
          <select
            value={pixKeyType}
            onChange={(event) => setPixKeyType(event.target.value as PixKeyType)}
            disabled={!canRequest || mutation.isPending}
            className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 disabled:bg-gray-100"
          >
            {PIX_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-gray-800">
          Chave PIX
          <input
            value={pixKey}
            onChange={(event) => setPixKey(event.target.value)}
            maxLength={140}
            disabled={!canRequest || mutation.isPending}
            placeholder="Digite a chave que receberá o pagamento"
            className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 disabled:bg-gray-100"
          />
        </label>

        <button
          type="button"
          disabled={!canRequest || !validAmount || !validPixKey || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Solicitar saque
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
        <span>
          Saldo disponível:{" "}
          <strong className="text-gray-800">{money(dashboard.availableAmount)}</strong>
        </span>
        <span>
          Pagamento: <strong className="text-gray-800">PIX</strong>
        </span>
      </div>
    </section>
  );
}
