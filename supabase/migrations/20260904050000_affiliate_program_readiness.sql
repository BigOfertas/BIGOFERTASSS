BEGIN;

-- Completa o backend de afiliados sem inventar as regras comerciais pendentes.
-- O programa continua desligado ate que o owner informe e confirme as cinco
-- regras: percentual, base, prazo, saque minimo e forma de pagamento.

ALTER TABLE public.affiliate_program_settings
  ADD COLUMN IF NOT EXISTS withdrawal_method text;

ALTER TABLE public.affiliate_program_settings
  DROP CONSTRAINT IF EXISTS affiliate_program_enabled_requires_rules;

ALTER TABLE public.affiliate_program_settings
  DROP CONSTRAINT IF EXISTS affiliate_program_withdrawal_method_valid;

ALTER TABLE public.affiliate_program_settings
  ADD CONSTRAINT affiliate_program_withdrawal_method_valid CHECK (
    withdrawal_method IS NULL
    OR length(btrim(withdrawal_method)) BETWEEN 2 AND 60
  );

ALTER TABLE public.affiliate_program_settings
  ADD CONSTRAINT affiliate_program_enabled_requires_rules CHECK (
    NOT enabled OR (
      commission_rate_bps IS NOT NULL
      AND commission_base_mode IS NOT NULL
      AND hold_days IS NOT NULL
      AND minimum_withdrawal IS NOT NULL
      AND withdrawal_method IS NOT NULL
      AND length(btrim(withdrawal_method)) BETWEEN 2 AND 60
    )
  );

