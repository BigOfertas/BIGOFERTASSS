BEGIN;

-- Backend definitivo do programa de afiliados por indicação de cadastro.
-- Regra estrutural: o afiliado indica uma nova conta; os pedidos pagos dessa
-- conta indicada podem gerar comissão. Nenhuma regra comercial é inventada:
-- percentual, base de cálculo, prazo de liberação e saque mínimo são definidos
-- explicitamente pelo owner antes de o programa ser habilitado.

CREATE TABLE public.affiliate_program_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  commission_rate_bps integer,
  commission_base_mode text,
  hold_days integer,
  minimum_withdrawal numeric(12, 2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT affiliate_program_rate_valid CHECK (
    commission_rate_bps IS NULL OR commission_rate_bps BETWEEN 1 AND 10000
  ),
  CONSTRAINT affiliate_program_base_valid CHECK (
    commission_base_mode IS NULL OR commission_base_mode IN ('items_after_discount', 'order_total')
  ),
  CONSTRAINT affiliate_program_hold_valid CHECK (
    hold_days IS NULL OR hold_days BETWEEN 0 AND 365
  ),
  CONSTRAINT affiliate_program_minimum_valid CHECK (
    minimum_withdrawal IS NULL OR minimum_withdrawal BETWEEN 0.01 AND 1000000
  ),
  CONSTRAINT affiliate_program_enabled_requires_rules CHECK (
    NOT enabled OR (
      commission_rate_bps IS NOT NULL
      AND commission_base_mode IS NOT NULL
      AND hold_days IS NOT NULL
      AND minimum_withdrawal IS NOT NULL
    )
  )
);

INSERT INTO public.affiliate_program_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliates_referral_code_valid CHECK (
    referral_code ~ '^[A-Z0-9]{8,16}$'
  ),
  CONSTRAINT affiliates_status_valid CHECK (status IN ('active', 'disabled')),
  CONSTRAINT affiliates_deactivation_consistent CHECK (
    (status = 'active' AND deactivated_at IS NULL)
    OR (status = 'disabled' AND deactivated_at IS NOT NULL)
  )
);

CREATE TABLE public.affiliate_referrals (
  referred_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  referral_code_snapshot text NOT NULL,
  referred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_referrals_code_valid CHECK (
    referral_code_snapshot ~ '^[A-Z0-9]{8,16}$'
  )
);

CREATE INDEX affiliate_referrals_affiliate_created_idx
  ON public.affiliate_referrals (affiliate_id, referred_at DESC, referred_user_id);

CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_public_number text NOT NULL,
  sale_amount numeric(12, 2) NOT NULL,
  commission_base_amount numeric(12, 2) NOT NULL,
  commission_rate_bps integer NOT NULL,
  commission_amount numeric(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  available_at timestamptz NOT NULL,
  available_since timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_commissions_amounts_valid CHECK (
    sale_amount >= 0
    AND commission_base_amount >= 0
    AND commission_rate_bps BETWEEN 1 AND 10000
    AND commission_amount >= 0
  ),
  CONSTRAINT affiliate_commissions_status_valid CHECK (
    status IN ('pending', 'available', 'cancelled')
  ),
  CONSTRAINT affiliate_commissions_state_consistent CHECK (
    (status = 'pending' AND available_since IS NULL AND cancelled_at IS NULL)
    OR (status = 'available' AND available_since IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  ),
  CONSTRAINT affiliate_commissions_reason_valid CHECK (
    cancellation_reason IS NULL OR length(cancellation_reason) BETWEEN 3 AND 500
  )
);

CREATE INDEX affiliate_commissions_affiliate_status_idx
  ON public.affiliate_commissions (affiliate_id, status, available_at, created_at DESC);
CREATE INDEX affiliate_commissions_referred_idx
  ON public.affiliate_commissions (referred_user_id, created_at DESC);

CREATE TABLE public.affiliate_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL,
  destination_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'requested',
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT affiliate_withdrawals_amount_valid CHECK (amount > 0),
  CONSTRAINT affiliate_withdrawals_destination_object CHECK (
    jsonb_typeof(destination_snapshot) = 'object'
    AND length(destination_snapshot::text) <= 4000
  ),
  CONSTRAINT affiliate_withdrawals_status_valid CHECK (
    status IN ('requested', 'paid', 'rejected')
  ),
  CONSTRAINT affiliate_withdrawals_state_consistent CHECK (
    (status = 'requested' AND processed_at IS NULL AND processed_by IS NULL)
    OR (status IN ('paid', 'rejected') AND processed_at IS NOT NULL AND processed_by IS NOT NULL)
  ),
  CONSTRAINT affiliate_withdrawals_rejection_valid CHECK (
    (status <> 'rejected' AND rejection_reason IS NULL)
    OR (status = 'rejected' AND length(rejection_reason) BETWEEN 3 AND 500)
  )
);

