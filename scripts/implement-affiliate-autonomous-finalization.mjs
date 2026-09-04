import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => fs.writeFileSync(file, content);

function replaceExact(file, before, after) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`Expected block not found in ${file}`);
  write(file, source.replace(before, after));
}

function replaceRegex(file, regex, after) {
  const source = read(file);
  if (!regex.test(source)) throw new Error(`Expected pattern not found in ${file}: ${regex}`);
  write(file, source.replace(regex, after));
}

const migration = String.raw`BEGIN;

-- Regras comerciais confirmadas para o programa de afiliados:
-- comissao fixa por peca, liberacao imediata, saque minimo de R$ 60 e PIX.
-- O saldo disponivel nao expira: permanece contabilizado ate ser sacado.

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

-- Com prazo zero, a comissao deve ficar disponivel imediatamente depois da
-- confirmacao do pagamento, sem depender de o afiliado abrir o painel.
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
    available_at
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
    COALESCE(order_row.paid_at, now()) + make_interval(days => settings_row.hold_days)
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
      'commission_rule_source', commission_row.commission_rule_source
    ),
    'affiliate.commission.created:' || commission_row.id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  IF settings_row.hold_days = 0 THEN
    PERFORM public.release_due_affiliate_commissions(affiliate_row.id);
  END IF;

  RETURN commission_row.id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_my_affiliate_withdrawal(numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_my_affiliate_withdrawal(numeric, jsonb) TO authenticated;

COMMIT;`;

write("supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql", migration);

