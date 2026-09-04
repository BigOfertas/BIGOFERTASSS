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

COMMIT;`;

write("supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql", migration);

const adminLib = "src/lib/admin-affiliates.ts";
replaceExact(
  adminLib,
  `  commission_base_amount: number;\n  commission_rate_bps: number;\n  commission_amount: number;`,
  `  commission_units: number | null;\n  commission_unit_amount: number | null;\n  commission_rule_source: \"global\" | \"affiliate\" | null;\n  commission_amount: number;`,
);

let adminLibSource = read(adminLib);
if (!adminLibSource.includes("export type AffiliateCommissionTier")) {
  adminLibSource += `\n\nexport type AffiliateCommissionTier = {\n  minUnits: number;\n  amountPerUnit: number;\n  source?: \"global\" | \"affiliate\";\n};\n\nexport type AffiliateFixedSettings = {\n  enabled: boolean;\n  rulesComplete: boolean;\n  commissionTiers: AffiliateCommissionTier[];\n  holdDays: number | null;\n  minimumWithdrawal: number | null;\n  withdrawalMethod: string | null;\n};\n\nexport type AffiliateCommissionRules = {\n  affiliateId: string;\n  globalTiers: AffiliateCommissionTier[];\n  overrides: AffiliateCommissionTier[];\n  effectiveTiers: AffiliateCommissionTier[];\n};\n\nfunction normalizeTier(value: unknown): AffiliateCommissionTier | null {\n  const row = recordValue(value);\n  const minUnits = numberValue(row.minUnits);\n  const amountPerUnit = numberValue(row.amountPerUnit);\n  if (![1, 5, 8, 15, 25, 35].includes(minUnits) || amountPerUnit <= 0) return null;\n  return {\n    minUnits,\n    amountPerUnit,\n    source: row.source === \"affiliate\" ? \"affiliate\" : row.source === \"global\" ? \"global\" : undefined,\n  };\n}\n\nfunction normalizeTiers(value: unknown) {\n  if (!Array.isArray(value)) return [];\n  return value.flatMap((item) => {\n    const tier = normalizeTier(item);\n    return tier ? [tier] : [];\n  }).sort((a, b) => a.minUnits - b.minUnits);\n}\n\nexport async function fetchAffiliateFixedSettings(): Promise<AffiliateFixedSettings> {\n  const row = recordValue(await callSupabaseRpc<unknown>(\"owner_get_affiliate_fixed_settings\"));\n  return {\n    enabled: row.enabled === true,\n    rulesComplete: row.rulesComplete === true,\n    commissionTiers: normalizeTiers(row.commissionTiers),\n    holdDays: nullableNumber(row.holdDays),\n    minimumWithdrawal: nullableNumber(row.minimumWithdrawal),\n    withdrawalMethod: text(row.withdrawalMethod),\n  };\n}\n\nexport function saveAffiliateFixedSettings(settings: AffiliateFixedSettings) {\n  return callSupabaseRpc<unknown>(\"owner_save_affiliate_fixed_settings\", {\n    p_enabled: settings.enabled,\n    p_commission_tiers: settings.commissionTiers.map(({ minUnits, amountPerUnit }) => ({ minUnits, amountPerUnit })),\n    p_hold_days: settings.holdDays,\n    p_minimum_withdrawal: settings.minimumWithdrawal,\n    p_withdrawal_method: settings.withdrawalMethod,\n  });\n}\n\nexport async function fetchAffiliateCommissionRules(affiliateId: string): Promise<AffiliateCommissionRules> {\n  const row = recordValue(await callSupabaseRpc<unknown>(\"owner_get_affiliate_commission_rules\", {\n    p_affiliate_id: affiliateId,\n  }));\n  return {\n    affiliateId: text(row.affiliateId) ?? affiliateId,\n    globalTiers: normalizeTiers(row.globalTiers),\n    overrides: normalizeTiers(row.overrides),\n    effectiveTiers: normalizeTiers(row.effectiveTiers),\n  };\n}\n\nexport function saveAffiliateCommissionOverrides(affiliateId: string, overrides: AffiliateCommissionTier[]) {\n  return callSupabaseRpc<unknown>(\"owner_save_affiliate_commission_overrides\", {\n    p_affiliate_id: affiliateId,\n    p_overrides: overrides.map(({ minUnits, amountPerUnit }) => ({ minUnits, amountPerUnit })),\n  });\n}\n`;
  write(adminLib, adminLibSource);
}

