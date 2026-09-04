BEGIN;

-- Consultas operacionais para o painel administrativo. Mantem a escrita em
-- funcoes dedicadas e evita que o frontend precise montar saldos financeiros.

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
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'active')
  INTO affiliates_count, active_affiliates_count
  FROM public.affiliates;

  SELECT count(*) INTO referrals_count
  FROM public.affiliate_referrals;

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

  RETURN jsonb_build_object(
    'enabled', settings_row.enabled,
    'commissionRateBps', settings_row.commission_rate_bps,
    'commissionBaseMode', settings_row.commission_base_mode,
    'holdDays', settings_row.hold_days,
    'minimumWithdrawal', settings_row.minimum_withdrawal,
    'affiliatesCount', affiliates_count,
    'activeAffiliatesCount', active_affiliates_count,
    'referralsCount', referrals_count,
    'pendingCommissionAmount', pending_commission,
    'availableCommissionGrossAmount', available_commission,
    'requestedWithdrawalAmount', requested_withdrawals,
    'paidWithdrawalAmount', paid_withdrawals,
    'unreservedAvailableAmount', greatest(available_commission - requested_withdrawals - paid_withdrawals, 0),
    'requestedWithdrawalsCount', requested_withdrawals_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_list_affiliates(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  affiliate_id uuid,
  user_id uuid,
  full_name text,
  email text,
  referral_code text,
  status text,
  activated_at timestamptz,
  referred_customers_count bigint,
  pending_commission_amount numeric,
  available_balance numeric,
  paid_withdrawal_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  normalized_status text := NULLIF(btrim(COALESCE(p_status, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF normalized_status IS NOT NULL AND normalized_status NOT IN ('active', 'disabled') THEN
    RAISE EXCEPTION 'Status de afiliado invalido';
  END IF;

  RETURN QUERY
  WITH referral_totals AS (
    SELECT r.affiliate_id, count(*) AS total
    FROM public.affiliate_referrals AS r
    GROUP BY r.affiliate_id
  ), commission_totals AS (
    SELECT
      c.affiliate_id,
      COALESCE(sum(c.commission_amount) FILTER (WHERE c.status = 'pending'), 0) AS pending_amount,
      COALESCE(sum(c.commission_amount) FILTER (WHERE c.status = 'available'), 0) AS available_amount
    FROM public.affiliate_commissions AS c
    GROUP BY c.affiliate_id
  ), withdrawal_totals AS (
    SELECT
      w.affiliate_id,
      COALESCE(sum(w.amount) FILTER (WHERE w.status = 'requested'), 0) AS requested_amount,
      COALESCE(sum(w.amount) FILTER (WHERE w.status = 'paid'), 0) AS paid_amount
    FROM public.affiliate_withdrawals AS w
    GROUP BY w.affiliate_id
  )
  SELECT
    a.id,
    a.user_id,
    p.full_name,
    p.email,
    a.referral_code,
    a.status,
    a.activated_at,
    COALESCE(rt.total, 0),
    COALESCE(ct.pending_amount, 0),
    greatest(
      COALESCE(ct.available_amount, 0)
      - COALESCE(wt.requested_amount, 0)
      - COALESCE(wt.paid_amount, 0),
      0
    ),
    COALESCE(wt.paid_amount, 0)
  FROM public.affiliates AS a
  LEFT JOIN public.profiles AS p ON p.id = a.user_id
  LEFT JOIN referral_totals AS rt ON rt.affiliate_id = a.id
  LEFT JOIN commission_totals AS ct ON ct.affiliate_id = a.id
  LEFT JOIN withdrawal_totals AS wt ON wt.affiliate_id = a.id
  WHERE (normalized_status IS NULL OR a.status = normalized_status)
    AND (
      normalized_search IS NULL
      OR a.referral_code ILIKE '%' || normalized_search || '%'
      OR COALESCE(p.full_name, '') ILIKE '%' || normalized_search || '%'
      OR COALESCE(p.email, '') ILIKE '%' || normalized_search || '%'
    )
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_list_affiliate_withdrawals(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  withdrawal_id uuid,
  affiliate_id uuid,
  affiliate_user_id uuid,
  affiliate_name text,
  affiliate_email text,
  amount numeric,
  destination_snapshot jsonb,
  status text,
  rejection_reason text,
  requested_at timestamptz,
  processed_at timestamptz
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
  IF normalized_status IS NOT NULL AND normalized_status NOT IN ('requested', 'paid', 'rejected') THEN
    RAISE EXCEPTION 'Status de saque invalido';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.affiliate_id,
    a.user_id,
    p.full_name,
    p.email,
    w.amount,
    w.destination_snapshot,
    w.status,
    w.rejection_reason,
    w.requested_at,
    w.processed_at
  FROM public.affiliate_withdrawals AS w
  JOIN public.affiliates AS a ON a.id = w.affiliate_id
  LEFT JOIN public.profiles AS p ON p.id = a.user_id
  WHERE normalized_status IS NULL OR w.status = normalized_status
  ORDER BY w.requested_at DESC, w.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_list_affiliate_commissions(
  p_affiliate_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  commission_id uuid,
  affiliate_id uuid,
  affiliate_user_id uuid,
  referred_user_id uuid,
  order_id uuid,
  order_public_number text,
  sale_amount numeric,
  commission_base_amount numeric,
  commission_rate_bps integer,
  commission_amount numeric,
  status text,
  available_at timestamptz,
  created_at timestamptz
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
  IF normalized_status IS NOT NULL AND normalized_status NOT IN ('pending', 'available', 'cancelled') THEN
    RAISE EXCEPTION 'Status de comissao invalido';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.affiliate_id,
    a.user_id,
    c.referred_user_id,
    c.order_id,
    c.order_public_number,
    c.sale_amount,
    c.commission_base_amount,
    c.commission_rate_bps,
    c.commission_amount,
    c.status,
    c.available_at,
    c.created_at
  FROM public.affiliate_commissions AS c
  JOIN public.affiliates AS a ON a.id = c.affiliate_id
  WHERE (p_affiliate_id IS NULL OR c.affiliate_id = p_affiliate_id)
    AND (normalized_status IS NULL OR c.status = normalized_status)
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_get_affiliate_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_list_affiliates(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_list_affiliate_withdrawals(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_list_affiliate_commissions(uuid, text, integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owner_get_affiliate_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliates(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliate_withdrawals(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliate_commissions(uuid, text, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.owner_get_affiliate_overview() IS
  'Resumo operacional do programa de afiliados para o owner.';
COMMENT ON FUNCTION public.owner_list_affiliates(text, text, integer, integer) IS
  'Lista afiliados com indicados e saldos calculados para o painel administrativo.';
COMMENT ON FUNCTION public.owner_list_affiliate_withdrawals(text, integer, integer) IS
  'Fila de saques do programa de afiliados com destino necessario ao pagamento.';

COMMIT;