const withdrawalForm = `import { useMutation, useQueryClient } from \"@tanstack/react-query\";\nimport { Loader2, WalletCards } from \"lucide-react\";\nimport { useMemo, useState } from \"react\";\n\nimport { requestMyAffiliateWithdrawal, type AffiliateDashboard, type PixKeyType } from \"@/lib/affiliates\";\nimport { getUserFacingError } from \"@/lib/user-facing-error\";\n\nconst currencyFormatter = new Intl.NumberFormat(\"pt-BR\", { style: \"currency\", currency: \"BRL\" });\n\nconst PIX_TYPES: Array<{ value: PixKeyType; label: string }> = [\n  { value: \"cpf\", label: \"CPF\" },\n  { value: \"cnpj\", label: \"CNPJ\" },\n  { value: \"email\", label: \"E-mail\" },\n  { value: \"phone\", label: \"Telefone\" },\n  { value: \"random\", label: \"Chave aleatória\" },\n];\n\nfunction money(value: number) {\n  return currencyFormatter.format(Number.isFinite(value) ? value : 0);\n}\n\nexport function AffiliateWithdrawalForm({ dashboard }: { dashboard: AffiliateDashboard }) {\n  const queryClient = useQueryClient();\n  const [amount, setAmount] = useState(\"\");\n  const [pixKeyType, setPixKeyType] = useState<PixKeyType>(\"cpf\");\n  const [pixKey, setPixKey] = useState(\"\");\n  const [message, setMessage] = useState(\"\");\n  const [errorMessage, setErrorMessage] = useState(\"\");\n\n  const minimum = dashboard.minimumWithdrawal ?? 60;\n  const parsedAmount = Number(amount.replace(\",\", \".\"));\n  const validAmount = Number.isFinite(parsedAmount) && parsedAmount >= minimum && parsedAmount <= dashboard.availableAmount;\n  const validPixKey = pixKey.trim().length >= 3 && pixKey.trim().length <= 140;\n  const canRequest = dashboard.programEnabled\n    && dashboard.status === \"active\"\n    && dashboard.rulesComplete\n    && dashboard.withdrawalMethod?.toUpperCase() === \"PIX\"\n    && dashboard.availableAmount >= minimum;\n\n  const helperText = useMemo(() => {\n    if (!dashboard.programEnabled) return \"Os saques ficam disponíveis quando o programa estiver ativo.\";\n    if (dashboard.status !== \"active\") return \"Sua participação precisa estar ativa para solicitar saque.\";\n    if (!dashboard.rulesComplete) return \"As regras de saque ainda não estão completas.\";\n    if (dashboard.availableAmount < minimum) return `Você poderá sacar quando o saldo disponível chegar a ${money(minimum)}.`;\n    return `Saque mínimo: ${money(minimum)}. Seu saldo disponível não expira e permanece aqui até você solicitar o pagamento.`;\n  }, [dashboard.availableAmount, dashboard.programEnabled, dashboard.rulesComplete, dashboard.status, minimum]);\n\n  const mutation = useMutation({\n    mutationFn: () => requestMyAffiliateWithdrawal(parsedAmount, pixKeyType, pixKey.trim()),\n    onSuccess: async () => {\n      setMessage(\"Solicitação de saque enviada. O pagamento será feito por PIX após a conferência.\");\n      setErrorMessage(\"\");\n      setAmount(\"\");\n      setPixKey(\"\");\n      await Promise.all([\n        queryClient.invalidateQueries({ queryKey: [\"my-affiliate-dashboard\"] }),\n        queryClient.invalidateQueries({ queryKey: [\"my-affiliate-withdrawals\"] }),\n      ]);\n    },\n    onError: (error) => {\n      setMessage(\"\");\n      setErrorMessage(getUserFacingError(error, \"Não foi possível solicitar o saque agora.\"));\n    },\n  });\n\n  return (\n    <section className=\"rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6\">\n      <div className=\"flex items-start gap-3\">\n        <span className=\"flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-700\">\n          <WalletCards className=\"h-5 w-5\" aria-hidden=\"true\" />\n        </span>\n        <div>\n          <h3 className=\"font-black text-gray-950\">Solicitar saque por PIX</h3>\n          <p className=\"mt-1 text-xs leading-5 text-gray-500\">{helperText}</p>\n        </div>\n      </div>\n\n      {message ? <p className=\"mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800\">{message}</p> : null}\n      {errorMessage ? <p role=\"alert\" className=\"mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700\">{errorMessage}</p> : null}\n\n      <div className=\"mt-5 grid gap-4 md:grid-cols-[0.7fr_0.8fr_1.5fr_auto] md:items-end\">\n        <label className=\"text-sm font-bold text-gray-800\">\n          Valor do saque\n          <div className=\"mt-1.5 flex h-11 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-50\">\n            <span className=\"text-sm font-black text-gray-500\">R$</span>\n            <input type=\"number\" min={minimum} max={dashboard.availableAmount} step=\"0.01\" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!canRequest || mutation.isPending} className=\"min-w-0 flex-1 border-0 bg-transparent pl-2 text-sm font-bold outline-none disabled:text-gray-400\" placeholder={String(minimum).replace(\".\", \",\")} />\n          </div>\n        </label>\n\n        <label className=\"text-sm font-bold text-gray-800\">\n          Tipo de chave PIX\n          <select value={pixKeyType} onChange={(event) => setPixKeyType(event.target.value as PixKeyType)} disabled={!canRequest || mutation.isPending} className=\"mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 disabled:bg-gray-100\">\n            {PIX_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}\n          </select>\n        </label>\n\n        <label className=\"text-sm font-bold text-gray-800\">\n          Chave PIX\n          <input value={pixKey} onChange={(event) => setPixKey(event.target.value)} maxLength={140} disabled={!canRequest || mutation.isPending} placeholder=\"Digite a chave que receberá o pagamento\" className=\"mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 disabled:bg-gray-100\" />\n        </label>\n\n        <button type=\"button\" disabled={!canRequest || !validAmount || !validPixKey || mutation.isPending} onClick={() => mutation.mutate()} className=\"inline-flex h-11 items-center justify-center rounded-lg bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300\">\n          {mutation.isPending ? <Loader2 className=\"mr-2 h-4 w-4 animate-spin\" aria-hidden=\"true\" /> : null}\n          Solicitar saque\n        </button>\n      </div>\n\n      <div className=\"mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500\">\n        <span>Saldo disponível: <strong className=\"text-gray-800\">{money(dashboard.availableAmount)}</strong></span>\n        <span>Pagamento: <strong className=\"text-gray-800\">PIX</strong></span>\n      </div>\n    </section>\n  );\n}\n`;
write("src/components/account/AffiliateWithdrawalForm.tsx", withdrawalForm);