write("src/lib/affiliates.ts", `import { callSupabaseRpc } from \"@/lib/supabase-rpc\";\n\nexport type AffiliateCommissionTier = {\n  minUnits: number;\n  amountPerUnit: number;\n  source: \"global\" | \"affiliate\";\n};\n\nexport type AffiliateDashboard = {\n  isAffiliate: boolean;\n  programEnabled: boolean;\n  rulesComplete: boolean;\n  status: \"active\" | \"disabled\" | null;\n  referralCode: string | null;\n  commissionTiers: AffiliateCommissionTier[];\n  holdDays: number | null;\n  minimumWithdrawal: number | null;\n  withdrawalMethod: string | null;\n  referralsCount: number;\n  pendingAmount: number;\n  availableAmount: number;\n  requestedWithdrawalAmount: number;\n  paidWithdrawalAmount: number;\n};\n\nexport type AffiliateReferralRow = {\n  referred_at: string;\n  display_name: string;\n  masked_email: string;\n  commissions_count: number;\n  generated_commission_amount: number;\n};\n\nexport type AffiliateCommissionRow = {\n  id: string;\n  affiliate_id: string;\n  referred_user_id: string;\n  order_id: string;\n  order_public_number: string;\n  sale_amount: number;\n  commission_base_amount: number | null;\n  commission_rate_bps: number | null;\n  commission_units: number | null;\n  commission_unit_amount: number | null;\n  commission_rule_source: \"global\" | \"affiliate\" | null;\n  commission_amount: number;\n  status: \"pending\" | \"available\" | \"cancelled\";\n  available_at: string;\n  available_since: string | null;\n  cancelled_at: string | null;\n  cancellation_reason: string | null;\n  created_at: string;\n};\n\nexport type AffiliateWithdrawalRow = {\n  id: string;\n  affiliate_id: string;\n  amount: number;\n  destination_snapshot: Record<string, unknown>;\n  status: \"requested\" | \"paid\" | \"rejected\";\n  rejection_reason: string | null;\n  requested_at: string;\n  processed_at: string | null;\n};\n\nfunction recordValue(value: unknown) {\n  return value && typeof value === \"object\" && !Array.isArray(value)\n    ? (value as Record<string, unknown>)\n    : {};\n}\n\nfunction text(value: unknown) {\n  return typeof value === \"string\" && value.trim() ? value.trim() : null;\n}\n\nfunction numberValue(value: unknown) {\n  const numeric = typeof value === \"number\" ? value : Number(value);\n  return Number.isFinite(numeric) ? numeric : 0;\n}\n\nfunction nullableNumber(value: unknown) {\n  if (value === null || value === undefined || value === \"\") return null;\n  const numeric = typeof value === \"number\" ? value : Number(value);\n  return Number.isFinite(numeric) ? numeric : null;\n}\n\nfunction normalizeTiers(value: unknown): AffiliateCommissionTier[] {\n  if (!Array.isArray(value)) return [];\n  return value.flatMap((item) => {\n    const row = recordValue(item);\n    const minUnits = numberValue(row.minUnits);\n    const amountPerUnit = numberValue(row.amountPerUnit);\n    if (![1, 5, 8, 15, 25, 35].includes(minUnits) || amountPerUnit <= 0) return [];\n    return [{\n      minUnits,\n      amountPerUnit,\n      source: row.source === \"affiliate\" ? \"affiliate\" as const : \"global\" as const,\n    }];\n  }).sort((a, b) => a.minUnits - b.minUnits);\n}\n\nfunction normalizeDashboard(value: unknown): AffiliateDashboard {\n  const row = recordValue(value);\n  const status = row.status === \"active\" || row.status === \"disabled\" ? row.status : null;\n\n  return {\n    isAffiliate: row.isAffiliate === true,\n    programEnabled: row.programEnabled === true,\n    rulesComplete: row.rulesComplete === true,\n    status,\n    referralCode: text(row.referralCode),\n    commissionTiers: normalizeTiers(row.commissionTiers),\n    holdDays: nullableNumber(row.holdDays),\n    minimumWithdrawal: nullableNumber(row.minimumWithdrawal),\n    withdrawalMethod: text(row.withdrawalMethod),\n    referralsCount: numberValue(row.referralsCount),\n    pendingAmount: numberValue(row.pendingAmount),\n    availableAmount: numberValue(row.availableAmount),\n    requestedWithdrawalAmount: numberValue(row.requestedWithdrawalAmount),\n    paidWithdrawalAmount: numberValue(row.paidWithdrawalAmount),\n  };\n}\n\nexport async function fetchMyAffiliateDashboard() {\n  return normalizeDashboard(await callSupabaseRpc<unknown>(\"get_my_affiliate_dashboard\"));\n}\n\nexport async function fetchMyAffiliateReferrals() {\n  return callSupabaseRpc<AffiliateReferralRow[]>(\"list_my_affiliate_referrals\", { p_limit: 100, p_offset: 0 });\n}\n\nexport async function fetchMyAffiliateCommissions() {\n  return callSupabaseRpc<AffiliateCommissionRow[]>(\"list_my_affiliate_commissions\", { p_limit: 100, p_offset: 0 });\n}\n\nexport async function fetchMyAffiliateWithdrawals() {\n  return callSupabaseRpc<AffiliateWithdrawalRow[]>(\"list_my_affiliate_withdrawals\", { p_limit: 100, p_offset: 0 });\n}\n`);

