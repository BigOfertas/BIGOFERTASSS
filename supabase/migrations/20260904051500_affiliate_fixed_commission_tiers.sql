BEGIN;

-- Comissao de afiliados por valor fixo por peca, com faixas globais e
-- sobrescritas individuais por afiliado. O percentual deixa de participar do
-- calculo de novas comissoes. Os registros antigos permanecem preservados.

CREATE TABLE IF NOT EXISTS public.affiliate_commission_tiers (
  min_units integer PRIMARY KEY,
  amount_per_unit numeric(12,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT affiliate_commission_tiers_min_units_valid CHECK (
    min_units IN (1, 5, 8, 15, 25, 35)
  ),
  CONSTRAINT affiliate_commission_tiers_amount_valid CHECK (
    amount_per_unit BETWEEN 0.01 AND 1000000
  )
);

INSERT INTO public.affiliate_commission_tiers (min_units, amount_per_unit)
VALUES
  (1, 20.00),
  (5, 20.00),
  (8, 18.00),
  (15, 15.00),
  (25, 15.00),
  (35, 12.00)
ON CONFLICT (min_units) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.affiliate_commission_tier_overrides (
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  min_units integer NOT NULL,
  amount_per_unit numeric(12,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (affiliate_id, min_units),
  CONSTRAINT affiliate_commission_tier_overrides_min_units_valid CHECK (
    min_units IN (1, 5, 8, 15, 25, 35)
  ),
  CONSTRAINT affiliate_commission_tier_overrides_amount_valid CHECK (
    amount_per_unit BETWEEN 0.01 AND 1000000
  )
);

ALTER TABLE public.affiliate_commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commission_tier_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.affiliate_commission_tiers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_commission_tier_overrides FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.affiliate_commission_tiers TO service_role;
GRANT ALL ON TABLE public.affiliate_commission_tier_overrides TO service_role;

ALTER TABLE public.affiliate_program_settings
  DROP CONSTRAINT IF EXISTS affiliate_program_enabled_requires_rules;
ALTER TABLE public.affiliate_program_settings
  ADD CONSTRAINT affiliate_program_enabled_requires_rules CHECK (
    NOT enabled OR (
      hold_days IS NOT NULL
      AND minimum_withdrawal IS NOT NULL
      AND withdrawal_method IS NOT NULL
      AND length(btrim(withdrawal_method)) BETWEEN 2 AND 60
    )
  );

UPDATE public.affiliate_program_settings
SET commission_rate_bps = NULL,
    commission_base_mode = NULL
WHERE singleton = true;

ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS commission_units integer,
  ADD COLUMN IF NOT EXISTS commission_unit_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS commission_rule_source text;

ALTER TABLE public.affiliate_commissions
  ALTER COLUMN commission_base_amount DROP NOT NULL,
  ALTER COLUMN commission_rate_bps DROP NOT NULL;

ALTER TABLE public.affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_amounts_valid;
ALTER TABLE public.affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_fixed_snapshot_valid;
ALTER TABLE public.affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_fixed_snapshot_valid CHECK (
    sale_amount >= 0
    AND commission_amount >= 0
    AND (
      (
        commission_units IS NOT NULL
        AND commission_units > 0
        AND commission_unit_amount IS NOT NULL
        AND commission_unit_amount > 0
        AND commission_rule_source IN ('global', 'affiliate')
        AND commission_base_amount IS NULL
        AND commission_rate_bps IS NULL
      )
      OR
      (
        commission_units IS NULL
        AND commission_unit_amount IS NULL
        AND commission_rule_source IS NULL
        AND commission_base_amount IS NOT NULL
        AND commission_base_amount >= 0
        AND commission_rate_bps BETWEEN 1 AND 10000
      )
    )
  );

CREATE OR REPLACE FUNCTION public.get_affiliate_effective_commission_tiers(p_affiliate_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'minUnits', t.min_units,
        'amountPerUnit', COALESCE(o.amount_per_unit, t.amount_per_unit),
        'source', CASE WHEN o.amount_per_unit IS NULL THEN 'global' ELSE 'affiliate' END
      )
      ORDER BY t.min_units
    ),
    '[]'::jsonb
  )
  FROM public.affiliate_commission_tiers AS t
  LEFT JOIN public.affiliate_commission_tier_overrides AS o
    ON o.affiliate_id = p_affiliate_id
   AND o.min_units = t.min_units;
$$;