CREATE INDEX affiliate_withdrawals_affiliate_status_idx
  ON public.affiliate_withdrawals (affiliate_id, status, requested_at DESC);

CREATE OR REPLACE FUNCTION public.touch_affiliate_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_affiliates_updated_at
BEFORE UPDATE ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.touch_affiliate_updated_at();

CREATE OR REPLACE FUNCTION public.generate_affiliate_referral_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate text;
  attempts integer := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.affiliates AS a WHERE a.referral_code = candidate
    );
    IF attempts >= 20 THEN
      RAISE EXCEPTION 'Nao foi possivel gerar codigo de afiliado';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_affiliate_referral_code(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affiliates AS a
    JOIN public.affiliate_program_settings AS s ON s.singleton = true
    WHERE s.enabled
      AND a.status = 'active'
      AND a.referral_code = upper(btrim(COALESCE(p_code, '')))
  );
$$;

-- Preserva a identidade atual do cadastro e adiciona a indicação somente no
-- momento em que a nova conta nasce. A relação é imutável depois disso.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_phone text := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g'), '');
  normalized_cpf text := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g'), '');
  referral_code text := upper(btrim(COALESCE(NEW.raw_user_meta_data ->> 'affiliate_referral_code', '')));
  matched_affiliate_id uuid;
BEGIN
  IF normalized_phone IS NOT NULL AND NOT public.is_valid_brazilian_phone(normalized_phone) THEN
    normalized_phone := NULL;
  END IF;
  IF normalized_cpf IS NOT NULL AND NOT public.is_valid_brazilian_cpf(normalized_cpf) THEN
    normalized_cpf := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, cpf)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    normalized_phone,
    normalized_cpf
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer'::public.app_role);

  IF referral_code <> '' THEN
    SELECT a.id
    INTO matched_affiliate_id
    FROM public.affiliates AS a
    JOIN public.affiliate_program_settings AS s ON s.singleton = true
    WHERE s.enabled
      AND a.status = 'active'
      AND a.referral_code = referral_code
      AND a.user_id <> NEW.id
    LIMIT 1;

    IF matched_affiliate_id IS NOT NULL THEN
      INSERT INTO public.affiliate_referrals (
        referred_user_id,
        affiliate_id,
        referral_code_snapshot
      )
      VALUES (NEW.id, matched_affiliate_id, referral_code)
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_configure_affiliate_program(
  p_enabled boolean,
  p_commission_rate_bps integer,
  p_commission_base_mode text,
  p_hold_days integer,
  p_minimum_withdrawal numeric
)
RETURNS public.affiliate_program_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result_row public.affiliate_program_settings%ROWTYPE;
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
  IF p_minimum_withdrawal IS NULL OR p_minimum_withdrawal < 0.01 THEN
    RAISE EXCEPTION 'Saque minimo invalido';
  END IF;

  UPDATE public.affiliate_program_settings
  SET
    enabled = p_enabled,
    commission_rate_bps = p_commission_rate_bps,
    commission_base_mode = p_commission_base_mode,
    hold_days = p_hold_days,
    minimum_withdrawal = p_minimum_withdrawal,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE singleton = true
  RETURNING * INTO result_row;

  RETURN result_row;
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
        'commission_rate', settings_row.commission_rate_bps / 100.0
      ),
      'affiliate.created:' || affiliate_row.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN affiliate_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_disable_affiliate(p_user_id uuid)
RETURNS public.affiliates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result_row public.affiliates%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  UPDATE public.affiliates
  SET status = 'disabled', deactivated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO result_row;

  IF result_row.id IS NULL THEN
    RAISE EXCEPTION 'Afiliado nao encontrado';
  END IF;
  RETURN result_row;
