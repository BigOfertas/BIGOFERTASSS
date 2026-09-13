BEGIN;

-- Painel financeiro DropBox.
-- Mantém os pedidos históricos intactos: snapshots financeiros são preenchidos
-- somente em novos itens inseridos após esta migration.

CREATE TABLE IF NOT EXISTS public.finance_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  personalization_cost numeric(12,2) NOT NULL DEFAULT 15.00 CHECK (personalization_cost >= 0),
  phrase_cost numeric(12,2) NOT NULL DEFAULT 30.00 CHECK (phrase_cost >= 0),
  patch_cost numeric(12,2) NOT NULL DEFAULT 5.00 CHECK (patch_cost >= 0),
  profit_share_basis_points integer NOT NULL DEFAULT 500 CHECK (profit_share_basis_points BETWEEN 0 AND 10000),
  activated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.finance_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.finance_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.finance_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.product_financial_settings (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  unit_cost numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  financial_category text NOT NULL DEFAULT 'outro',
  is_manual boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.product_financial_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_financial_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.product_financial_settings TO service_role;

CREATE OR REPLACE FUNCTION public.finance_default_product_cost(
  p_base_price numeric,
  p_commercial_type text DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_commercial_type IN ('torcedor', 'feminino') THEN 75.00::numeric
    WHEN p_commercial_type IN ('jogador', 'retro') THEN 95.00::numeric
    WHEN p_commercial_type = 'infantil' THEN 90.00::numeric
    WHEN p_commercial_type = 'calcao' THEN 75.00::numeric
    WHEN p_commercial_type = 'basquete' THEN 120.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 184.90 THEN 75.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 219.90 THEN 95.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 169.90 THEN 90.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 159.90 THEN 75.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 229.90 THEN 120.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 259.90 THEN 110.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 339.90 THEN 215.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 389.90 THEN 240.00::numeric
    WHEN round(COALESCE(p_base_price, -1), 2) = 379.90 THEN 230.00::numeric
    ELSE NULL::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION public.finance_default_category(
  p_base_price numeric,
  p_commercial_type text DEFAULT NULL,
  p_product_name text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_commercial_type = 'torcedor' THEN 'torcedor'
    WHEN p_commercial_type = 'feminino' THEN 'feminina'
    WHEN p_commercial_type = 'jogador' THEN 'jogador'
    WHEN p_commercial_type = 'retro' THEN 'retro'
    WHEN p_commercial_type = 'infantil' THEN 'kit_infantil'
    WHEN p_commercial_type = 'calcao' THEN 'short_calcao'
    WHEN p_commercial_type = 'basquete' THEN 'basquete_nba'
    WHEN round(COALESCE(p_base_price, -1), 2) = 259.90 AND lower(COALESCE(p_product_name, '')) LIKE '%regata%' THEN 'regata_calcao'
    WHEN round(COALESCE(p_base_price, -1), 2) = 259.90 THEN 'camisa_calcao'
    WHEN round(COALESCE(p_base_price, -1), 2) = 339.90 THEN 'treino_calca'
    WHEN round(COALESCE(p_base_price, -1), 2) = 389.90 THEN 'casaco_calca'
    WHEN round(COALESCE(p_base_price, -1), 2) = 379.90 THEN 'corta_vento'
    ELSE 'outro'
  END;
$$;

REVOKE ALL ON FUNCTION public.finance_default_product_cost(numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_default_category(numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_default_product_cost(numeric,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_default_category(numeric,text,text) TO authenticated, service_role;

-- Registra os custos iniciais conhecidos para o catálogo atual, sem tocar em pedidos antigos.
INSERT INTO public.product_financial_settings (
  product_id,
  unit_cost,
  financial_category,
  is_manual,
  updated_at,
  updated_by
)
SELECT
  p.id,
  defaults.unit_cost,
  public.finance_default_category(defaults.sale_price, COALESCE(pps.commercial_type, 'other'), p.name),
  false,
  now(),
  NULL
FROM public.products p
LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
CROSS JOIN public.store_purchase_settings store
CROSS JOIN LATERAL (
  SELECT
    CASE
      WHEN COALESCE(pps.commercial_type, 'other') IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete')
        AND store.product_type_prices ? COALESCE(pps.commercial_type, 'other')
      THEN (store.product_type_prices ->> COALESCE(pps.commercial_type, 'other'))::numeric
      ELSE COALESCE(p.promotional_price, p.price)
    END AS sale_price
) price
CROSS JOIN LATERAL (
  SELECT
    price.sale_price,
    public.finance_default_product_cost(price.sale_price, COALESCE(pps.commercial_type, 'other')) AS unit_cost
) defaults
WHERE store.singleton = true
  AND p.status <> 'archived'::public.product_status
  AND defaults.unit_cost IS NOT NULL
ON CONFLICT (product_id) DO NOTHING;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS base_unit_price_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS unit_product_cost_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS add_on_revenue_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS add_on_cost_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS unit_total_cost_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS line_cost_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS line_discount_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS line_revenue_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS line_profit_snapshot numeric(12,2),
  ADD COLUMN IF NOT EXISTS financial_category_snapshot text,
  ADD COLUMN IF NOT EXISTS financial_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS financial_snapshot_version smallint;

CREATE OR REPLACE FUNCTION public.capture_order_item_financial_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  finance public.finance_settings%ROWTYPE;
  product_setting public.product_financial_settings%ROWTYPE;
  product_name_value text;
  commercial_type_value text := 'other';
  option_row jsonb;
  option_id text;
  option_revenue numeric(12,2);
  add_on_revenue numeric(12,2) := 0;
  add_on_cost numeric(12,2) := 0;
  base_price numeric(12,2);
  product_cost numeric(12,2);
  category_value text;
  order_subtotal numeric(12,2) := 0;
  order_discount numeric(12,2) := 0;
  line_discount numeric(12,2) := 0;
BEGIN
  SELECT * INTO finance
  FROM public.finance_settings
  WHERE singleton = true;

  SELECT p.name, COALESCE(pps.commercial_type, 'other')
  INTO product_name_value, commercial_type_value
  FROM public.products p
  LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
  WHERE p.id = NEW.product_id;

  FOR option_row IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(NEW.selected_options, '[]'::jsonb)) item(value)
  LOOP
    option_id := COALESCE(option_row ->> 'option_id', '');
    BEGIN
      option_revenue := GREATEST(COALESCE((option_row ->> 'price_addition')::numeric, 0), 0);
    EXCEPTION WHEN invalid_text_representation THEN
      option_revenue := 0;
    END;

    add_on_revenue := add_on_revenue + option_revenue;

    IF option_id = 'purchase-personalization-name' THEN
      add_on_cost := add_on_cost + COALESCE(finance.personalization_cost, 15.00);
    ELSIF option_id = 'purchase-phrase' THEN
      add_on_cost := add_on_cost + COALESCE(finance.phrase_cost, 30.00);
    ELSIF option_id LIKE 'purchase-patch-%' THEN
      add_on_cost := add_on_cost + COALESCE(finance.patch_cost, 5.00);
    END IF;
  END LOOP;

  base_price := GREATEST(round(COALESCE(NEW.unit_price, 0) - add_on_revenue, 2), 0);

  SELECT * INTO product_setting
  FROM public.product_financial_settings
  WHERE product_id = NEW.product_id;

  IF FOUND AND product_setting.is_manual THEN
    product_cost := product_setting.unit_cost;
    category_value := product_setting.financial_category;
  ELSE
    product_cost := public.finance_default_product_cost(base_price, commercial_type_value);
    IF product_cost IS NULL AND product_setting.product_id IS NOT NULL THEN
      product_cost := product_setting.unit_cost;
    END IF;
    category_value := COALESCE(
      NULLIF(product_setting.financial_category, ''),
      public.finance_default_category(base_price, commercial_type_value, product_name_value),
      'outro'
    );
  END IF;

  SELECT COALESCE(o.subtotal_amount, 0), COALESCE(o.discount_amount, 0)
  INTO order_subtotal, order_discount
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  IF order_subtotal > 0 AND order_discount > 0 THEN
    line_discount := round(order_discount * COALESCE(NEW.line_total, 0) / order_subtotal, 2);
  END IF;

  NEW.base_unit_price_snapshot := base_price;
  NEW.unit_product_cost_snapshot := product_cost;
  NEW.add_on_revenue_snapshot := round(add_on_revenue, 2);
  NEW.add_on_cost_snapshot := round(add_on_cost, 2);
  NEW.financial_category_snapshot := category_value;
  NEW.line_discount_snapshot := line_discount;
  NEW.line_revenue_snapshot := round(COALESCE(NEW.line_total, 0) - line_discount, 2);
  NEW.financial_snapshot_version := 1;

  IF product_cost IS NOT NULL THEN
    NEW.unit_total_cost_snapshot := round(product_cost + add_on_cost, 2);
    NEW.line_cost_snapshot := round((product_cost + add_on_cost) * GREATEST(COALESCE(NEW.quantity, 1), 1), 2);
    NEW.line_profit_snapshot := round(NEW.line_revenue_snapshot - NEW.line_cost_snapshot, 2);
  ELSE
    NEW.unit_total_cost_snapshot := NULL;
    NEW.line_cost_snapshot := NULL;
    NEW.line_profit_snapshot := NULL;
  END IF;

  NEW.financial_breakdown := jsonb_build_object(
    'version', 1,
    'baseUnitPrice', NEW.base_unit_price_snapshot,
    'productUnitCost', NEW.unit_product_cost_snapshot,
    'addOnUnitRevenue', NEW.add_on_revenue_snapshot,
    'addOnUnitCost', NEW.add_on_cost_snapshot,
    'quantity', NEW.quantity,
    'lineGrossRevenue', NEW.line_total,
    'lineDiscount', NEW.line_discount_snapshot,
    'lineNetRevenue', NEW.line_revenue_snapshot,
    'lineCost', NEW.line_cost_snapshot,
    'lineProfit', NEW.line_profit_snapshot,
    'category', NEW.financial_category_snapshot,
    'costConfigured', product_cost IS NOT NULL,
    'capturedAt', now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_order_item_financial_snapshot ON public.order_items;
CREATE TRIGGER capture_order_item_financial_snapshot
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.capture_order_item_financial_snapshot();

CREATE OR REPLACE FUNCTION public.protect_order_item_financial_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(
    NEW.base_unit_price_snapshot,
    NEW.unit_product_cost_snapshot,
    NEW.add_on_revenue_snapshot,
    NEW.add_on_cost_snapshot,
    NEW.unit_total_cost_snapshot,
    NEW.line_cost_snapshot,
    NEW.line_discount_snapshot,
    NEW.line_revenue_snapshot,
    NEW.line_profit_snapshot,
    NEW.financial_category_snapshot,
    NEW.financial_breakdown,
    NEW.financial_snapshot_version
  ) IS DISTINCT FROM ROW(
    OLD.base_unit_price_snapshot,
    OLD.unit_product_cost_snapshot,
    OLD.add_on_revenue_snapshot,
    OLD.add_on_cost_snapshot,
    OLD.unit_total_cost_snapshot,
    OLD.line_cost_snapshot,
    OLD.line_discount_snapshot,
    OLD.line_revenue_snapshot,
    OLD.line_profit_snapshot,
    OLD.financial_category_snapshot,
    OLD.financial_breakdown,
    OLD.financial_snapshot_version
  ) THEN
    RAISE EXCEPTION 'Snapshot financeiro do item é imutável';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_order_item_financial_snapshot ON public.order_items;
CREATE TRIGGER protect_order_item_financial_snapshot
BEFORE UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.protect_order_item_financial_snapshot();

REVOKE ALL ON FUNCTION public.capture_order_item_financial_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_order_item_financial_snapshot() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.owner_get_finance_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  finance public.finance_settings%ROWTYPE;
  purchase public.store_purchase_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT * INTO finance FROM public.finance_settings WHERE singleton = true;
  SELECT * INTO purchase FROM public.store_purchase_settings WHERE singleton = true;

  RETURN jsonb_build_object(
    'personalizationPrice', purchase.personalization_price,
    'personalizationCost', finance.personalization_cost,
    'phrasePrice', purchase.phrase_price,
    'phraseCost', finance.phrase_cost,
    'patchPrice', purchase.patch_default_price,
    'patchCost', finance.patch_cost,
    'profitSharePercent', round(finance.profit_share_basis_points::numeric / 100, 2),
    'activatedAt', finance.activated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_get_finance_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_get_finance_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_save_finance_settings(
  p_personalization_price numeric,
  p_personalization_cost numeric,
  p_phrase_price numeric,
  p_phrase_cost numeric,
  p_patch_price numeric,
  p_patch_cost numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF p_personalization_price IS NULL OR p_personalization_price < 0
    OR p_personalization_cost IS NULL OR p_personalization_cost < 0
    OR p_phrase_price IS NULL OR p_phrase_price < 0
    OR p_phrase_cost IS NULL OR p_phrase_cost < 0
    OR p_patch_price IS NULL OR p_patch_price < 0
    OR p_patch_cost IS NULL OR p_patch_cost < 0 THEN
    RAISE EXCEPTION 'Preços e custos devem ser valores não negativos';
  END IF;

  UPDATE public.store_purchase_settings
  SET personalization_price = round(p_personalization_price, 2),
      phrase_price = round(p_phrase_price, 2),
      patch_default_price = round(p_patch_price, 2),
      updated_at = now()
  WHERE singleton = true;

  UPDATE public.finance_settings
  SET personalization_cost = round(p_personalization_cost, 2),
      phrase_cost = round(p_phrase_cost, 2),
      patch_cost = round(p_patch_cost, 2),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE singleton = true;

  RETURN public.owner_get_finance_settings();
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_finance_settings(numeric,numeric,numeric,numeric,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_finance_settings(numeric,numeric,numeric,numeric,numeric,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_finance_products_page(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  query_text text := NULLIF(public.catalog_normalize_text(p_query), '');
  page_number integer := GREATEST(COALESCE(p_page, 1), 1);
  page_size_value integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 10), 100);
  total_value bigint;
  items_value jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT count(*) INTO total_value
  FROM public.products p
  WHERE p.status <> 'archived'::public.product_status
    AND (query_text IS NULL OR p.catalog_search_text LIKE '%' || query_text || '%');

  SELECT COALESCE(jsonb_agg(item ORDER BY item ->> 'name'), '[]'::jsonb)
  INTO items_value
  FROM (
    SELECT jsonb_build_object(
      'productId', p.id,
      'name', p.name,
      'sku', p.sku,
      'commercialType', COALESCE(pps.commercial_type, 'other'),
      'salePrice', price.sale_price,
      'unitCost', COALESCE(
        CASE WHEN pfs.is_manual THEN pfs.unit_cost END,
        public.finance_default_product_cost(price.sale_price, COALESCE(pps.commercial_type, 'other')),
        pfs.unit_cost
      ),
      'costConfigured', COALESCE(
        CASE WHEN pfs.is_manual THEN pfs.unit_cost END,
        public.finance_default_product_cost(price.sale_price, COALESCE(pps.commercial_type, 'other')),
        pfs.unit_cost
      ) IS NOT NULL,
      'isManualCost', COALESCE(pfs.is_manual, false),
      'financialCategory', COALESCE(
        NULLIF(pfs.financial_category, ''),
        public.finance_default_category(price.sale_price, COALESCE(pps.commercial_type, 'other'), p.name),
        'outro'
      )
    ) AS item
    FROM (
      SELECT p.*
      FROM public.products p
      WHERE p.status <> 'archived'::public.product_status
        AND (query_text IS NULL OR p.catalog_search_text LIKE '%' || query_text || '%')
      ORDER BY p.name, p.id
      OFFSET (page_number - 1) * page_size_value
      LIMIT page_size_value
    ) p
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    LEFT JOIN public.product_financial_settings pfs ON pfs.product_id = p.id
    CROSS JOIN public.store_purchase_settings store
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN COALESCE(pps.commercial_type, 'other') IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete')
          AND store.product_type_prices ? COALESCE(pps.commercial_type, 'other')
        THEN (store.product_type_prices ->> COALESCE(pps.commercial_type, 'other'))::numeric
        ELSE COALESCE(p.promotional_price, p.price)
      END AS sale_price
    ) price
    WHERE store.singleton = true
  ) rows;

  RETURN jsonb_build_object(
    'items', items_value,
    'total', total_value,
    'page', page_number,
    'pageSize', page_size_value,
    'totalPages', CASE WHEN total_value = 0 THEN 0 ELSE ceil(total_value::numeric / page_size_value)::integer END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_finance_products_page(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_finance_products_page(text,integer,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_save_product_finance(
  p_product_id uuid,
  p_unit_cost numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  product_name_value text;
  commercial_type_value text := 'other';
  sale_price_value numeric(12,2);
  category_value text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Custo inválido';
  END IF;

  SELECT
    p.name,
    COALESCE(pps.commercial_type, 'other'),
    CASE
      WHEN COALESCE(pps.commercial_type, 'other') IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete')
        AND store.product_type_prices ? COALESCE(pps.commercial_type, 'other')
      THEN (store.product_type_prices ->> COALESCE(pps.commercial_type, 'other'))::numeric
      ELSE COALESCE(p.promotional_price, p.price)
    END
  INTO product_name_value, commercial_type_value, sale_price_value
  FROM public.products p
  LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
  CROSS JOIN public.store_purchase_settings store
  WHERE p.id = p_product_id
    AND p.status <> 'archived'::public.product_status
    AND store.singleton = true;

  IF product_name_value IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  category_value := public.finance_default_category(sale_price_value, commercial_type_value, product_name_value);

  INSERT INTO public.product_financial_settings (
    product_id, unit_cost, financial_category, is_manual, updated_at, updated_by
  ) VALUES (
    p_product_id, round(p_unit_cost, 2), category_value, true, now(), auth.uid()
  )
  ON CONFLICT (product_id) DO UPDATE
  SET unit_cost = EXCLUDED.unit_cost,
      financial_category = EXCLUDED.financial_category,
      is_manual = true,
      updated_at = now(),
      updated_by = auth.uid();

  RETURN jsonb_build_object(
    'productId', p_product_id,
    'unitCost', round(p_unit_cost, 2),
    'salePrice', sale_price_value,
    'financialCategory', category_value,
    'isManualCost', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_product_finance(uuid,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_product_finance(uuid,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_get_financial_dashboard(
  p_period text DEFAULT '30d',
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  period_key text := COALESCE(NULLIF(lower(btrim(p_period)), ''), '30d');
  local_now timestamp := now() AT TIME ZONE 'America/Fortaleza';
  start_at timestamptz;
  end_at timestamptz := now() + interval '1 second';
  summary_value jsonb;
  trend_value jsonb;
  products_value jsonb;
  categories_value jsonb;
  excluded_value bigint := 0;
  cutoff timestamptz := '2026-09-10T14:35:38Z'::timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  CASE period_key
    WHEN 'today' THEN
      start_at := date_trunc('day', local_now) AT TIME ZONE 'America/Fortaleza';
    WHEN '7d' THEN
      start_at := (date_trunc('day', local_now) - interval '6 days') AT TIME ZONE 'America/Fortaleza';
    WHEN '30d' THEN
      start_at := (date_trunc('day', local_now) - interval '29 days') AT TIME ZONE 'America/Fortaleza';
    WHEN 'month' THEN
      start_at := date_trunc('month', local_now) AT TIME ZONE 'America/Fortaleza';
    WHEN 'previous_month' THEN
      start_at := (date_trunc('month', local_now) - interval '1 month') AT TIME ZONE 'America/Fortaleza';
      end_at := date_trunc('month', local_now) AT TIME ZONE 'America/Fortaleza';
    WHEN 'year' THEN
      start_at := date_trunc('year', local_now) AT TIME ZONE 'America/Fortaleza';
    WHEN 'custom' THEN
      IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
        RAISE EXCEPTION 'Intervalo personalizado inválido';
      END IF;
      start_at := p_from;
      end_at := p_to;
    ELSE
      RAISE EXCEPTION 'Período financeiro inválido';
  END CASE;

  WITH eligible_orders AS (
    SELECT o.*, COALESCE(o.paid_at, o.created_at) AS financial_at
    FROM public.orders o
    WHERE o.created_at >= cutoff
      AND o.payment_status = 'paid'::public.payment_status
      AND o.status NOT IN ('canceled'::public.order_status, 'refunded'::public.order_status)
      AND COALESCE(o.paid_at, o.created_at) >= start_at
      AND COALESCE(o.paid_at, o.created_at) < end_at
  ), tracked_orders AS (
    SELECT o.*
    FROM eligible_orders o
    WHERE EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = o.id
          AND (oi.financial_snapshot_version IS NULL OR oi.line_cost_snapshot IS NULL)
      )
  )
  SELECT count(*) INTO excluded_value
  FROM eligible_orders e
  WHERE NOT EXISTS (SELECT 1 FROM tracked_orders t WHERE t.id = e.id);

  WITH eligible_orders AS (
    SELECT o.*, COALESCE(o.paid_at, o.created_at) AS financial_at
    FROM public.orders o
    WHERE o.created_at >= cutoff
      AND o.payment_status = 'paid'::public.payment_status
      AND o.status NOT IN ('canceled'::public.order_status, 'refunded'::public.order_status)
      AND COALESCE(o.paid_at, o.created_at) >= start_at
      AND COALESCE(o.paid_at, o.created_at) < end_at
  ), tracked_orders AS (
    SELECT o.*
    FROM eligible_orders o
    WHERE EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = o.id
          AND (oi.financial_snapshot_version IS NULL OR oi.line_cost_snapshot IS NULL)
      )
  ), order_finance AS (
    SELECT
      o.id,
      o.financial_at,
      GREATEST(COALESCE(o.subtotal_amount, 0) - COALESCE(o.discount_amount, 0), 0)::numeric(14,2) AS revenue,
      COALESCE(sum(oi.line_cost_snapshot), 0)::numeric(14,2) AS cost,
      COALESCE(sum(oi.quantity), 0)::bigint AS units
    FROM tracked_orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    GROUP BY o.id, o.financial_at, o.subtotal_amount, o.discount_amount
  ), totals AS (
    SELECT
      COALESCE(sum(revenue), 0)::numeric(14,2) AS revenue,
      COALESCE(sum(cost), 0)::numeric(14,2) AS cost,
      COALESCE(sum(revenue - cost), 0)::numeric(14,2) AS profit,
      count(*)::bigint AS orders,
      COALESCE(sum(units), 0)::bigint AS units
    FROM order_finance
  )
  SELECT jsonb_build_object(
    'revenue', totals.revenue,
    'cost', totals.cost,
    'profit', totals.profit,
    'margin', CASE WHEN totals.revenue > 0 THEN round(totals.profit / totals.revenue * 100, 2) ELSE 0 END,
    'orders', totals.orders,
    'units', totals.units,
    'share5', round(totals.profit * 500 / 10000, 2)
  )
  INTO summary_value
  FROM totals;

  WITH eligible_orders AS (
    SELECT o.*, COALESCE(o.paid_at, o.created_at) AS financial_at
    FROM public.orders o
    WHERE o.created_at >= cutoff
      AND o.payment_status = 'paid'::public.payment_status
      AND o.status NOT IN ('canceled'::public.order_status, 'refunded'::public.order_status)
      AND COALESCE(o.paid_at, o.created_at) >= start_at
      AND COALESCE(o.paid_at, o.created_at) < end_at
  ), tracked_orders AS (
    SELECT o.*
    FROM eligible_orders o
    WHERE EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = o.id
          AND (oi.financial_snapshot_version IS NULL OR oi.line_cost_snapshot IS NULL)
      )
  ), order_finance AS (
    SELECT
      o.id,
      o.financial_at,
      GREATEST(COALESCE(o.subtotal_amount, 0) - COALESCE(o.discount_amount, 0), 0)::numeric(14,2) AS revenue,
      COALESCE(sum(oi.line_cost_snapshot), 0)::numeric(14,2) AS cost
    FROM tracked_orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    GROUP BY o.id, o.financial_at, o.subtotal_amount, o.discount_amount
  ), daily AS (
    SELECT
      date_trunc('day', financial_at AT TIME ZONE 'America/Fortaleza')::date AS bucket,
      sum(revenue)::numeric(14,2) AS revenue,
      sum(cost)::numeric(14,2) AS cost,
      sum(revenue - cost)::numeric(14,2) AS profit
    FROM order_finance
    GROUP BY 1
    ORDER BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', to_char(bucket, 'YYYY-MM-DD'),
    'revenue', revenue,
    'cost', cost,
    'profit', profit
  ) ORDER BY bucket), '[]'::jsonb)
  INTO trend_value
  FROM daily;

  WITH eligible_orders AS (
    SELECT o.*, COALESCE(o.paid_at, o.created_at) AS financial_at
    FROM public.orders o
    WHERE o.created_at >= cutoff
      AND o.payment_status = 'paid'::public.payment_status
      AND o.status NOT IN ('canceled'::public.order_status, 'refunded'::public.order_status)
      AND COALESCE(o.paid_at, o.created_at) >= start_at
      AND COALESCE(o.paid_at, o.created_at) < end_at
  ), tracked_orders AS (
    SELECT o.*
    FROM eligible_orders o
    WHERE EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = o.id
          AND (oi.financial_snapshot_version IS NULL OR oi.line_cost_snapshot IS NULL)
      )
  ), item_finance AS (
    SELECT
      oi.product_id,
      oi.product_name_snapshot AS name,
      COALESCE(oi.financial_category_snapshot, 'outro') AS category,
      oi.quantity,
      (COALESCE(oi.base_unit_price_snapshot, 0) * oi.quantity)::numeric(14,2) AS base_revenue,
      (COALESCE(oi.add_on_revenue_snapshot, 0) * oi.quantity)::numeric(14,2) AS add_on_revenue,
      COALESCE(oi.line_discount_snapshot, 0)::numeric(14,2) AS discount,
      (COALESCE(oi.unit_product_cost_snapshot, 0) * oi.quantity)::numeric(14,2) AS product_cost,
      (COALESCE(oi.add_on_cost_snapshot, 0) * oi.quantity)::numeric(14,2) AS add_on_cost,
      COALESCE(oi.line_cost_snapshot, 0)::numeric(14,2) AS cost,
      COALESCE(oi.line_revenue_snapshot, oi.line_total - COALESCE(oi.line_discount_snapshot, 0))::numeric(14,2) AS revenue
    FROM tracked_orders o
    JOIN public.order_items oi ON oi.order_id = o.id
  ), grouped AS (
    SELECT
      product_id,
      name,
      category,
      sum(quantity)::bigint AS units,
      sum(base_revenue)::numeric(14,2) AS base_revenue,
      sum(add_on_revenue)::numeric(14,2) AS add_on_revenue,
      sum(discount)::numeric(14,2) AS discounts,
      sum(product_cost)::numeric(14,2) AS product_cost,
      sum(add_on_cost)::numeric(14,2) AS add_on_cost,
      sum(cost)::numeric(14,2) AS cost,
      sum(revenue)::numeric(14,2) AS revenue,
      sum(revenue - cost)::numeric(14,2) AS profit
    FROM item_finance
    GROUP BY product_id, name, category
    ORDER BY sum(revenue - cost) DESC, sum(revenue) DESC
    LIMIT 50
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', product_id,
    'name', name,
    'category', category,
    'units', units,
    'baseRevenue', base_revenue,
    'addOnRevenue', add_on_revenue,
    'discounts', discounts,
    'productCost', product_cost,
    'addOnCost', add_on_cost,
    'cost', cost,
    'revenue', revenue,
    'profit', profit,
    'margin', CASE WHEN revenue > 0 THEN round(profit / revenue * 100, 2) ELSE 0 END,
    'share5', round(profit * 500 / 10000, 2)
  ) ORDER BY profit DESC, revenue DESC), '[]'::jsonb)
  INTO products_value
  FROM grouped;

  WITH eligible_orders AS (
    SELECT o.*, COALESCE(o.paid_at, o.created_at) AS financial_at
    FROM public.orders o
    WHERE o.created_at >= cutoff
      AND o.payment_status = 'paid'::public.payment_status
      AND o.status NOT IN ('canceled'::public.order_status, 'refunded'::public.order_status)
      AND COALESCE(o.paid_at, o.created_at) >= start_at
      AND COALESCE(o.paid_at, o.created_at) < end_at
  ), tracked_orders AS (
    SELECT o.*
    FROM eligible_orders o
    WHERE EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = o.id
          AND (oi.financial_snapshot_version IS NULL OR oi.line_cost_snapshot IS NULL)
      )
  ), item_finance AS (
    SELECT
      COALESCE(oi.financial_category_snapshot, 'outro') AS category,
      oi.quantity,
      (COALESCE(oi.base_unit_price_snapshot, 0) * oi.quantity)::numeric(14,2) AS base_revenue,
      (COALESCE(oi.add_on_revenue_snapshot, 0) * oi.quantity)::numeric(14,2) AS add_on_revenue,
      COALESCE(oi.line_discount_snapshot, 0)::numeric(14,2) AS discount,
      (COALESCE(oi.unit_product_cost_snapshot, 0) * oi.quantity)::numeric(14,2) AS product_cost,
      (COALESCE(oi.add_on_cost_snapshot, 0) * oi.quantity)::numeric(14,2) AS add_on_cost,
      COALESCE(oi.line_cost_snapshot, 0)::numeric(14,2) AS cost,
      COALESCE(oi.line_revenue_snapshot, oi.line_total - COALESCE(oi.line_discount_snapshot, 0))::numeric(14,2) AS revenue
    FROM tracked_orders o
    JOIN public.order_items oi ON oi.order_id = o.id
  ), grouped AS (
    SELECT
      category,
      sum(quantity)::bigint AS units,
      sum(base_revenue)::numeric(14,2) AS base_revenue,
      sum(add_on_revenue)::numeric(14,2) AS add_on_revenue,
      sum(discount)::numeric(14,2) AS discounts,
      sum(product_cost)::numeric(14,2) AS product_cost,
      sum(add_on_cost)::numeric(14,2) AS add_on_cost,
      sum(cost)::numeric(14,2) AS cost,
      sum(revenue)::numeric(14,2) AS revenue,
      sum(revenue - cost)::numeric(14,2) AS profit
    FROM item_finance
    GROUP BY category
    ORDER BY sum(revenue - cost) DESC, sum(revenue) DESC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', category,
    'name', category,
    'category', category,
    'units', units,
    'baseRevenue', base_revenue,
    'addOnRevenue', add_on_revenue,
    'discounts', discounts,
    'productCost', product_cost,
    'addOnCost', add_on_cost,
    'cost', cost,
    'revenue', revenue,
    'profit', profit,
    'margin', CASE WHEN revenue > 0 THEN round(profit / revenue * 100, 2) ELSE 0 END,
    'share5', round(profit * 500 / 10000, 2)
  ) ORDER BY profit DESC, revenue DESC), '[]'::jsonb)
  INTO categories_value
  FROM grouped;

  RETURN jsonb_build_object(
    'period', period_key,
    'periodStart', start_at,
    'periodEnd', end_at,
    'summary', COALESCE(summary_value, jsonb_build_object(
      'revenue', 0, 'cost', 0, 'profit', 0, 'margin', 0, 'orders', 0, 'units', 0, 'share5', 0
    )),
    'trend', COALESCE(trend_value, '[]'::jsonb),
    'products', COALESCE(products_value, '[]'::jsonb),
    'categories', COALESCE(categories_value, '[]'::jsonb),
    'excludedOrders', excluded_value
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_get_financial_dashboard(text,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_get_financial_dashboard(text,timestamptz,timestamptz) TO authenticated, service_role;

COMMENT ON TABLE public.finance_settings IS 'Custos atuais usados somente para novas vendas; pedidos preservam snapshots financeiros imutáveis.';
COMMENT ON TABLE public.product_financial_settings IS 'Custo atual por produto para novas vendas. Alterações nunca recalculam pedidos existentes.';
COMMENT ON COLUMN public.order_items.financial_breakdown IS 'Snapshot imutável da composição financeira do item no instante da compra.';
COMMENT ON FUNCTION public.owner_get_financial_dashboard(text,timestamptz,timestamptz) IS 'Resumo financeiro owner-only baseado exclusivamente em pedidos pagos, válidos e com snapshot financeiro completo.';

COMMIT;