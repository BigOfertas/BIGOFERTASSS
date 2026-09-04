BEGIN;

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

COMMIT;