const commissionEditor = `import { useMutation, useQuery, useQueryClient } from \"@tanstack/react-query\";\nimport { CircleDollarSign, Loader2, Save, Settings2, X } from \"lucide-react\";\nimport { useEffect, useMemo, useState } from \"react\";\n\nimport {\n  fetchAffiliateCommissionRules,\n  fetchAffiliateFixedSettings,\n  listAdminAffiliates,\n  saveAffiliateCommissionOverrides,\n  saveAffiliateFixedSettings,\n  type AffiliateCommissionTier,\n} from \"@/lib/admin-affiliates\";\nimport { getUserFacingError } from \"@/lib/user-facing-error\";\n\nconst TIER_MINIMUMS = [1, 5, 8, 15, 25, 35] as const;\nconst currencyFormatter = new Intl.NumberFormat(\"pt-BR\", { style: \"currency\", currency: \"BRL\" });\n\nfunction money(value: number) {\n  return currencyFormatter.format(Number.isFinite(value) ? value : 0);\n}\n\nfunction tierLabel(minUnits: number) {\n  if (minUnits === 1) return \"Padrão (1 a 4 peças)\";\n  return \`A partir de \${minUnits} peças\`;\n}\n\nfunction parseMoney(value: string) {\n  const parsed = Number(value.replace(\",\", \".\"));\n  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;\n}\n\nexport function AffiliateCommissionSettings() {\n  const queryClient = useQueryClient();\n  const [tierValues, setTierValues] = useState<Record<number, string>>({});\n  const [holdDays, setHoldDays] = useState(\"\");\n  const [minimumWithdrawal, setMinimumWithdrawal] = useState(\"\");\n  const [withdrawalMethod, setWithdrawalMethod] = useState(\"\");\n  const [initialized, setInitialized] = useState(false);\n  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);\n  const [overrideValues, setOverrideValues] = useState<Record<number, string>>({});\n  const [overridesInitialized, setOverridesInitialized] = useState(false);\n  const [statusMessage, setStatusMessage] = useState(\"\");\n  const [errorMessage, setErrorMessage] = useState(\"\");\n\n  const settingsQuery = useQuery({\n    queryKey: [\"admin-affiliate-fixed-settings\"],\n    queryFn: fetchAffiliateFixedSettings,\n    staleTime: 15_000,\n  });\n  const affiliatesQuery = useQuery({\n    queryKey: [\"admin-affiliate-fixed-settings\", \"affiliates\"],\n    queryFn: () => listAdminAffiliates(\"\"),\n    staleTime: 15_000,\n  });\n  const rulesQuery = useQuery({\n    queryKey: [\"admin-affiliate-fixed-settings\", \"rules\", selectedAffiliateId],\n    queryFn: () => fetchAffiliateCommissionRules(selectedAffiliateId!),\n    enabled: Boolean(selectedAffiliateId),\n    staleTime: 0,\n  });\n\n  useEffect(() => {\n    const data = settingsQuery.data;\n    if (!data || initialized) return;\n    setTierValues(Object.fromEntries(data.commissionTiers.map((tier) => [tier.minUnits, String(tier.amountPerUnit)])));\n    setHoldDays(data.holdDays === null ? \"\" : String(data.holdDays));\n    setMinimumWithdrawal(data.minimumWithdrawal === null ? \"\" : String(data.minimumWithdrawal));\n    setWithdrawalMethod(data.withdrawalMethod ?? \"\");\n    setInitialized(true);\n  }, [initialized, settingsQuery.data]);\n\n  useEffect(() => {\n    const data = rulesQuery.data;\n    if (!data || overridesInitialized) return;\n    setOverrideValues(Object.fromEntries(data.overrides.map((tier) => [tier.minUnits, String(tier.amountPerUnit)])));\n    setOverridesInitialized(true);\n  }, [overridesInitialized, rulesQuery.data]);\n\n  const globalTiers = useMemo<AffiliateCommissionTier[]>(() =>\n    TIER_MINIMUMS.flatMap((minUnits) => {\n      const amountPerUnit = parseMoney(tierValues[minUnits] ?? \"\");\n      return amountPerUnit === null ? [] : [{ minUnits, amountPerUnit }];\n    }), [tierValues]);\n\n  const complete = globalTiers.length === TIER_MINIMUMS.length\n    && (!holdDays.trim() || (Number.isInteger(Number(holdDays)) && Number(holdDays) >= 0 && Number(holdDays) <= 365))\n    && (!minimumWithdrawal.trim() || parseMoney(minimumWithdrawal) !== null)\n    && (!withdrawalMethod.trim() || withdrawalMethod.trim().length >= 2);\n  const activationComplete = complete && holdDays.trim() !== \"\" && minimumWithdrawal.trim() !== \"\" && withdrawalMethod.trim().length >= 2;\n\n  const mutation = useMutation({\n    mutationFn: async (action: () => Promise<unknown>) => action(),\n    onSuccess: async () => {\n      await Promise.all([\n        queryClient.invalidateQueries({ queryKey: [\"admin-affiliate\"] }),\n        queryClient.invalidateQueries({ queryKey: [\"admin-affiliate-fixed-settings\"] }),\n      ]);\n    },\n  });\n\n  async function run(action: () => Promise<unknown>, success: string) {\n    if (mutation.isPending) return;\n    setStatusMessage(\"\");\n    setErrorMessage(\"\");\n    try {\n      await mutation.mutateAsync(action);\n      setStatusMessage(success);\n    } catch (error) {\n      setErrorMessage(getUserFacingError(error, \"Não foi possível salvar as comissões agora.\"));\n    }\n  }\n\n  function settingsPayload(enabled: boolean) {\n    return {\n      enabled,\n      rulesComplete: activationComplete,\n      commissionTiers: globalTiers,\n      holdDays: holdDays.trim() ? Number(holdDays) : null,\n      minimumWithdrawal: minimumWithdrawal.trim() ? parseMoney(minimumWithdrawal) : null,\n      withdrawalMethod: withdrawalMethod.trim() || null,\n    };\n  }\n\n  const selectedAffiliate = (affiliatesQuery.data ?? []).find((row) => row.affiliate_id === selectedAffiliateId) ?? null;\n  const ruleGlobals = rulesQuery.data?.globalTiers ?? settingsQuery.data?.commissionTiers ?? [];\n\n  if (settingsQuery.isLoading) {\n    return <div className=\"rounded-xl border border-gray-200 bg-white px-6 py-10 text-center\"><Loader2 className=\"mx-auto h-6 w-6 animate-spin text-red-600\" /><p className=\"mt-3 text-sm font-semibold text-gray-500\">Carregando comissões...</p></div>;\n  }\n\n  if (settingsQuery.error || !settingsQuery.data) {\n    return <div className=\"rounded-xl border border-red-200 bg-red-50 px-5 py-5 text-sm font-bold text-red-700\">Não foi possível carregar a configuração de comissões.</div>;\n  }\n\n  return (\n    <section className=\"space-y-5\">\n      {statusMessage ? <p className=\"rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800\">{statusMessage}</p> : null}\n      {errorMessage ? <p role=\"alert\" className=\"rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700\">{errorMessage}</p> : null}\n\n      <div className=\"rounded-xl border border-gray-200 bg-white p-5 sm:p-6\">\n        <div className=\"flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between\">\n          <div>\n            <p className=\"text-xs font-bold uppercase tracking-[0.1em] text-red-600\">Comissão geral dos influenciadores</p>\n            <h2 className=\"mt-1 text-xl font-black text-gray-950\">Valor fixo por peça</h2>\n            <p className=\"mt-2 max-w-3xl text-sm leading-6 text-gray-600\">O valor da faixa é pago por peça do pedido. A faixa mais alta atingida vale para todas as peças daquele pedido. Todos os valores ficam visíveis ao mesmo tempo para facilitar promoções futuras.</p>\n          </div>\n          <span className={\`w-fit rounded-full px-3 py-1.5 text-xs font-black \${settingsQuery.data.enabled ? \"bg-emerald-50 text-emerald-700\" : \"bg-amber-50 text-amber-700\"}\`}>{settingsQuery.data.enabled ? \"Programa ativo\" : \"Programa desligado\"}</span>\n        </div>\n\n        <div className=\"mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6\">\n          {TIER_MINIMUMS.map((minUnits) => (\n            <label key={minUnits} className=\"rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs font-bold text-gray-700\">\n              {tierLabel(minUnits)}\n              <div className=\"mt-2 flex items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:border-red-500 focus-within:ring-4 focus-within:ring-red-50\">\n                <span className=\"text-sm font-black text-gray-500\">R$</span>\n                <input type=\"number\" min=\"0.01\" step=\"0.01\" value={tierValues[minUnits] ?? \"\"} onChange={(event) => setTierValues((current) => ({ ...current, [minUnits]: event.target.value }))} className=\"h-10 min-w-0 flex-1 border-0 bg-transparent pl-2 text-sm font-black text-gray-950 outline-none\" />\n              </div>\n            </label>\n          ))}\n        </div>\n\n        <div className=\"mt-5 grid gap-4 md:grid-cols-3\">\n          <label className=\"text-sm font-bold text-gray-800\">Liberação (dias)<input type=\"number\" min=\"0\" max=\"365\" step=\"1\" value={holdDays} onChange={(event) => setHoldDays(event.target.value)} placeholder=\"A definir\" className=\"mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50\" /></label>\n          <label className=\"text-sm font-bold text-gray-800\">Saque mínimo (R$)<input type=\"number\" min=\"0.01\" step=\"0.01\" value={minimumWithdrawal} onChange={(event) => setMinimumWithdrawal(event.target.value)} placeholder=\"A definir\" className=\"mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50\" /></label>\n          <label className=\"text-sm font-bold text-gray-800\">Forma de pagamento<input value={withdrawalMethod} onChange={(event) => setWithdrawalMethod(event.target.value)} maxLength={60} placeholder=\"A definir\" className=\"mt-1.5 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50\" /></label>\n        </div>\n\n        <div className=\"mt-5 flex flex-wrap gap-2\">\n          <button type=\"button\" disabled={mutation.isPending || !complete} onClick={() => void run(() => saveAffiliateFixedSettings(settingsPayload(settingsQuery.data.enabled)), \"Configuração geral salva.\")} className=\"inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 hover:bg-gray-50 disabled:opacity-50\"><Save className=\"mr-2 h-4 w-4\" />Salvar alterações</button>\n          {!settingsQuery.data.enabled ? (\n            <button type=\"button\" disabled={mutation.isPending || !activationComplete} onClick={() => void run(() => saveAffiliateFixedSettings(settingsPayload(true)), \"Programa de afiliados ativado.\")} className=\"inline-flex h-10 items-center rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700 disabled:bg-gray-300\">Ativar programa</button>\n          ) : (\n            <button type=\"button\" disabled={mutation.isPending || !complete} onClick={() => void run(() => saveAffiliateFixedSettings(settingsPayload(false)), \"Programa de afiliados desativado. O histórico foi preservado.\")} className=\"inline-flex h-10 items-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50\">Desativar programa</button>\n          )}\n        </div>\n      </div>\n\n      <div className=\"rounded-xl border border-gray-200 bg-white p-5 sm:p-6\">\n        <div className=\"flex items-start gap-3\"><CircleDollarSign className=\"mt-0.5 h-5 w-5 flex-none text-red-600\" /><div><h2 className=\"font-black text-gray-950\">Comissão individual por afiliado</h2><p className=\"mt-1 text-sm leading-6 text-gray-500\">Escolha um afiliado para criar exceções. Ao editar, as seis faixas aparecem juntas. Campo vazio significa “usar o valor geral”.</p></div></div>\n\n        {affiliatesQuery.isLoading ? <div className=\"py-8 text-center text-sm text-gray-500\">Carregando afiliados...</div> : (affiliatesQuery.data ?? []).length === 0 ? <div className=\"py-8 text-center text-sm text-gray-500\">Nenhum afiliado cadastrado.</div> : (\n          <div className=\"mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3\">\n            {(affiliatesQuery.data ?? []).map((row) => (\n              <button key={row.affiliate_id} type=\"button\" onClick={() => { setSelectedAffiliateId(row.affiliate_id); setOverridesInitialized(false); setOverrideValues({}); }} className={\`flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm transition \${selectedAffiliateId === row.affiliate_id ? \"border-red-300 bg-red-50\" : \"border-gray-200 bg-white hover:bg-gray-50\"}\`}><span className=\"min-w-0\"><span className=\"block truncate font-black text-gray-950\">{row.full_name || row.email || \"Afiliado\"}</span><span className=\"mt-0.5 block text-xs font-mono text-gray-500\">{row.referral_code}</span></span><Settings2 className=\"ml-3 h-4 w-4 flex-none text-gray-400\" /></button>\n            ))}\n          </div>\n        )}\n\n        {selectedAffiliateId ? (\n          <div className=\"mt-5 rounded-xl border border-red-100 bg-red-50/40 p-4 sm:p-5\">\n            <div className=\"flex items-start justify-between gap-3\"><div><p className=\"text-xs font-bold uppercase tracking-[0.08em] text-red-600\">Editando comissão individual</p><h3 className=\"mt-1 font-black text-gray-950\">{selectedAffiliate?.full_name || selectedAffiliate?.email || \"Afiliado\"}</h3></div><button type=\"button\" onClick={() => setSelectedAffiliateId(null)} className=\"rounded-lg p-2 text-gray-500 hover:bg-white\" aria-label=\"Fechar edição individual\"><X className=\"h-4 w-4\" /></button></div>\n            {rulesQuery.isLoading ? <div className=\"py-8 text-center text-sm text-gray-500\">Carregando regras...</div> : rulesQuery.error ? <div className=\"py-8 text-center text-sm font-bold text-red-700\">Não foi possível carregar as regras desse afiliado.</div> : (\n              <>\n                <div className=\"mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6\">\n                  {TIER_MINIMUMS.map((minUnits) => {\n                    const global = ruleGlobals.find((tier) => tier.minUnits === minUnits)?.amountPerUnit ?? 0;\n                    return <label key={minUnits} className=\"rounded-lg border border-gray-200 bg-white p-3 text-xs font-bold text-gray-700\">{tierLabel(minUnits)}<p className=\"mt-1 text-[11px] font-semibold text-gray-400\">Geral: {money(global)}</p><input type=\"number\" min=\"0.01\" step=\"0.01\" value={overrideValues[minUnits] ?? \"\"} onChange={(event) => setOverrideValues((current) => ({ ...current, [minUnits]: event.target.value }))} placeholder=\"Usar geral\" className=\"mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-black outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50\" /></label>;\n                  })}\n                </div>\n                <p className=\"mt-3 text-xs leading-5 text-gray-500\">Exemplo: para uma promoção exclusiva acima de 35 peças, deixe as outras cinco faixas vazias e informe apenas o novo valor em “A partir de 35 peças”.</p>\n                <div className=\"mt-4 flex flex-wrap gap-2\"><button type=\"button\" disabled={mutation.isPending} onClick={() => { const overrides = TIER_MINIMUMS.flatMap((minUnits) => { const raw = (overrideValues[minUnits] ?? \"\").trim(); if (!raw) return []; const amountPerUnit = parseMoney(raw); return amountPerUnit === null ? [] : [{ minUnits, amountPerUnit }]; }); const invalid = TIER_MINIMUMS.some((minUnits) => (overrideValues[minUnits] ?? \"\").trim() && parseMoney(overrideValues[minUnits] ?? \"\") === null); if (invalid) { setErrorMessage(\"Revise os valores individuais informados.\"); return; } void run(() => saveAffiliateCommissionOverrides(selectedAffiliateId, overrides), \"Comissão individual salva.\"); }} className=\"inline-flex h-10 items-center rounded-lg bg-gray-950 px-4 text-sm font-black text-white hover:bg-black disabled:opacity-50\"><Save className=\"mr-2 h-4 w-4\" />Salvar comissão individual</button><button type=\"button\" disabled={mutation.isPending} onClick={() => { setOverrideValues({}); void run(() => saveAffiliateCommissionOverrides(selectedAffiliateId, []), \"Valores individuais removidos. Este afiliado voltou a usar a regra geral.\"); }} className=\"h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50\">Usar tudo do geral</button></div>\n              </>\n            )}\n          </div>\n        ) : null}\n      </div>\n    </section>\n  );\n}\n`;
write("src/components/admin/AffiliateCommissionSettings.tsx", commissionEditor);