CREATE OR REPLACE FUNCTION public.resolve_affiliate_commission_tier(
  p_affiliate_id uuid,
  p_units integer
)
RETURNS TABLE (
  min_units integer,
  amount_per_unit numeric,
  rule_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    t.min_units,
    COALESCE(o.amount_per_unit, t.amount_per_unit),
    CASE WHEN o.amount_per_unit IS NULL THEN 'global' ELSE 'affiliate' END
  FROM public.affiliate_commission_tiers AS t
  LEFT JOIN public.affiliate_commission_tier_overrides AS o
    ON o.affiliate_id = p_affiliate_id
   AND o.min_units = t.min_units
  WHERE t.min_units <= p_units
  ORDER BY t.min_units DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_affiliate_effective_commission_tiers(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_affiliate_commission_tier(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_affiliate_effective_commission_tiers(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_affiliate_commission_tier(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.owner_get_affiliate_fixed_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.affiliate_program_settings%ROWTYPE;
  tier_count integer := 0;
  tiers jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;

  SELECT count(*), COALESCE(
    jsonb_agg(
      jsonb_build_object('minUnits', min_units, 'amountPerUnit', amount_per_unit)
      ORDER BY min_units
    ),
    '[]'::jsonb
  )
  INTO tier_count, tiers
  FROM public.affiliate_commission_tiers;

  RETURN jsonb_build_object(
    'enabled', settings_row.enabled,
    'rulesComplete',
      tier_count = 6
      AND settings_row.hold_days IS NOT NULL
      AND settings_row.minimum_withdrawal IS NOT NULL
      AND settings_row.withdrawal_method IS NOT NULL,
    'commissionTiers', tiers,
    'holdDays', settings_row.hold_days,
    'minimumWithdrawal', settings_row.minimum_withdrawal,
    'withdrawalMethod', settings_row.withdrawal_method
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_save_affiliate_fixed_settings(
  p_enabled boolean,
  p_commission_tiers jsonb,
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
  tier_count integer := 0;
  distinct_count integer := 0;
  tiers_valid boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF p_commission_tiers IS NULL OR jsonb_typeof(p_commission_tiers) <> 'array' THEN
    RAISE EXCEPTION 'Valores de comissao invalidos';
  END IF;

  SELECT
    count(*),
    count(DISTINCT min_units),
    COALESCE(bool_and(
      min_units IN (1, 5, 8, 15, 25, 35)
      AND amount_per_unit BETWEEN 0.01 AND 1000000
    ), false)
  INTO tier_count, distinct_count, tiers_valid
  FROM (
    SELECT
      (value ->> 'minUnits')::integer AS min_units,
      (value ->> 'amountPerUnit')::numeric AS amount_per_unit
    FROM jsonb_array_elements(p_commission_tiers)
  ) AS parsed;

  IF tier_count <> 6 OR distinct_count <> 6 OR NOT tiers_valid THEN
    RAISE EXCEPTION 'As seis faixas de comissao precisam ser informadas';
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
  IF p_enabled AND (
    p_hold_days IS NULL
    OR p_minimum_withdrawal IS NULL
    OR normalized_method IS NULL
  ) THEN
    RAISE EXCEPTION 'Complete as regras antes de ativar o programa';
  END IF;

  INSERT INTO public.affiliate_commission_tiers (
    min_units, amount_per_unit, updated_at, updated_by
  )
  SELECT
    (value ->> 'minUnits')::integer,
    (value ->> 'amountPerUnit')::numeric,
    now(),
    auth.uid()
  FROM jsonb_array_elements(p_commission_tiers)
  ON CONFLICT (min_units) DO UPDATE
  SET amount_per_unit = EXCLUDED.amount_per_unit,
      updated_at = now(),
      updated_by = auth.uid();

  UPDATE public.affiliate_program_settings
  SET enabled = p_enabled,
      commission_rate_bps = NULL,
      commission_base_mode = NULL,
      hold_days = p_hold_days,
      minimum_withdrawal = p_minimum_withdrawal,
      withdrawal_method = normalized_method,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE singleton = true;

  RETURN public.owner_get_affiliate_fixed_settings();
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_get_affiliate_commission_rules(p_affiliate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  global_tiers jsonb := '[]'::jsonb;
  overrides jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affiliates WHERE id = p_affiliate_id) THEN
    RAISE EXCEPTION 'Afiliado nao encontrado';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('minUnits', min_units, 'amountPerUnit', amount_per_unit)
      ORDER BY min_units
    ),
    '[]'::jsonb
  ) INTO global_tiers
  FROM public.affiliate_commission_tiers;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('minUnits', min_units, 'amountPerUnit', amount_per_unit)
      ORDER BY min_units
    ),
    '[]'::jsonb
  ) INTO overrides
  FROM public.affiliate_commission_tier_overrides
  WHERE affiliate_id = p_affiliate_id;

  RETURN jsonb_build_object(
    'affiliateId', p_affiliate_id,
    'globalTiers', global_tiers,
    'overrides', overrides,
    'effectiveTiers', public.get_affiliate_effective_commission_tiers(p_affiliate_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_save_affiliate_commission_overrides(
  p_affiliate_id uuid,
  p_overrides jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item_count integer := 0;
  distinct_count integer := 0;
  items_valid boolean := true;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affiliates WHERE id = p_affiliate_id) THEN
    RAISE EXCEPTION 'Afiliado nao encontrado';
  END IF;
  IF p_overrides IS NULL OR jsonb_typeof(p_overrides) <> 'array' THEN
    RAISE EXCEPTION 'Valores individuais invalidos';
  END IF;

  SELECT
    count(*),
    count(DISTINCT min_units),
    COALESCE(bool_and(
      min_units IN (1, 5, 8, 15, 25, 35)
      AND amount_per_unit BETWEEN 0.01 AND 1000000
    ), true)
  INTO item_count, distinct_count, items_valid
  FROM (
    SELECT
      (value ->> 'minUnits')::integer AS min_units,
      (value ->> 'amountPerUnit')::numeric AS amount_per_unit
    FROM jsonb_array_elements(p_overrides)
  ) AS parsed;

  IF item_count > 6 OR item_count <> distinct_count OR NOT items_valid THEN
    RAISE EXCEPTION 'Valores individuais invalidos';
  END IF;

  DELETE FROM public.affiliate_commission_tier_overrides
  WHERE affiliate_id = p_affiliate_id;

  INSERT INTO public.affiliate_commission_tier_overrides (
    affiliate_id, min_units, amount_per_unit, updated_at, updated_by
  )
  SELECT
    p_affiliate_id,
    (value ->> 'minUnits')::integer,
    (value ->> 'amountPerUnit')::numeric,
    now(),
    auth.uid()
  FROM jsonb_array_elements(p_overrides);

  RETURN public.owner_get_affiliate_commission_rules(p_affiliate_id);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_get_affiliate_fixed_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_save_affiliate_fixed_settings(boolean, jsonb, integer, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_get_affiliate_commission_rules(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_save_affiliate_commission_overrides(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_get_affiliate_fixed_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_save_affiliate_fixed_settings(boolean, jsonb, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_get_affiliate_commission_rules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_save_affiliate_commission_overrides(uuid, jsonb) TO authenticated;

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

  RETURN commission_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_activate_affiliate(p_user_id uuid)
RETURNS public.affiliates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.affiliate_program_settings%ROWTYPE;
  affiliate_row public.affiliates%ROWTYPE;
  was_active boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;
  IF NOT settings_row.enabled THEN
    RAISE EXCEPTION 'Configure e habilite o programa de afiliados antes de ativar contas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'customer'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Cliente nao encontrado';
  END IF;

  SELECT * INTO affiliate_row
  FROM public.affiliates
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF affiliate_row.id IS NOT NULL THEN
    was_active := affiliate_row.status = 'active';
    IF NOT was_active THEN
      UPDATE public.affiliates
      SET status = 'active', activated_at = now(), deactivated_at = NULL
      WHERE id = affiliate_row.id
      RETURNING * INTO affiliate_row;
    END IF;
  ELSE
    INSERT INTO public.affiliates (user_id, referral_code)
    VALUES (p_user_id, public.generate_affiliate_referral_code())
    RETURNING * INTO affiliate_row;
  END IF;

  IF NOT was_active THEN
    INSERT INTO public.notification_events (
      user_id, order_id, event_name, payload, idempotency_key
    )
    VALUES (
      affiliate_row.user_id,
      NULL,
      'affiliate.created',
      jsonb_build_object(
        'referral_code', affiliate_row.referral_code,
        'commission_tiers', public.get_affiliate_effective_commission_tiers(affiliate_row.id)
      ),
      'affiliate.created:' || affiliate_row.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN affiliate_row;
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
  tier_count integer := 0;
  rules_complete boolean := false;
  tiers jsonb := '[]'::jsonb;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;

  SELECT * INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;

  SELECT count(*) INTO tier_count FROM public.affiliate_commission_tiers;
  rules_complete :=
    tier_count = 6
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
      'commissionTiers', tiers,
      'withdrawalMethod', settings_row.withdrawal_method
    );
  END IF;

  tiers := public.get_affiliate_effective_commission_tiers(affiliate_row.id);
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
    'commissionTiers', tiers,
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

DROP FUNCTION IF EXISTS public.owner_list_affiliate_commissions(uuid, text, integer, integer);
CREATE FUNCTION public.owner_list_affiliate_commissions(
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
  commission_units integer,
  commission_unit_amount numeric,
  commission_rule_source text,
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
    c.commission_units,
    c.commission_unit_amount,
    c.commission_rule_source,
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

REVOKE ALL ON FUNCTION public.owner_list_affiliate_commissions(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliate_commissions(uuid, text, integer, integer) TO authenticated;

COMMENT ON TABLE public.affiliate_commission_tiers IS
  'Faixas globais de comissao fixa por peca do programa de afiliados.';
COMMENT ON TABLE public.affiliate_commission_tier_overrides IS
  'Sobrescritas individuais de comissao fixa por peca para afiliados especificos.';

COMMIT;