from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_exact(path: str, before: str, after: str) -> None:
    source = read(path)
    if before not in source:
        raise RuntimeError(f"Expected block not found in {path}: {before[:120]!r}")
    write(path, source.replace(before, after, 1))


def replace_regex(path: str, pattern: str, after: str, flags: int = 0) -> None:
    source = read(path)
    updated, count = re.subn(pattern, after, source, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Expected pattern not found exactly once in {path}: {pattern}")
    write(path, updated)


migration = r'''BEGIN;

-- Regras comerciais confirmadas do programa de afiliados:
-- comissao fixa por peca, liberacao imediata, saque minimo de R$ 60 e PIX.
-- O saldo disponivel nao expira e permanece contabilizado ate o saque.

UPDATE public.affiliate_program_settings
SET hold_days = 0,
    minimum_withdrawal = 60.00,
    withdrawal_method = 'PIX',
    updated_at = now()
WHERE singleton = true;

CREATE OR REPLACE FUNCTION public.owner_get_affiliate_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.affiliate_program_settings%ROWTYPE;
  affiliates_count bigint := 0;
  active_affiliates_count bigint := 0;
  referrals_count bigint := 0;
  pending_commission numeric(12,2) := 0;
  available_commission numeric(12,2) := 0;
  requested_withdrawals numeric(12,2) := 0;
  paid_withdrawals numeric(12,2) := 0;
  requested_withdrawals_count bigint := 0;
  refund_reviews_count bigint := 0;
  tier_count integer := 0;
  rules_complete boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;

  SELECT count(*) INTO tier_count
  FROM public.affiliate_commission_tiers;

  rules_complete :=
    tier_count = 6
    AND settings_row.hold_days IS NOT NULL
    AND settings_row.minimum_withdrawal IS NOT NULL
    AND settings_row.withdrawal_method IS NOT NULL;

  SELECT count(*), count(*) FILTER (WHERE status = 'active')
  INTO affiliates_count, active_affiliates_count
  FROM public.affiliates;

  SELECT count(*) INTO referrals_count FROM public.affiliate_referrals;

  SELECT
    COALESCE(sum(commission_amount) FILTER (WHERE status = 'pending'), 0),
    COALESCE(sum(commission_amount) FILTER (WHERE status = 'available'), 0)
  INTO pending_commission, available_commission
  FROM public.affiliate_commissions;

  SELECT
    COALESCE(sum(amount) FILTER (WHERE status = 'requested'), 0),
    COALESCE(sum(amount) FILTER (WHERE status = 'paid'), 0),
    count(*) FILTER (WHERE status = 'requested')
  INTO requested_withdrawals, paid_withdrawals, requested_withdrawals_count
  FROM public.affiliate_withdrawals;

  SELECT count(*) INTO refund_reviews_count
  FROM public.affiliate_refund_reviews
  WHERE status = 'pending';

  RETURN jsonb_build_object(
    'enabled', settings_row.enabled,
    'rulesComplete', rules_complete,
    'holdDays', settings_row.hold_days,
    'minimumWithdrawal', settings_row.minimum_withdrawal,
    'withdrawalMethod', settings_row.withdrawal_method,
    'affiliatesCount', affiliates_count,
    'activeAffiliatesCount', active_affiliates_count,
    'referralsCount', referrals_count,
    'pendingCommissionAmount', pending_commission,
    'availableCommissionGrossAmount', available_commission,
    'requestedWithdrawalAmount', requested_withdrawals,
    'paidWithdrawalAmount', paid_withdrawals,
    'unreservedAvailableAmount', greatest(available_commission - requested_withdrawals - paid_withdrawals, 0),
    'requestedWithdrawalsCount', requested_withdrawals_count,
    'refundReviewsCount', refund_reviews_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_my_affiliate_withdrawal(
  p_amount numeric,
  p_destination_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS public.affiliate_withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  affiliate_row public.affiliates%ROWTYPE;
  settings_row public.affiliate_program_settings%ROWTYPE;
  available_total numeric(12,2);
  reserved_total numeric(12,2);
  withdrawal_row public.affiliate_withdrawals%ROWTYPE;
  destination_method text;
  pix_key_type text;
  pix_key text;
  normalized_destination jsonb;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;

  SELECT * INTO affiliate_row
  FROM public.affiliates
  WHERE user_id = current_user_id
  FOR UPDATE;

  IF affiliate_row.id IS NULL OR affiliate_row.status <> 'active' THEN
    RAISE EXCEPTION 'Conta de afiliado ativa nao encontrada';
  END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;

  IF NOT settings_row.enabled THEN
    RAISE EXCEPTION 'Programa de afiliados ainda nao esta ativo';
  END IF;
  IF settings_row.minimum_withdrawal IS NULL OR settings_row.withdrawal_method IS NULL THEN
    RAISE EXCEPTION 'Regra de saque ainda nao configurada';
  END IF;
  IF p_amount IS NULL OR p_amount < settings_row.minimum_withdrawal THEN
    RAISE EXCEPTION 'Valor abaixo do saque minimo';
  END IF;
  IF p_destination_snapshot IS NULL
     OR jsonb_typeof(p_destination_snapshot) <> 'object'
     OR length(p_destination_snapshot::text) > 4000 THEN
    RAISE EXCEPTION 'Dados do PIX invalidos';
  END IF;

  destination_method := upper(btrim(COALESCE(p_destination_snapshot ->> 'method', '')));
  IF destination_method <> 'PIX' OR upper(btrim(settings_row.withdrawal_method)) <> 'PIX' THEN
    RAISE EXCEPTION 'A forma de pagamento disponivel e PIX';
  END IF;

  pix_key_type := lower(btrim(COALESCE(p_destination_snapshot ->> 'pixKeyType', '')));
  IF pix_key_type NOT IN ('cpf', 'cnpj', 'email', 'phone', 'random') THEN
    RAISE EXCEPTION 'Tipo de chave PIX invalido';
  END IF;

  pix_key := btrim(COALESCE(p_destination_snapshot ->> 'pixKey', ''));
  IF length(pix_key) NOT BETWEEN 3 AND 140 THEN
    RAISE EXCEPTION 'Chave PIX invalida';
  END IF;

  normalized_destination := jsonb_build_object(
    'method', 'PIX',
    'pixKeyType', pix_key_type,
    'pixKey', pix_key
  );

  PERFORM public.release_due_affiliate_commissions(affiliate_row.id);

  SELECT COALESCE(sum(commission_amount),0) INTO available_total
  FROM public.affiliate_commissions
  WHERE affiliate_id = affiliate_row.id AND status = 'available';

  SELECT COALESCE(sum(amount),0) INTO reserved_total
  FROM public.affiliate_withdrawals
  WHERE affiliate_id = affiliate_row.id AND status IN ('requested','paid');

  IF p_amount > greatest(available_total - reserved_total, 0) THEN
    RAISE EXCEPTION 'Saldo disponivel insuficiente';
  END IF;

  INSERT INTO public.affiliate_withdrawals (affiliate_id, amount, destination_snapshot)
  VALUES (affiliate_row.id, round(p_amount, 2), normalized_destination)
  RETURNING * INTO withdrawal_row;

  INSERT INTO public.notification_events (
    user_id, order_id, event_name, payload, idempotency_key
  )
  VALUES (
    current_user_id,
    NULL,
    'affiliate.withdrawal.requested',
    jsonb_build_object(
      'withdrawal_amount', withdrawal_row.amount,
      'withdrawal_method', 'PIX'
    ),
    'affiliate.withdrawal.requested:' || withdrawal_row.id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN withdrawal_row;
END;
$$;

-- Com prazo zero, a nova comissao nasce disponivel imediatamente. Isso evita
-- depender de uma visita ao painel ou do processador de notificacoes para
-- transformar um saldo que ja deveria estar liberado.
CREATE OR REPLACE FUNCTION public.create_affiliate_commission_for_paid_order(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_row public.orders%ROWTYPE;
  referral_row public.affiliate_referrals%ROWTYPE;
  affiliate_row public.affiliates%ROWTYPE;
  settings_row public.affiliate_program_settings%ROWTYPE;
  commission_row public.affiliate_commissions%ROWTYPE;
  order_units integer := 0;
  tier_row record;
  commission_amount numeric(12,2);
  initial_status text;
  initial_available_since timestamptz;
BEGIN
  SELECT * INTO order_row FROM public.orders WHERE id = p_order_id;
  IF order_row.id IS NULL OR order_row.payment_status <> 'paid'::public.order_payment_status THEN
    RETURN NULL;
  END IF;

  SELECT * INTO referral_row
  FROM public.affiliate_referrals
  WHERE referred_user_id = order_row.user_id;
  IF referral_row.referred_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO affiliate_row
  FROM public.affiliates
  WHERE id = referral_row.affiliate_id AND status = 'active';
  IF affiliate_row.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true AND enabled;
  IF settings_row.singleton IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(sum(quantity), 0)::integer
  INTO order_units
  FROM public.order_items
  WHERE order_id = order_row.id;
  IF order_units <= 0 THEN RETURN NULL; END IF;

  SELECT * INTO tier_row
  FROM public.resolve_affiliate_commission_tier(affiliate_row.id, order_units);
  IF tier_row.amount_per_unit IS NULL THEN RETURN NULL; END IF;

  commission_amount := round(order_units * tier_row.amount_per_unit, 2);
  IF commission_amount <= 0 THEN RETURN NULL; END IF;

  initial_status := CASE WHEN settings_row.hold_days = 0 THEN 'available' ELSE 'pending' END;
  initial_available_since := CASE WHEN settings_row.hold_days = 0 THEN now() ELSE NULL END;

  INSERT INTO public.affiliate_commissions (
    affiliate_id,
    referred_user_id,
    order_id,
    order_public_number,
    sale_amount,
    commission_base_amount,
    commission_rate_bps,
    commission_units,
    commission_unit_amount,
    commission_rule_source,
    commission_amount,
    status,
    available_at,
    available_since
  )
  VALUES (
    affiliate_row.id,
    order_row.user_id,
    order_row.id,
    order_row.public_number,
    order_row.total_amount,
    NULL,
    NULL,
    order_units,
    tier_row.amount_per_unit,
    tier_row.rule_source,
    commission_amount,
    initial_status,
    COALESCE(order_row.paid_at, now()) + make_interval(days => settings_row.hold_days),
    initial_available_since
  )
  ON CONFLICT (order_id) DO NOTHING
  RETURNING * INTO commission_row;

  IF commission_row.id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.notification_events (
    user_id, order_id, event_name, payload, idempotency_key
  )
  VALUES (
    affiliate_row.user_id,
    order_row.id,
    'affiliate.commission.created',
    jsonb_build_object(
      'order_number', order_row.public_number,
      'sale_amount', order_row.total_amount,
      'commission_amount', commission_row.commission_amount,
      'commission_units', commission_row.commission_units,
      'commission_unit_amount', commission_row.commission_unit_amount,
      'commission_rule_source', commission_row.commission_rule_source,
      'commission_status', commission_row.status
    ),
    'affiliate.commission.created:' || commission_row.id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN commission_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_my_affiliate_withdrawal(numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_my_affiliate_withdrawal(numeric, jsonb) TO authenticated;

COMMIT;'''
write("supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql", migration)

withdrawal_form = r'''import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  }, [dashboard.availableAmount, dashboard.programEnabled, dashboard.rulesComplete, dashboard.status, minimum]);

  const mutation = useMutation({
    mutationFn: () => requestMyAffiliateWithdrawal(parsedAmount, pixKeyType, pixKey.trim()),
    onSuccess: async () => {
      setMessage("Solicitação de saque enviada. O pagamento será feito por PIX após a conferência.");
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
      setErrorMessage(
        getUserFacingError(error, "Não foi possível solicitar o saque agora."),
      );
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
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
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
          Saldo disponível: <strong className="text-gray-800">{money(dashboard.availableAmount)}</strong>
        </span>
        <span>
          Pagamento: <strong className="text-gray-800">PIX</strong>
        </span>
      </div>
    </section>
  );
}
'''
write("src/components/account/AffiliateWithdrawalForm.tsx", withdrawal_form)

affiliates_path = "src/lib/affiliates.ts"
affiliates = read(affiliates_path)
if "export type PixKeyType" not in affiliates:
    affiliates += r'''

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export function requestMyAffiliateWithdrawal(
  amount: number,
  pixKeyType: PixKeyType,
  pixKey: string,
) {
  return callSupabaseRpc<AffiliateWithdrawalRow>("request_my_affiliate_withdrawal", {
    p_amount: amount,
    p_destination_snapshot: {
      method: "PIX",
      pixKeyType,
      pixKey: pixKey.trim(),
    },
  });
}
'''
    write(affiliates_path, affiliates)

account_path = "src/components/account/AffiliateAccountPanel.tsx"
replace_exact(
    account_path,
    'import { BRAND } from "@/config/brand";',
    'import { AffiliateWithdrawalForm } from "@/components/account/AffiliateWithdrawalForm";\nimport { BRAND } from "@/config/brand";',
)
replace_exact(
    account_path,
    '''      {!dashboard.rulesComplete ? (\n        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">''',
    '''      <AffiliateWithdrawalForm dashboard={dashboard} />\n\n      {!dashboard.rulesComplete ? (\n        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">''',
)
replace_exact(
    account_path,
    '''                        <p className="mt-1 text-xs text-gray-500">Registrada em {dateFormatter.format(new Date(row.created_at))}</p>''',
    '''                        <p className="mt-1 text-xs text-gray-500">Registrada em {dateFormatter.format(new Date(row.created_at))}</p>\n                        {row.commission_units && row.commission_unit_amount ? (\n                          <p className="mt-1 text-xs font-semibold text-gray-600">\n                            {row.commission_units} peças × {money(row.commission_unit_amount)} por peça\n                          </p>\n                        ) : null}''',
)
replace_exact(
    account_path,
    "Histórico de solicitações e pagamentos do seu saldo de afiliado.",
    "Histórico de solicitações e pagamentos do seu saldo de afiliado. O saldo disponível permanece acumulado até você solicitar o saque.",
)

settings_path = "src/components/admin/AffiliateCommissionSettings.tsx"
replace_regex(
    settings_path,
    r'''<label className="text-sm font-bold text-gray-800">Liberação \(dias\)<input type="number" min="0" max="365" step="1" value=\{holdDays\} onChange=\{\(event\) => setHoldDays\(event\.target\.value\)\} placeholder="A definir" className="mt-1\.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50" /></label>''',
    '''<label className="text-sm font-bold text-gray-800">Liberação da comissão<input value={holdDays === "0" ? "Imediata" : `${holdDays || 0} dias`} readOnly className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm font-bold text-gray-700 outline-none" /></label>''',
)
replace_regex(
    settings_path,
    r'''<label className="text-sm font-bold text-gray-800">Forma de pagamento<input value=\{withdrawalMethod\} onChange=\{\(event\) => setWithdrawalMethod\(event\.target\.value\)\} maxLength=\{60\} placeholder="A definir" className="mt-1\.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50" /></label>''',
    '''<label className="text-sm font-bold text-gray-800">Forma de pagamento<input value={withdrawalMethod || "PIX"} readOnly className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm font-bold text-gray-700 outline-none" /></label>''',
)

admin_path = "src/components/admin/AffiliateAdmin.tsx"
admin = read(admin_path)
if "function commissionStatusLabel" not in admin:
    needle = '''function money(value: number | null | undefined) {\n  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);\n}\n'''
    insert = needle + r'''
function commissionStatusLabel(value: string | null | undefined) {
  if (value === "available") return "Disponível";
  if (value === "pending") return "Pendente";
  if (value === "cancelled") return "Cancelada";
  return value || "—";
}

function paymentStatusLabel(value: string | null | undefined) {
  if (value === "paid") return "Pago";
  if (value === "pending") return "Pendente";
  if (value === "failed") return "Falhou";
  if (value === "refunded") return "Reembolsado";
  return value || "—";
}

function withdrawalStatusLabel(value: string | null | undefined) {
  if (value === "requested") return "Solicitado";
  if (value === "paid") return "Pago";
  if (value === "rejected") return "Não aprovado";
  return value || "—";
}

function pixDestinationLabel(snapshot: Record<string, unknown>) {
  const method = typeof snapshot.method === "string" ? snapshot.method.trim() : "";
  const key = typeof snapshot.pixKey === "string" ? snapshot.pixKey.trim() : "";
  const keyType =
    typeof snapshot.pixKeyType === "string" ? snapshot.pixKeyType.trim().toLowerCase() : "";
  const labels: Record<string, string> = {
    cpf: "CPF",
    cnpj: "CNPJ",
    email: "E-mail",
    phone: "Telefone",
    random: "Chave aleatória",
  };
  if (method.toUpperCase() === "PIX" && key) {
    return `PIX • ${labels[keyType] ?? "Chave"}: ${key}`;
  }
  return method || "Destino não informado";
}
'''
    if needle not in admin:
        raise RuntimeError("money helper not found in AffiliateAdmin")
    admin = admin.replace(needle, insert, 1)
admin = admin.replace("{row.payment_status}", "{paymentStatusLabel(row.payment_status)}")
admin = admin.replace("{row.commission_status}", "{commissionStatusLabel(row.commission_status)}")
admin = admin.replace("{row.status}</td>", "{commissionStatusLabel(row.status)}</td>")
admin = admin.replace(
    "Snapshots financeiros dos pedidos elegíveis. Uma comissão por pedido.",
    "Histórico das comissões dos pedidos elegíveis. Uma comissão por pedido.",
)
admin = admin.replace(
    "Solicitado em {dateFormatter.format(new Date(row.requested_at))} • {row.status}",
    "Solicitado em {dateFormatter.format(new Date(row.requested_at))} • {withdrawalStatusLabel(row.status)}",
)
admin = admin.replace("{row.status}</span>", "{withdrawalStatusLabel(row.status)}</span>")
withdrawal_line = '''                  <p className="mt-1 text-xs text-gray-500">Solicitado em {dateFormatter.format(new Date(row.requested_at))} • {withdrawalStatusLabel(row.status)}</p>'''
if withdrawal_line not in admin:
    raise RuntimeError("withdrawal status line not found in AffiliateAdmin")
admin = admin.replace(
    withdrawal_line,
    withdrawal_line + '''\n                  <p className="mt-1 break-all text-xs font-semibold text-gray-700">{pixDestinationLabel(row.destination_snapshot)}</p>''',
    1,
)
write(admin_path, admin)

deploy_path = "scripts/deploy-affiliate-backend.mjs"
replace_exact(
    deploy_path,
    '''if (!appliedNames.has("affiliate_fixed_commission_tiers")) {\n  await applyMigration(\n    "affiliate_fixed_commission_tiers",\n    "supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql",\n  );\n  appliedNames.add("affiliate_fixed_commission_tiers");\n}\n\nconst verification = await readOnly(`''',
    '''if (!appliedNames.has("affiliate_fixed_commission_tiers")) {\n  await applyMigration(\n    "affiliate_fixed_commission_tiers",\n    "supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql",\n  );\n  appliedNames.add("affiliate_fixed_commission_tiers");\n}\n\nif (!appliedNames.has("affiliate_pix_withdrawal_and_defaults")) {\n  await applyMigration(\n    "affiliate_pix_withdrawal_and_defaults",\n    "supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql",\n  );\n  appliedNames.add("affiliate_pix_withdrawal_and_defaults");\n}\n\nconst verification = await readOnly(`''',
)
replace_exact(
    deploy_path,
    '''  (select count(*) = 6 from public.affiliate_commission_tiers) as fixed_tier_count_safe,\n  not exists (''',
    '''  (select count(*) = 6 from public.affiliate_commission_tiers) as fixed_tier_count_safe,\n  exists (\n    select 1 from public.affiliate_program_settings s\n    where s.singleton = true\n      and s.hold_days = 0\n      and s.minimum_withdrawal = 60.00\n      and upper(btrim(s.withdrawal_method)) = 'PIX'\n  ) as confirmed_business_defaults,\n  not exists (''',
)
replace_exact(
    deploy_path,
    '''  "fixed_tier_count_safe",\n  "withdrawal_method_column",''',
    '''  "fixed_tier_count_safe",\n  "confirmed_business_defaults",\n  "withdrawal_method_column",''',
)

validate_path = "scripts/validate-affiliate-backend.mjs"
validate = read(validate_path)
validate = validate.replace(
    '''const fixed = read(\n  "supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql",\n);\nconst commissionEditor = read("src/components/admin/AffiliateCommissionSettings.tsx");''',
    '''const fixed = read(\n  "supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql",\n);\nconst finalRules = read(\n  "supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql",\n);\nconst commissionEditor = read("src/components/admin/AffiliateCommissionSettings.tsx");\nconst withdrawalForm = read("src/components/account/AffiliateWithdrawalForm.tsx");''',
    1,
)
old_check = '''check(\n  "saque usa forma configuravel sem inventar PIX ou banco",\n  readiness.includes("withdrawal_method text") &&\n    readiness.includes("destination_method") &&\n    !readiness.includes("pix_key") &&\n    !readiness.includes("bank_account"),\n);'''
new_check = '''check(\n  "saque confirmado usa PIX com chave registrada no destino",\n  finalRules.includes("minimum_withdrawal = 60.00") &&\n    finalRules.includes("withdrawal_method = 'PIX'") &&\n    finalRules.includes("pixKeyType") &&\n    finalRules.includes("pixKey") &&\n    finalRules.includes("A forma de pagamento disponivel e PIX"),\n);\n\ncheck(\n  "comissao confirmada fica disponivel imediatamente e nao expira",\n  finalRules.includes("hold_days = 0") &&\n    finalRules.includes("initial_status := CASE WHEN settings_row.hold_days = 0 THEN 'available'") &&\n    !finalRules.includes("expires_at"),\n);\n\ncheck(\n  "afiliado consegue solicitar saque pelo proprio painel",\n  withdrawalForm.includes("Solicitar saque por PIX") &&\n    withdrawalForm.includes("Saque mínimo") &&\n    withdrawalForm.includes("requestMyAffiliateWithdrawal") &&\n    accountPanel.includes("<AffiliateWithdrawalForm dashboard={dashboard} />"),\n);'''
if old_check not in validate:
    raise RuntimeError("old withdrawal validation not found")
validate = validate.replace(old_check, new_check, 1)
marker = '''check(\n  "painel administrativo mostra todas as faixas fixas ao mesmo tempo",'''
extra = '''check(\n  "resumo administrativo usa as regras fixas, nao o percentual antigo",\n  finalRules.includes("tier_count = 6") &&\n    !/owner_get_affiliate_overview[\\s\\S]*commission_rate_bps IS NOT NULL/.test(finalRules),\n);\n\n'''
if marker not in validate:
    raise RuntimeError("admin tier validation marker not found")
validate = validate.replace(marker, extra + marker, 1)
write(validate_path, validate)

# Atualiza o documento de referencia para nao continuar dizendo que o prazo e indefinido.
docs_path = "docs/affiliate-email-templates.md"
docs = read(docs_path)
docs = docs.replace(
    "A comissão pode permanecer pendente até cumprir o prazo definido pelo programa. Acompanhe o status em `{{AFFILIATE_DASHBOARD_URL}}`.",
    "Pela regra atual, a comissão fica disponível assim que o pagamento do pedido é confirmado e permanece no saldo até o saque. Acompanhe em `{{AFFILIATE_DASHBOARD_URL}}`.",
)
docs = docs.replace(
    "- Não prometer percentual, prazo, saque mínimo ou forma de pagamento enquanto as cinco regras comerciais não estiverem configuradas.",
    "- A regra vigente usa valor fixo por peça, liberação imediata, saque mínimo de R$ 60 e pagamento por PIX. Não apresentar percentual como regra atual.",
)
write(docs_path, docs)

print("Affiliate finalization v2 prepared successfully.")