const adminPanel = "src/components/admin/AffiliateAdmin.tsx";
replaceExact(
  adminPanel,
  `import { getUserFacingError } from \"@/lib/user-facing-error\";`,
  `import { AffiliateCommissionSettings } from \"@/components/admin/AffiliateCommissionSettings\";\nimport { getUserFacingError } from \"@/lib/user-facing-error\";`,
);
replaceRegex(
  adminPanel,
  /\n      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6">[\s\S]*?\n      <\/section>\n\n      <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">[\s\S]*?\n      <\/section>\n\n      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">/,
  `\n      <AffiliateCommissionSettings />\n\n      <div className=\"grid gap-4 sm:grid-cols-2 xl:grid-cols-4\">`,
);
replaceExact(
  adminPanel,
  `<thead className="bg-gray-50 text-xs font-bold text-gray-500"><tr><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Venda</th><th className="px-5 py-3">Base</th><th className="px-5 py-3">Taxa</th><th className="px-5 py-3">Comissão</th><th className="px-5 py-3">Status</th></tr></thead>`,
  `<thead className="bg-gray-50 text-xs font-bold text-gray-500"><tr><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Venda</th><th className="px-5 py-3">Peças</th><th className="px-5 py-3">Valor por peça</th><th className="px-5 py-3">Comissão</th><th className="px-5 py-3">Status</th></tr></thead>`,
);
replaceExact(
  adminPanel,
  `<td className="px-5 py-3 tabular-nums text-gray-700">{money(row.commission_base_amount)}</td>\n                    <td className="px-5 py-3 text-gray-700">{formatPercent(row.commission_rate_bps)}</td>`,
  `<td className="px-5 py-3 tabular-nums text-gray-700">{row.commission_units ?? "—"}</td>\n                    <td className="px-5 py-3 text-gray-700">{row.commission_unit_amount === null ? "Histórico anterior" : money(row.commission_unit_amount)}</td>`,
);
replaceRegex(
  adminPanel,
  /\n      <section className="grid gap-4 md:grid-cols-4">[\s\S]*?\n      <\/section>\n    <\/div>/,
  `\n      <section className=\"grid gap-4 md:grid-cols-2\">\n        <article className=\"rounded-xl border border-gray-200 bg-white p-4\"><Clock3 className=\"h-4.5 w-4.5 text-red-600\" /><p className=\"mt-3 text-xs font-bold text-gray-500\">Prazo</p><p className=\"mt-1 text-sm font-black text-gray-950\">{overview.holdDays === null ? \"A definir\" : \`\${overview.holdDays} dias\`}</p></article>\n        <article className=\"rounded-xl border border-gray-200 bg-white p-4\"><WalletCards className=\"h-4.5 w-4.5 text-red-600\" /><p className=\"mt-3 text-xs font-bold text-gray-500\">Saque mínimo / forma</p><p className=\"mt-1 text-sm font-black text-gray-950\">{overview.minimumWithdrawal === null ? \"A definir\" : money(overview.minimumWithdrawal)} • {overview.withdrawalMethod ?? \"A definir\"}</p></article>\n      </section>\n    </div>`,
);