const affiliatesLib = "src/lib/affiliates.ts";
let affiliatesSource = read(affiliatesLib);
if (!affiliatesSource.includes("export type PixKeyType")) {
  affiliatesSource += `\n\nexport type PixKeyType = \"cpf\" | \"cnpj\" | \"email\" | \"phone\" | \"random\";\n\nexport function requestMyAffiliateWithdrawal(amount: number, pixKeyType: PixKeyType, pixKey: string) {\n  return callSupabaseRpc<AffiliateWithdrawalRow>(\"request_my_affiliate_withdrawal\", {\n    p_amount: amount,\n    p_destination_snapshot: { method: \"PIX\", pixKeyType, pixKey: pixKey.trim() },\n  });\n}\n`;
  write(affiliatesLib, affiliatesSource);
}

const accountPanel = "src/components/account/AffiliateAccountPanel.tsx";
replaceExact(
  accountPanel,
  `import { BRAND } from \"@/config/brand\";`,
  `import { AffiliateWithdrawalForm } from \"@/components/account/AffiliateWithdrawalForm\";\nimport { BRAND } from \"@/config/brand\";`,
);
replaceExact(
  accountPanel,
  `      {!dashboard.rulesComplete ? (\n        <section className=\"rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6\">`,
  `      <AffiliateWithdrawalForm dashboard={dashboard} />\n\n      {!dashboard.rulesComplete ? (\n        <section className=\"rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6\">`,
);
replaceExact(
  accountPanel,
  `<p className=\"mt-1 text-xs text-gray-500\">Registrada em {dateFormatter.format(new Date(row.created_at))}</p>`,
  `<p className=\"mt-1 text-xs text-gray-500\">Registrada em {dateFormatter.format(new Date(row.created_at))}</p>\n                        {row.commission_units && row.commission_unit_amount ? (\n                          <p className=\"mt-1 text-xs font-semibold text-gray-600\">{row.commission_units} peças × {money(row.commission_unit_amount)} por peça</p>\n                        ) : null}`,
);
replaceExact(
  accountPanel,
  `Histórico de solicitações e pagamentos do seu saldo de afiliado.`,
  `Histórico de solicitações e pagamentos do seu saldo de afiliado. O saldo disponível permanece acumulado até você solicitar o saque.`,
);

const commissionSettings = "src/components/admin/AffiliateCommissionSettings.tsx";
replaceRegex(
  commissionSettings,
  /<label className="text-sm font-bold text-gray-800">Forma de pagamento<input value=\{withdrawalMethod\} onChange=\{\(event\) => setWithdrawalMethod\(event\.target\.value\)\} maxLength=\{60\} placeholder="A definir" className="mt-1\.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50" \/><\/label>/,
  `<label className=\"text-sm font-bold text-gray-800\">Forma de pagamento<input value={withdrawalMethod || \"PIX\"} readOnly className=\"mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm font-bold text-gray-700 outline-none\" /></label>`,
);

const adminPanel = "src/components/admin/AffiliateAdmin.tsx";
let adminSource = read(adminPanel);
adminSource = adminSource
  .replace("  BadgePercent,\n", "")
  .replace("  Save,\n", "")
  .replace("  ShieldCheck,\n", "")
  .replace('import { useEffect, useMemo, useState } from "react";', 'import { useState } from "react";')
  .replace("  configureAffiliateProgram,\n", "")
  .replace("  saveAffiliateProgramDraft,\n", "")
  .replace("  type AffiliateProgramDraft,\n", "");