END;
$$;

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
  base_amount numeric(12, 2);
  commission_amount numeric(12, 2);
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

  base_amount := CASE settings_row.commission_base_mode
    WHEN 'items_after_discount' THEN order_row.subtotal_amount - order_row.discount_amount
    WHEN 'order_total' THEN order_row.total_amount
    ELSE NULL
  END;
  IF base_amount IS NULL OR base_amount <= 0 THEN RETURN NULL; END IF;

  commission_amount := round(base_amount * settings_row.commission_rate_bps / 10000.0, 2);
  IF commission_amount <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.affiliate_commissions (
    affiliate_id,
    referred_user_id,
    order_id,
    order_public_number,
    sale_amount,
    commission_base_amount,
    commission_rate_bps,
    commission_amount,
    available_at
  )
  VALUES (
    affiliate_row.id,
    order_row.user_id,
    order_row.id,
    order_row.public_number,
    order_row.total_amount,
    base_amount,
    settings_row.commission_rate_bps,
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
      'commission_rate', commission_row.commission_rate_bps / 100.0
    ),
    'affiliate.commission.created:' || commission_row.id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN commission_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_affiliate_commission_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_status = 'paid'::public.order_payment_status
     AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    BEGIN
      PERFORM public.create_affiliate_commission_for_paid_order(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'affiliate commission capture failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER capture_affiliate_commission_after_payment
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.capture_affiliate_commission_after_payment();

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
      cancellation_reason = 'Pedido reembolsado antes da liberação da comissão'
    WHERE order_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cancel_pending_affiliate_commission_after_refund
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.cancel_pending_affiliate_commission_after_refund();

CREATE OR REPLACE FUNCTION public.release_due_affiliate_commissions(p_affiliate_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  commission_row public.affiliate_commissions%ROWTYPE;
  affiliate_user_id uuid;
  released_count integer := 0;
  available_total numeric(12, 2);
  reserved_total numeric(12, 2);
BEGIN
  FOR commission_row IN
    UPDATE public.affiliate_commissions AS c
    SET status = 'available', available_since = now()
    WHERE c.status = 'pending'
      AND c.available_at <= now()
      AND (p_affiliate_id IS NULL OR c.affiliate_id = p_affiliate_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.orders AS o
        WHERE o.id = c.order_id AND o.status = 'refunded'::public.order_status
      )
    RETURNING c.*
  LOOP
    released_count := released_count + 1;
    SELECT a.user_id INTO affiliate_user_id
    FROM public.affiliates AS a WHERE a.id = commission_row.affiliate_id;

    SELECT COALESCE(sum(c.commission_amount), 0)
    INTO available_total
    FROM public.affiliate_commissions AS c
    WHERE c.affiliate_id = commission_row.affiliate_id AND c.status = 'available';

    SELECT COALESCE(sum(w.amount), 0)
    INTO reserved_total
    FROM public.affiliate_withdrawals AS w
    WHERE w.affiliate_id = commission_row.affiliate_id AND w.status IN ('requested', 'paid');

    INSERT INTO public.notification_events (
      user_id, order_id, event_name, payload, idempotency_key
    )
    VALUES (
      affiliate_user_id,
      commission_row.order_id,
      'affiliate.commission.available',
      jsonb_build_object('available_amount', greatest(available_total - reserved_total, 0)),
      'affiliate.commission.available:' || commission_row.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;
  RETURN released_count;
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
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;
  SELECT * INTO settings_row FROM public.affiliate_program_settings WHERE singleton = true;
  SELECT * INTO affiliate_row FROM public.affiliates WHERE user_id = current_user_id;

  IF affiliate_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'isAffiliate', false,
      'programEnabled', settings_row.enabled
    );
  END IF;

  PERFORM public.release_due_affiliate_commissions(affiliate_row.id);

  SELECT count(*) INTO referral_count
  FROM public.affiliate_referrals WHERE affiliate_id = affiliate_row.id;
  SELECT COALESCE(sum(commission_amount),0) INTO pending_amount
  FROM public.affiliate_commissions WHERE affiliate_id = affiliate_row.id AND status = 'pending';
  SELECT COALESCE(sum(commission_amount),0) INTO available_total
  FROM public.affiliate_commissions WHERE affiliate_id = affiliate_row.id AND status = 'available';
  SELECT COALESCE(sum(amount),0) INTO requested_total
  FROM public.affiliate_withdrawals WHERE affiliate_id = affiliate_row.id AND status = 'requested';
  SELECT COALESCE(sum(amount),0) INTO paid_total
  FROM public.affiliate_withdrawals WHERE affiliate_id = affiliate_row.id AND status = 'paid';

  RETURN jsonb_build_object(
    'isAffiliate', true,
    'status', affiliate_row.status,
    'referralCode', affiliate_row.referral_code,
    'programEnabled', settings_row.enabled,
    'commissionRateBps', settings_row.commission_rate_bps,
    'commissionBaseMode', settings_row.commission_base_mode,
    'holdDays', settings_row.hold_days,
    'minimumWithdrawal', settings_row.minimum_withdrawal,
    'referralsCount', referral_count,
    'pendingAmount', pending_amount,
    'availableAmount', greatest(available_total - requested_total - paid_total, 0),
    'requestedWithdrawalAmount', requested_total,
    'paidWithdrawalAmount', paid_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_affiliate_referrals(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  referred_at timestamptz,
  display_name text,
  masked_email text,
  commissions_count bigint,
  generated_commission_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.referred_at,
    COALESCE(split_part(NULLIF(btrim(p.full_name), ''), ' ', 1), 'Cliente') AS display_name,
    CASE
      WHEN position('@' in COALESCE(p.email,'')) > 1 THEN
        left(split_part(p.email, '@', 1), 2) || '***@' || split_part(p.email, '@', 2)
      ELSE '***'
    END AS masked_email,
    count(c.id) AS commissions_count,
    COALESCE(sum(c.commission_amount) FILTER (WHERE c.status <> 'cancelled'), 0) AS generated_commission_amount
  FROM public.affiliate_referrals AS r
  JOIN public.affiliates AS a ON a.id = r.affiliate_id AND a.user_id = auth.uid()
  LEFT JOIN public.profiles AS p ON p.id = r.referred_user_id
  LEFT JOIN public.affiliate_commissions AS c ON c.referred_user_id = r.referred_user_id AND c.affiliate_id = r.affiliate_id
  GROUP BY r.referred_user_id, r.referred_at, p.full_name, p.email
  ORDER BY r.referred_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.list_my_affiliate_commissions(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.affiliate_commissions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.*
  FROM public.affiliate_commissions AS c
  JOIN public.affiliates AS a ON a.id = c.affiliate_id
  WHERE a.user_id = auth.uid()
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.list_my_affiliate_withdrawals(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.affiliate_withdrawals
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT w.*
  FROM public.affiliate_withdrawals AS w
  JOIN public.affiliates AS a ON a.id = w.affiliate_id
  WHERE a.user_id = auth.uid()
  ORDER BY w.requested_at DESC, w.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
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
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;
  SELECT * INTO affiliate_row FROM public.affiliates WHERE user_id = current_user_id FOR UPDATE;
  IF affiliate_row.id IS NULL THEN RAISE EXCEPTION 'Conta de afiliado nao encontrada'; END IF;
  SELECT * INTO settings_row FROM public.affiliate_program_settings WHERE singleton = true;
  IF settings_row.minimum_withdrawal IS NULL THEN RAISE EXCEPTION 'Regra de saque ainda nao configurada'; END IF;
  IF p_amount IS NULL OR p_amount < settings_row.minimum_withdrawal THEN
    RAISE EXCEPTION 'Valor abaixo do saque minimo';
  END IF;
  IF p_destination_snapshot IS NULL OR jsonb_typeof(p_destination_snapshot) <> 'object' OR length(p_destination_snapshot::text) > 4000 THEN
    RAISE EXCEPTION 'Destino de saque invalido';
  END IF;

  PERFORM public.release_due_affiliate_commissions(affiliate_row.id);
  SELECT COALESCE(sum(commission_amount),0) INTO available_total
  FROM public.affiliate_commissions WHERE affiliate_id = affiliate_row.id AND status = 'available';
  SELECT COALESCE(sum(amount),0) INTO reserved_total
  FROM public.affiliate_withdrawals WHERE affiliate_id = affiliate_row.id AND status IN ('requested','paid');

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
    jsonb_build_object('withdrawal_amount', withdrawal_row.amount),
    'affiliate.withdrawal.requested:' || withdrawal_row.id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN withdrawal_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_mark_affiliate_withdrawal_paid(p_withdrawal_id uuid)
RETURNS public.affiliate_withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  withdrawal_row public.affiliate_withdrawals%ROWTYPE;
  affiliate_user_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  UPDATE public.affiliate_withdrawals
  SET status = 'paid', processed_at = now(), processed_by = auth.uid()
  WHERE id = p_withdrawal_id AND status = 'requested'
  RETURNING * INTO withdrawal_row;
  IF withdrawal_row.id IS NULL THEN RAISE EXCEPTION 'Saque pendente nao encontrado'; END IF;
  SELECT user_id INTO affiliate_user_id FROM public.affiliates WHERE id = withdrawal_row.affiliate_id;
  INSERT INTO public.notification_events (user_id, order_id, event_name, payload, idempotency_key)
  VALUES (
    affiliate_user_id, NULL, 'affiliate.withdrawal.paid',
    jsonb_build_object('withdrawal_amount', withdrawal_row.amount, 'paid_date', to_char(current_date, 'DD/MM/YYYY')),
    'affiliate.withdrawal.paid:' || withdrawal_row.id::text
  ) ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN withdrawal_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_reject_affiliate_withdrawal(
  p_withdrawal_id uuid,
  p_reason text
)
RETURNS public.affiliate_withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  withdrawal_row public.affiliate_withdrawals%ROWTYPE;
  affiliate_user_id uuid;
  normalized_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF length(normalized_reason) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Motivo invalido'; END IF;
  UPDATE public.affiliate_withdrawals
  SET status = 'rejected', rejection_reason = normalized_reason, processed_at = now(), processed_by = auth.uid()
  WHERE id = p_withdrawal_id AND status = 'requested'
  RETURNING * INTO withdrawal_row;
  IF withdrawal_row.id IS NULL THEN RAISE EXCEPTION 'Saque pendente nao encontrado'; END IF;
  SELECT user_id INTO affiliate_user_id FROM public.affiliates WHERE id = withdrawal_row.affiliate_id;
  INSERT INTO public.notification_events (user_id, order_id, event_name, payload, idempotency_key)
  VALUES (
    affiliate_user_id, NULL, 'affiliate.withdrawal.rejected',
    jsonb_build_object('withdrawal_amount', withdrawal_row.amount, 'rejection_reason', normalized_reason),
    'affiliate.withdrawal.rejected:' || withdrawal_row.id::text
  ) ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN withdrawal_row;
END;
$$;

ALTER TABLE public.affiliate_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY affiliate_settings_owner_select ON public.affiliate_program_settings
FOR SELECT TO authenticated USING (public.has_role('owner'::public.app_role));
CREATE POLICY affiliates_select_own ON public.affiliates
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY affiliates_select_owner ON public.affiliates
FOR SELECT TO authenticated USING (public.has_role('owner'::public.app_role));
CREATE POLICY affiliate_referrals_select_own ON public.affiliate_referrals
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.affiliates AS a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
);
CREATE POLICY affiliate_referrals_select_owner ON public.affiliate_referrals
FOR SELECT TO authenticated USING (public.has_role('owner'::public.app_role));
CREATE POLICY affiliate_commissions_select_own ON public.affiliate_commissions
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.affiliates AS a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
);
CREATE POLICY affiliate_commissions_select_owner ON public.affiliate_commissions
FOR SELECT TO authenticated USING (public.has_role('owner'::public.app_role));
CREATE POLICY affiliate_withdrawals_select_own ON public.affiliate_withdrawals
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.affiliates AS a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
);
CREATE POLICY affiliate_withdrawals_select_owner ON public.affiliate_withdrawals
FOR SELECT TO authenticated USING (public.has_role('owner'::public.app_role));

REVOKE ALL ON TABLE public.affiliate_program_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.affiliates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_referrals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_commissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_withdrawals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.affiliate_program_settings TO authenticated;
GRANT SELECT ON TABLE public.affiliates TO authenticated;
GRANT SELECT ON TABLE public.affiliate_referrals TO authenticated;
GRANT SELECT ON TABLE public.affiliate_commissions TO authenticated;
GRANT SELECT ON TABLE public.affiliate_withdrawals TO authenticated;

REVOKE ALL ON FUNCTION public.generate_affiliate_referral_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_affiliate_referral_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_activate_affiliate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_disable_affiliate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_affiliate_commission_for_paid_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_due_affiliate_commissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_affiliate_dashboard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_affiliate_referrals(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_affiliate_commissions(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_affiliate_withdrawals(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_my_affiliate_withdrawal(numeric, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_mark_affiliate_withdrawal_paid(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_reject_affiliate_withdrawal(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.resolve_affiliate_referral_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_activate_affiliate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_disable_affiliate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_affiliate_commission_for_paid_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_due_affiliate_commissions(uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_affiliate_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_affiliate_referrals(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_affiliate_commissions(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_affiliate_withdrawals(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_my_affiliate_withdrawal(numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_mark_affiliate_withdrawal_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reject_affiliate_withdrawal(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.capture_affiliate_commission_after_payment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_pending_affiliate_commission_after_refund() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_affiliate_updated_at() FROM PUBLIC;

COMMENT ON TABLE public.affiliate_referrals IS
  'Vinculo imutavel entre uma nova conta e o afiliado cujo link foi usado no cadastro.';
COMMENT ON TABLE public.affiliate_commissions IS
  'Comissoes por pedidos pagos das contas indicadas, com regras financeiras em snapshot.';
COMMENT ON FUNCTION public.resolve_affiliate_referral_code(text) IS
  'Valida um codigo de indicacao sem expor dados do afiliado.';
COMMENT ON FUNCTION public.get_my_affiliate_dashboard() IS
  'Resumo financeiro e operacional da area de afiliados da conta autenticada.';

COMMIT;