const accountPanel = "src/components/account/AffiliateAccountPanel.tsx";
replaceExact(accountPanel, "  BadgePercent,\n", "  CircleDollarSign,\n");
replaceExact(accountPanel, "<BadgePercent className=\"h-4.5 w-4.5 text-red-600\" aria-hidden=\"true\" />", "<CircleDollarSign className=\"h-4.5 w-4.5 text-red-600\" aria-hidden=\"true\" />");
replaceExact(accountPanel, "<BadgePercent className=\"h-5 w-5 text-amber-600\" aria-hidden=\"true\" />", "<CircleDollarSign className=\"h-5 w-5 text-amber-600\" aria-hidden=\"true\" />");
replaceExact(
  accountPanel,
  `Percentual de comissão, base de cálculo, prazo de liberação, saque mínimo e forma de pagamento ainda estão sendo definidos. Nenhum valor é estimado nesta tela antes dessa configuração.`,
  `Os valores fixos de comissão por peça, o prazo de liberação, o saque mínimo e a forma de pagamento ainda estão sendo definidos. Nenhum valor é estimado nesta tela antes dessa configuração.`,
);
replaceExact(
  accountPanel,
  `      {!dashboard.rulesComplete ? (`,
  `      {dashboard.rulesComplete && dashboard.commissionTiers.length > 0 ? (\n        <section className=\"rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6\">\n          <h3 className=\"font-black text-gray-950\">Sua comissão por peça</h3>\n          <p className=\"mt-1 text-xs leading-5 text-gray-500\">A faixa mais alta atingida no pedido define o valor pago por cada peça daquele pedido.</p>\n          <div className=\"mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6\">\n            {dashboard.commissionTiers.map((tier) => (\n              <div key={tier.minUnits} className=\"rounded-xl border border-gray-200 bg-gray-50 px-3 py-3\">\n                <p className=\"text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500\">{tier.minUnits === 1 ? \"Padrão\" : \`\${tier.minUnits}+ peças\`}</p>\n                <p className=\"mt-1 text-lg font-black text-gray-950\">{money(tier.amountPerUnit)}</p>\n                <p className=\"text-[11px] text-gray-500\">por peça</p>\n              </div>\n            ))}\n          </div>\n        </section>\n      ) : null}\n\n      {!dashboard.rulesComplete ? (`,
);