adminSource = adminSource.replace(/\nfunction formatPercent\([\s\S]*?\n}\n\nfunction formatBase\([\s\S]*?\n}\n/, "\n");
adminSource = adminSource.replace(/\n  const \[commissionPercent[\s\S]*?const \[rulesInitialized, setRulesInitialized\] = useState\(false\);/, "");
adminSource = adminSource.replace(/\n  useEffect\(\(\) => \{[\s\S]*?\n  const actionMutation = useMutation\(\{/, "\n\n  const actionMutation = useMutation({");
adminSource = adminSource.replace(/\n  function completedDraft\(\) \{[\s\S]*?\n  }\n\n  const overview = overviewQuery\.data;/, "\n\n  const overview = overviewQuery.data;");
adminSource = adminSource.replace(
  `function money(value: number | null | undefined) {\n  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);\n}\n`,
  `function money(value: number | null | undefined) {\n  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);\n}\n\nfunction commissionStatusLabel(value: string | null | undefined) {\n  if (value === \"available\") return \"Disponível\";\n  if (value === \"pending\") return \"Pendente\";\n  if (value === \"cancelled\") return \"Cancelada\";\n  return value || \"—\";\n}\n\nfunction paymentStatusLabel(value: string | null | undefined) {\n  if (value === \"paid\") return \"Pago\";\n  if (value === \"pending\") return \"Pendente\";\n  if (value === \"failed\") return \"Falhou\";\n  if (value === \"refunded\") return \"Reembolsado\";\n  return value || \"—\";\n}\n\nfunction withdrawalStatusLabel(value: string | null | undefined) {\n  if (value === \"requested\") return \"Solicitado\";\n  if (value === \"paid\") return \"Pago\";\n  if (value === \"rejected\") return \"Não aprovado\";\n  return value || \"—\";\n}\n\nfunction pixDestinationLabel(snapshot: Record<string, unknown>) {\n  const method = typeof snapshot.method === \"string\" ? snapshot.method.trim() : \"\";\n  const key = typeof snapshot.pixKey === \"string\" ? snapshot.pixKey.trim() : \"\";\n  const keyType = typeof snapshot.pixKeyType === \"string\" ? snapshot.pixKeyType.trim().toLowerCase() : \"\";\n  const typeLabels: Record<string, string> = { cpf: \"CPF\", cnpj: \"CNPJ\", email: \"E-mail\", phone: \"Telefone\", random: \"Chave aleatória\" };\n  if (method.toUpperCase() === \"PIX\" && key) return \`PIX • \${typeLabels[keyType] ?? \"Chave\"}: \${key}\`;\n  return method || \"Destino não informado\";\n}\n`,
);
adminSource = adminSource
  .replace("{row.payment_status}", "{paymentStatusLabel(row.payment_status)}")
  .replace("{row.commission_status}", "{commissionStatusLabel(row.commission_status)}")
  .replace("{row.status}</td>", "{commissionStatusLabel(row.status)}</td>")
  .replace("Snapshots financeiros dos pedidos elegíveis. Uma comissão por pedido.", "Histórico das comissões dos pedidos elegíveis. Uma comissão por pedido.")
  .replace("Solicitado em {dateFormatter.format(new Date(row.requested_at))} • {row.status}", "Solicitado em {dateFormatter.format(new Date(row.requested_at))} • {withdrawalStatusLabel(row.status)}")
  .replace("{row.status}</span>", "{withdrawalStatusLabel(row.status)}</span>");
adminSource = adminSource.replace(
  `<p className=\"mt-1 text-xs text-gray-500\">Solicitado em {dateFormatter.format(new Date(row.requested_at))} • {withdrawalStatusLabel(row.status)}</p>`,
  `<p className=\"mt-1 text-xs text-gray-500\">Solicitado em {dateFormatter.format(new Date(row.requested_at))} • {withdrawalStatusLabel(row.status)}</p>\n                  <p className=\"mt-1 break-all text-xs font-semibold text-gray-700\">{pixDestinationLabel(row.destination_snapshot)}</p>`,
);
write(adminPanel, adminSource);

const deployFile = "scripts/deploy-affiliate-backend.mjs";
replaceExact(
  deployFile,
  `if (!appliedNames.has(\"affiliate_fixed_commission_tiers\")) {\n  await applyMigration(\n    \"affiliate_fixed_commission_tiers\",\n    \"supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql\",\n  );\n  appliedNames.add(\"affiliate_fixed_commission_tiers\");\n}\n\nconst verification = await readOnly(`,
  `if (!appliedNames.has(\"affiliate_fixed_commission_tiers\")) {\n  await applyMigration(\n    \"affiliate_fixed_commission_tiers\",\n    \"supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql\",\n  );\n  appliedNames.add(\"affiliate_fixed_commission_tiers\");\n}\n\nif (!appliedNames.has(\"affiliate_pix_withdrawal_and_defaults\")) {\n  await applyMigration(\n    \"affiliate_pix_withdrawal_and_defaults\",\n    \"supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql\",\n  );\n  appliedNames.add(\"affiliate_pix_withdrawal_and_defaults\");\n}\n\nconst verification = await readOnly(`,
);
replaceExact(
  deployFile,
  `  (select count(*) = 6 from public.affiliate_commission_tiers) as fixed_tier_count_safe,\n  not exists (`,
  `  (select count(*) = 6 from public.affiliate_commission_tiers) as fixed_tier_count_safe,\n  exists (\n    select 1 from public.affiliate_program_settings s\n    where s.singleton = true\n      and s.hold_days = 0\n      and s.minimum_withdrawal = 60.00\n      and upper(btrim(s.withdrawal_method)) = 'PIX'\n  ) as confirmed_business_defaults,\n  not exists (`,
);
replaceExact(
  deployFile,
  `  \"fixed_tier_count_safe\",\n  \"withdrawal_method_column\",`,
  `  \"fixed_tier_count_safe\",\n  \"confirmed_business_defaults\",\n  \"withdrawal_method_column\",`,
);

const validateFile = "scripts/validate-affiliate-backend.mjs";
let validateSource = read(validateFile);
validateSource = validateSource.replace(
  `const fixed = read(\n  \"supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql\",\n);\nconst commissionEditor = read(\"src/components/admin/AffiliateCommissionSettings.tsx\");`,
  `const fixed = read(\n  \"supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql\",\n);\nconst finalRules = read(\n  \"supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql\",\n);\nconst commissionEditor = read(\"src/components/admin/AffiliateCommissionSettings.tsx\");\nconst withdrawalForm = read(\"src/components/account/AffiliateWithdrawalForm.tsx\");`,
);
validateSource = validateSource.replace(
  `check(\n  \"saque usa forma configuravel sem inventar PIX ou banco\",\n  readiness.includes(\"withdrawal_method text\") &&\n    readiness.includes(\"destination_method\") &&\n    !readiness.includes(\"pix_key\") &&\n    !readiness.includes(\"bank_account\"),\n);`,
  `check(\n  \"saque confirmado usa PIX com chave registrada no snapshot\",\n  finalRules.includes(\"minimum_withdrawal = 60.00\") &&\n    finalRules.includes(\"withdrawal_method = 'PIX'\") &&\n    finalRules.includes(\"pixKeyType\") &&\n    finalRules.includes(\"pixKey\") &&\n    finalRules.includes(\"A forma de pagamento disponivel e PIX\"),\n);\n\ncheck(\n  \"comissao confirmada fica disponivel imediatamente e nao expira\",\n  finalRules.includes(\"hold_days = 0\") &&\n    finalRules.includes(\"PERFORM public.release_due_affiliate_commissions(affiliate_row.id)\") &&\n    !finalRules.includes(\"expires_at\"),\n);\n\ncheck(\n  \"afiliado consegue solicitar saque pelo proprio painel\",\n  withdrawalForm.includes(\"Solicitar saque por PIX\") &&\n    withdrawalForm.includes(\"Saque mínimo\") &&\n    withdrawalForm.includes(\"requestMyAffiliateWithdrawal\") &&\n    accountPanel.includes(\"<AffiliateWithdrawalForm dashboard={dashboard} />\"),\n);`,
);
validateSource = validateSource.replace(
  `check(\n  \"painel administrativo mostra todas as faixas fixas ao mesmo tempo\",`,
  `check(\n  \"resumo administrativo considera as faixas fixas e nao o percentual antigo\",\n  finalRules.includes(\"tier_count = 6\") &&\n    !/owner_get_affiliate_overview[\\s\\S]*commission_rate_bps IS NOT NULL/.test(finalRules),\n);\n\ncheck(\n  \"painel administrativo mostra todas as faixas fixas ao mesmo tempo\",`,
);
write(validateFile, validateSource);

console.log("Affiliate autonomous finalization prepared.");