CREATE TABLE IF NOT EXISTS public.affiliate_refund_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL UNIQUE REFERENCES public.affiliate_commissions(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text,
  CONSTRAINT affiliate_refund_reviews_status_valid CHECK (status IN ('pending', 'resolved')),
  CONSTRAINT affiliate_refund_reviews_state_consistent CHECK (
    (status = 'pending' AND resolved_at IS NULL AND resolved_by IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
  ),
  CONSTRAINT affiliate_refund_reviews_note_valid CHECK (
    resolution_note IS NULL OR length(resolution_note) BETWEEN 3 AND 1000
  )
);

CREATE INDEX IF NOT EXISTS affiliate_refund_reviews_status_created_idx
  ON public.affiliate_refund_reviews (status, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.owner_save_affiliate_program_draft(
  p_commission_rate_bps integer DEFAULT NULL,
  p_commission_base_mode text DEFAULT NULL,
  p_hold_days integer DEFAULT NULL,
  p_minimum_withdrawal numeric DEFAULT NULL,
  p_withdrawal_method text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_method text := NULLIF(btrim(COALESCE(p_withdrawal_method, '')), '');
  settings_row public.affiliate_program_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_commission_rate_bps IS NOT NULL AND p_commission_rate_bps NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Percentual de comissao invalido';
  END IF;
  IF p_commission_base_mode IS NOT NULL
     AND p_commission_base_mode NOT IN ('items_after_discount', 'order_total') THEN
    RAISE EXCEPTION 'Base de comissao invalida';
  END IF;
  IF p_hold_days IS NOT NULL AND p_hold_days NOT BETWEEN 0 AND 365 THEN
    RAISE EXCEPTION 'Prazo de liberacao invalido';
  END IF;
  IF p_minimum_withdrawal IS NOT NULL
     AND (p_minimum_withdrawal < 0.01 OR p_minimum_withdrawal > 1000000) THEN
    RAISE EXCEPTION 'Saque minimo invalido';
  END IF;
  IF normalized_method IS NOT NULL AND length(normalized_method) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Forma de pagamento invalida';
  END IF;

  UPDATE public.affiliate_program_settings
  SET
    enabled = false,
    commission_rate_bps = p_commission_rate_bps,
    commission_base_mode = p_commission_base_mode,
    hold_days = p_hold_days,
    minimum_withdrawal = p_minimum_withdrawal,
    withdrawal_method = normalized_method,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE singleton = true
  RETURNING * INTO settings_row;

  RETURN jsonb_build_object(
    'enabled', settings_row.enabled,
    'commissionRateBps', settings_row.commission_rate_bps,
    'commissionBaseMode', settings_row.commission_base_mode,
    'holdDays', settings_row.hold_days,
    'minimumWithdrawal', settings_row.minimum_withdrawal,
    'withdrawalMethod', settings_row.withdrawal_method,
    'rulesComplete',
      settings_row.commission_rate_bps IS NOT NULL
      AND settings_row.commission_base_mode IS NOT NULL
      AND settings_row.hold_days IS NOT NULL
      AND settings_row.minimum_withdrawal IS NOT NULL
      AND settings_row.withdrawal_method IS NOT NULL
  );
END;
$$;

DROP FUNCTION IF EXISTS public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric);

CREATE OR REPLACE FUNCTION public.owner_configure_affiliate_program(
  p_enabled boolean,
  p_commission_rate_bps integer,
  p_commission_base_mode text,
  p_hold_days integer,
  p_minimum_withdrawal numeric,
  p_withdrawal_method text
)
RETURNS public.affiliate_program_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result_row public.affiliate_program_settings%ROWTYPE;
  normalized_method text := NULLIF(btrim(COALESCE(p_withdrawal_method, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_commission_rate_bps NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Percentual de comissao invalido';
  END IF;
  IF p_commission_base_mode NOT IN ('items_after_discount', 'order_total') THEN
    RAISE EXCEPTION 'Base de comissao invalida';
  END IF;
  IF p_hold_days NOT BETWEEN 0 AND 365 THEN
    RAISE EXCEPTION 'Prazo de liberacao invalido';
  END IF;
  IF p_minimum_withdrawal IS NULL
     OR p_minimum_withdrawal < 0.01
     OR p_minimum_withdrawal > 1000000 THEN
    RAISE EXCEPTION 'Saque minimo invalido';
  END IF;
  IF normalized_method IS NULL OR length(normalized_method) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Forma de pagamento invalida';
  END IF;

  UPDATE public.affiliate_program_settings
  SET
    enabled = p_enabled,
    commission_rate_bps = p_commission_rate_bps,
    commission_base_mode = p_commission_base_mode,
    hold_days = p_hold_days,
    minimum_withdrawal = p_minimum_withdrawal,
    withdrawal_method = normalized_method,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE singleton = true
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_affiliate_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  affiliate_row public.affiliates%ROWTYPE;
  settings_row public.affiliate_program_settings%ROWTYPE;
  referral_count bigint := 0;
  pending_amount numeric(12,2) := 0;
  available_total numeric(12,2) := 0;
  requested_total numeric(12,2) := 0;
  paid_total numeric(12,2) := 0;
  rules_complete boolean := false;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;

  rules_complete :=
    settings_row.commission_rate_bps IS NOT NULL
    AND settings_row.commission_base_mode IS NOT NULL
    AND settings_row.hold_days IS NOT NULL
    AND settings_row.minimum_withdrawal IS NOT NULL
    AND settings_row.withdrawal_method IS NOT NULL;

  SELECT * INTO affiliate_row
  FROM public.affiliates
  WHERE user_id = current_user_id;

  IF affiliate_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'isAffiliate', false,
      'programEnabled', settings_row.enabled,
      'rulesComplete', rules_complete,
      'withdrawalMethod', settings_row.withdrawal_method
    );
  END IF;

  PERFORM public.release_due_affiliate_commissions(affiliate_row.id);

  SELECT count(*) INTO referral_count
  FROM public.affiliate_referrals WHERE affiliate_id = affiliate_row.id;

  SELECT COALESCE(sum(commission_amount),0) INTO pending_amount
  FROM public.affiliate_commissions
  WHERE affiliate_id = affiliate_row.id AND status = 'pending';

  SELECT COALESCE(sum(commission_amount),0) INTO available_total
  FROM public.affiliate_commissions
  WHERE affiliate_id = affiliate_row.id AND status = 'available';

  SELECT COALESCE(sum(amount),0) INTO requested_total
  FROM public.affiliate_withdrawals
  WHERE affiliate_id = affiliate_row.id AND status = 'requested';

  SELECT COALESCE(sum(amount),0) INTO paid_total
  FROM public.affiliate_withdrawals
  WHERE affiliate_id = affiliate_row.id AND status = 'paid';

  RETURN jsonb_build_object(
    'isAffiliate', true,
    'status', affiliate_row.status,
    'referralCode', affiliate_row.referral_code,
    'programEnabled', settings_row.enabled,
    'rulesComplete', rules_complete,
    'commissionRateBps', settings_row.commission_rate_bps,
    'commissionBaseMode', settings_row.commission_base_mode,
    'holdDays', settings_row.hold_days,
    'minimumWithdrawal', settings_row.minimum_withdrawal,
    'withdrawalMethod', settings_row.withdrawal_method,
    'referralsCount', referral_count,
    'pendingAmount', pending_amount,
    'availableAmount', greatest(available_total - requested_total - paid_total, 0),
    'requestedWithdrawalAmount', requested_total,
    'paidWithdrawalAmount', paid_total
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
    RAISE EXCEPTION 'Destino de saque invalido';
  END IF;

  destination_method := NULLIF(btrim(COALESCE(p_destination_snapshot ->> 'method', '')), '');
  IF destination_method IS NULL
     OR lower(destination_method) <> lower(btrim(settings_row.withdrawal_method)) THEN
    RAISE EXCEPTION 'Forma de pagamento do saque nao corresponde a configuracao do programa';
  END IF;

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
  VALUES (affiliate_row.id, round(p_amount, 2), p_destination_snapshot)
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
      'withdrawal_method', settings_row.withdrawal_method
    ),
    'affiliate.withdrawal.requested:' || withdrawal_row.id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN withdrawal_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pending_affiliate_commission_after_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'refunded'::public.order_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.affiliate_commissions
    SET
      status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = 'Pedido reembolsado antes da liberacao da comissao'
    WHERE order_id = NEW.id AND status = 'pending';

    INSERT INTO public.affiliate_refund_reviews (
      commission_id,
      order_id,
      affiliate_id
    )
    SELECT c.id, c.order_id, c.affiliate_id
    FROM public.affiliate_commissions AS c
    WHERE c.order_id = NEW.id
      AND c.status = 'available'
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

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
  rules_complete boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;

  rules_complete :=
    settings_row.commission_rate_bps IS NOT NULL
    AND settings_row.commission_base_mode IS NOT NULL
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
    'commissionRateBps', settings_row.commission_rate_bps,
    'commissionBaseMode', settings_row.commission_base_mode,
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

CREATE OR REPLACE FUNCTION public.owner_list_affiliate_candidates(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  affiliate_id uuid,
  affiliate_status text,
  referral_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    a.id,
    a.status,
    a.referral_code
  FROM public.profiles AS p
  JOIN public.user_roles AS ur
    ON ur.user_id = p.id AND ur.role = 'customer'::public.app_role
  LEFT JOIN public.affiliates AS a ON a.user_id = p.id
  WHERE normalized_search IS NULL
     OR COALESCE(p.full_name, '') ILIKE '%' || normalized_search || '%'
     OR COALESCE(p.email, '') ILIKE '%' || normalized_search || '%'
     OR COALESCE(a.referral_code, '') ILIKE '%' || normalized_search || '%'
  ORDER BY COALESCE(p.full_name, p.email, p.id::text), p.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_list_affiliate_referrals(
  p_affiliate_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  affiliate_id uuid,
  affiliate_user_id uuid,
  affiliate_name text,
  referred_user_id uuid,
  referred_name text,
  referred_email text,
  referred_at timestamptz,
  orders_count bigint,
  paid_orders_count bigint,
  paid_sales_amount numeric,
  generated_commission_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.user_id,
    ap.full_name,
    r.referred_user_id,
    rp.full_name,
    rp.email,
    r.referred_at,
    count(DISTINCT o.id),
    count(DISTINCT o.id) FILTER (WHERE o.payment_status = 'paid'::public.order_payment_status),
    COALESCE(sum(DISTINCT o.total_amount) FILTER (WHERE o.payment_status = 'paid'::public.order_payment_status), 0),
    COALESCE(sum(DISTINCT c.commission_amount) FILTER (WHERE c.status <> 'cancelled'), 0)
  FROM public.affiliate_referrals AS r
  JOIN public.affiliates AS a ON a.id = r.affiliate_id
  LEFT JOIN public.profiles AS ap ON ap.id = a.user_id
  LEFT JOIN public.profiles AS rp ON rp.id = r.referred_user_id
  LEFT JOIN public.orders AS o ON o.user_id = r.referred_user_id
  LEFT JOIN public.affiliate_commissions AS c
    ON c.referred_user_id = r.referred_user_id AND c.affiliate_id = r.affiliate_id
  WHERE p_affiliate_id IS NULL OR r.affiliate_id = p_affiliate_id
  GROUP BY a.id, a.user_id, ap.full_name, r.referred_user_id, rp.full_name, rp.email, r.referred_at
  ORDER BY r.referred_at DESC, r.referred_user_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_list_affiliate_referred_orders(
  p_affiliate_id uuid DEFAULT NULL,
  p_referred_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  affiliate_id uuid,
  referred_user_id uuid,
  referred_name text,
  order_id uuid,
  public_number text,
  order_status text,
  payment_status text,
  total_amount numeric,
  created_at timestamptz,
  paid_at timestamptz,
  commission_id uuid,
  commission_status text,
  commission_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  RETURN QUERY
  SELECT
    r.affiliate_id,
    r.referred_user_id,
    p.full_name,
    o.id,
    o.public_number,
    o.status::text,
    o.payment_status::text,
    o.total_amount,
    o.created_at,
    o.paid_at,
    c.id,
    c.status,
    c.commission_amount
  FROM public.affiliate_referrals AS r
  JOIN public.orders AS o ON o.user_id = r.referred_user_id
  LEFT JOIN public.profiles AS p ON p.id = r.referred_user_id
  LEFT JOIN public.affiliate_commissions AS c ON c.order_id = o.id
  WHERE (p_affiliate_id IS NULL OR r.affiliate_id = p_affiliate_id)
    AND (p_referred_user_id IS NULL OR r.referred_user_id = p_referred_user_id)
  ORDER BY o.created_at DESC, o.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_list_affiliate_refund_reviews(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  review_id uuid,
  commission_id uuid,
  order_id uuid,
  order_public_number text,
  affiliate_id uuid,
  affiliate_user_id uuid,
  affiliate_name text,
  commission_amount numeric,
  review_status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolution_note text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_status text := NULLIF(btrim(COALESCE(p_status, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF normalized_status IS NOT NULL AND normalized_status NOT IN ('pending', 'resolved') THEN
    RAISE EXCEPTION 'Status de revisao invalido';
  END IF;

  RETURN QUERY
  SELECT
    rr.id,
    rr.commission_id,
    rr.order_id,
    c.order_public_number,
    rr.affiliate_id,
    a.user_id,
    p.full_name,
    c.commission_amount,
    rr.status,
    rr.created_at,
    rr.resolved_at,
    rr.resolution_note
  FROM public.affiliate_refund_reviews AS rr
  JOIN public.affiliate_commissions AS c ON c.id = rr.commission_id
  JOIN public.affiliates AS a ON a.id = rr.affiliate_id
  LEFT JOIN public.profiles AS p ON p.id = a.user_id
  WHERE normalized_status IS NULL OR rr.status = normalized_status
  ORDER BY rr.created_at DESC, rr.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_resolve_affiliate_refund_review(
  p_review_id uuid,
  p_note text
)
RETURNS public.affiliate_refund_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  review_row public.affiliate_refund_reviews%ROWTYPE;
  normalized_note text := btrim(COALESCE(p_note, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF length(normalized_note) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'Observacao de revisao invalida';
  END IF;

  UPDATE public.affiliate_refund_reviews
  SET
    status = 'resolved',
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_note = normalized_note
  WHERE id = p_review_id AND status = 'pending'
  RETURNING * INTO review_row;

  IF review_row.id IS NULL THEN
    RAISE EXCEPTION 'Revisao pendente nao encontrada';
  END IF;

  RETURN review_row;
END;
$$;

ALTER TABLE public.affiliate_refund_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS affiliate_refund_reviews_owner_select
  ON public.affiliate_refund_reviews;
CREATE POLICY affiliate_refund_reviews_owner_select
  ON public.affiliate_refund_reviews
  FOR SELECT TO authenticated
  USING (public.has_role('owner'::public.app_role));

REVOKE ALL ON TABLE public.affiliate_refund_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.affiliate_refund_reviews TO authenticated;

REVOKE ALL ON FUNCTION public.owner_save_affiliate_program_draft(integer, text, integer, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_list_affiliate_candidates(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_list_affiliate_referrals(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_list_affiliate_referred_orders(uuid, uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_list_affiliate_refund_reviews(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_resolve_affiliate_refund_review(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owner_save_affiliate_program_draft(integer, text, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliate_candidates(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliate_referrals(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliate_referred_orders(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliate_refund_reviews(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_resolve_affiliate_refund_review(uuid, text) TO authenticated;

COMMENT ON COLUMN public.affiliate_program_settings.withdrawal_method IS
  'Quinta regra comercial do programa: forma de pagamento do saque. Permanece nula ate decisao do cliente.';
COMMENT ON TABLE public.affiliate_refund_reviews IS
  'Fila neutra para reembolsos ocorridos depois da liberacao de uma comissao. Nenhum ajuste financeiro automatico e aplicado sem regra comercial definida.';
COMMENT ON FUNCTION public.owner_save_affiliate_program_draft(integer, text, integer, numeric, text) IS
  'Salva as cinco regras como rascunho e mantem o programa desligado.';
COMMENT ON FUNCTION public.owner_list_affiliate_referred_orders(uuid, uuid, integer, integer) IS
  'Lista pedidos das contas indicadas, com eventual comissao associada.';

COMMIT;