const notificationServer = "src/lib/notification-email-server.ts";
replaceExact(
  notificationServer,
  `function normalizeRate(value: string) {\n  return value.includes(\"%\") ? value : \`\${value}%\`;\n}`,
  `function fixedCommissionText(payload: Record<string, unknown>) {\n  const unitAmount = payload[\"commission_unit_amount\"];\n  const units = Number(payload[\"commission_units\"] ?? 0);\n  if ((typeof unitAmount === \"number\" && Number.isFinite(unitAmount)) || (typeof unitAmount === \"string\" && unitAmount.trim())) {\n    const amount = normalizeMoneyText(String(unitAmount));\n    return units > 0 ? \`\${amount} por peça • \${units} peças\` : \`\${amount} por peça\`;\n  }\n  return \"valor fixo por peça conforme a quantidade do pedido\";\n}`,
);
replaceRegex(notificationServer, /COMMISSION_RATE: normalizeRate\([\s\S]*?\n        \),\n      },\n    };\n  }\n\n  if \(event\.event_name === "affiliate\.commission\.created"\)/, `COMMISSION_RATE: fixedCommissionText(event.payload),\n      },\n    };\n  }\n\n  if (event.event_name === \"affiliate.commission.created\")`);
replaceRegex(notificationServer, /COMMISSION_RATE: normalizeRate\([\s\S]*?\n        \),\n      },\n    };\n  }\n\n  if \(event\.event_name === "affiliate\.commission\.available"\)/, `COMMISSION_RATE: fixedCommissionText(event.payload),\n      },\n    };\n  }\n\n  if (event.event_name === \"affiliate.commission.available\")`);

const edgeProcessor = "supabase/functions/notifications-process/index.ts";
replaceExact(
  edgeProcessor,
  `function rateText(value: string) { return value.includes(\"%\") ? value : \`\${value}%\`; }`,
  `function fixedCommissionText(event: NotificationEvent) {\n  const unitAmount = event.payload[\"commission_unit_amount\"];\n  const units = Number(event.payload[\"commission_units\"] ?? 0);\n  if ((typeof unitAmount === \"number\" && Number.isFinite(unitAmount)) || (typeof unitAmount === \"string\" && unitAmount.trim())) {\n    const amount = moneyText(String(unitAmount));\n    return units > 0 ? \`\${amount} por peça • \${units} peças\` : \`\${amount} por peça\`;\n  }\n  return \"valor fixo por peça conforme a quantidade do pedido\";\n}`,
);
replaceExact(edgeProcessor, `COMMISSION_RATE: rateText(payloadText(event, \"commission_rate\")),`, `COMMISSION_RATE: fixedCommissionText(event),`);

const docs = "docs/affiliate-email-templates.md";
let docsSource = read(docs)
  .replaceAll("Comissão vigente: `{{COMMISSION_RATE}}`", "Comissão fixa: `{{COMMISSION_RATE}}`")
  .replaceAll("Percentual aplicado: `{{COMMISSION_RATE}}`", "Regra aplicada: `{{COMMISSION_RATE}}`");
write(docs, docsSource);

const deploy = "scripts/deploy-affiliate-backend.mjs";
replaceExact(
  deploy,
  `if (!appliedNames.has(\"affiliate_program_readiness_hardening\")) {\n  await applyMigration(\n    \"affiliate_program_readiness_hardening\",\n    \"supabase/migrations/20260904050500_affiliate_program_readiness_hardening.sql\",\n  );\n  appliedNames.add(\"affiliate_program_readiness_hardening\");\n}\n\nconst verification = await readOnly(`,
  `if (!appliedNames.has(\"affiliate_program_readiness_hardening\")) {\n  await applyMigration(\n    \"affiliate_program_readiness_hardening\",\n    \"supabase/migrations/20260904050500_affiliate_program_readiness_hardening.sql\",\n  );\n  appliedNames.add(\"affiliate_program_readiness_hardening\");\n}\n\nif (!appliedNames.has(\"affiliate_fixed_commission_tiers\")) {\n  await applyMigration(\n    \"affiliate_fixed_commission_tiers\",\n    \"supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql\",\n  );\n  appliedNames.add(\"affiliate_fixed_commission_tiers\");\n}\n\nconst verification = await readOnly(`,
);
replaceExact(
  deploy,
  `  pg_catalog.to_regclass('public.affiliate_refund_reviews') is not null as refund_reviews_table,`,
  `  pg_catalog.to_regclass('public.affiliate_refund_reviews') is not null as refund_reviews_table,\n  pg_catalog.to_regclass('public.affiliate_commission_tiers') is not null as fixed_tiers_table,\n  pg_catalog.to_regclass('public.affiliate_commission_tier_overrides') is not null as fixed_overrides_table,`,
);
replaceRegex(
  deploy,
  /  not exists \(\n    select 1\n    from public\.affiliate_program_settings s[\s\S]*?\n  \) as enabled_configuration_safe;/,
  `  exists (\n    select 1 from information_schema.columns\n    where table_schema = 'public' and table_name = 'affiliate_commissions' and column_name = 'commission_unit_amount'\n  ) as fixed_snapshot_columns,\n  (select count(*) = 6 from public.affiliate_commission_tiers) as fixed_tier_count_safe,\n  not exists (\n    select 1\n    from public.affiliate_program_settings s\n    where s.singleton = true\n      and s.enabled\n      and (s.hold_days is null or s.minimum_withdrawal is null or s.withdrawal_method is null)\n  ) as enabled_configuration_safe;`,
);
replaceExact(
  deploy,
  `  \"refund_reviews_table\",\n  \"withdrawal_method_column\",`,
  `  \"refund_reviews_table\",\n  \"fixed_tiers_table\",\n  \"fixed_overrides_table\",\n  \"fixed_snapshot_columns\",\n  \"fixed_tier_count_safe\",\n  \"withdrawal_method_column\",`,
);

const validate = "scripts/validate-affiliate-backend.mjs";
replaceExact(
  validate,
  `const readinessHardening = read(\n  \"supabase/migrations/20260904050500_affiliate_program_readiness_hardening.sql\",\n);`,
  `const readinessHardening = read(\n  \"supabase/migrations/20260904050500_affiliate_program_readiness_hardening.sql\",\n);\nconst fixed = read(\n  \"supabase/migrations/20260904051500_affiliate_fixed_commission_tiers.sql\",\n);\nconst commissionEditor = read(\"src/components/admin/AffiliateCommissionSettings.tsx\");`,
);
replaceRegex(
  validate,
  /check\(\n  "ativacao exige as cinco regras comerciais explicitas",[\s\S]*?\n\);/,
  `check(\n  \"ativacao exige seis faixas fixas e regras de saque\",\n  fixed.includes(\"affiliate_commission_tiers\") &&\n    fixed.includes(\"(1, 20.00)\") &&\n    fixed.includes(\"(5, 20.00)\") &&\n    fixed.includes(\"(8, 18.00)\") &&\n    fixed.includes(\"(15, 15.00)\") &&\n    fixed.includes(\"(25, 15.00)\") &&\n    fixed.includes(\"(35, 12.00)\") &&\n    fixed.includes(\"hold_days IS NOT NULL\") &&\n    fixed.includes(\"minimum_withdrawal IS NOT NULL\") &&\n    fixed.includes(\"withdrawal_method IS NOT NULL\"),\n);`,
);
replaceRegex(
  validate,
  /check\(\n  "comissao guarda snapshot financeiro e uma unica linha por pedido",[\s\S]*?\n\);/,
  `check(\n  \"comissao nova usa valor fixo por peca e snapshot da faixa\",\n  fixed.includes(\"commission_units\") &&\n    fixed.includes(\"commission_unit_amount\") &&\n    fixed.includes(\"commission_rule_source\") &&\n    fixed.includes(\"order_units * tier_row.amount_per_unit\") &&\n    !/commission_amount := round\\(base_amount \*/.test(fixed),\n);\n\ncheck(\n  \"comissao individual permite sobrescrever apenas uma faixa\",\n  fixed.includes(\"affiliate_commission_tier_overrides\") &&\n    fixed.includes(\"owner_save_affiliate_commission_overrides\") &&\n    commissionEditor.includes(\"Campo vazio significa\") &&\n    commissionEditor.includes(\"A partir de 35 peças\"),\n);`,
);
replaceRegex(
  validate,
  /check\(\n  "painel administrativo exibe as cinco regras e bloqueia ativacao incompleta",[\s\S]*?\n\);/,
  `check(\n  \"painel administrativo mostra todas as faixas fixas ao mesmo tempo\",\n  commissionEditor.includes(\"Comissão geral dos influenciadores\") &&\n    commissionEditor.includes(\"Valor fixo por peça\") &&\n    commissionEditor.includes(\"Padrão (1 a 4 peças)\") &&\n    commissionEditor.includes(\"A partir de 35 peças\") &&\n    commissionEditor.includes(\"Comissão individual por afiliado\") &&\n    !commissionEditor.includes(\"Comissão (%)\") &&\n    !commissionEditor.includes(\"Base de cálculo\"),\n);`,
);

console.log("Fixed affiliate commission implementation prepared.");
