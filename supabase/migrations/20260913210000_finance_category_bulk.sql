BEGIN;

-- DropBox — preços/custos em massa por classificação comercial.
-- Esta migration só altera valores atuais usados por NOVAS compras.
-- Nenhuma linha histórica de orders/order_items é atualizada ou reescrita.

-- ---------------------------------------------------------------------------
-- 1. Classificação comercial completa e variante-aware
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_purchase_settings
  DROP CONSTRAINT IF EXISTS product_purchase_commercial_type_valid;

ALTER TABLE public.product_purchase_settings
  ADD CONSTRAINT product_purchase_commercial_type_valid CHECK (
    commercial_type IN (
      'torcedor','feminino','jogador','retro','infantil','calcao','basquete',
      'camisa_calcao','regata_calcao','treino_calca','casaco_calca','corta_vento','other'
    )
  );

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS commercial_type text;

ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_commercial_type_valid;

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_commercial_type_valid CHECK (
    commercial_type IS NULL OR commercial_type IN (
      'torcedor','feminino','jogador','retro','infantil','calcao','basquete',
      'camisa_calcao','regata_calcao','treino_calca','casaco_calca','corta_vento','other'
    )
  );

-- As chaves que já existiam mantêm o valor atual do administrador; as novas
-- recebem somente o valor inicial aprovado quando ainda não existirem.
UPDATE public.store_purchase_settings
SET product_type_prices = jsonb_build_object(
      'camisa_calcao', 259.90,
      'regata_calcao', 259.90,
      'treino_calca', 339.90,
      'casaco_calca', 389.90,
      'corta_vento', 379.90
    ) || product_type_prices,
    updated_at = now()
WHERE singleton = true;

-- ---------------------------------------------------------------------------
-- 2. Fonte de verdade de custo geral + exceção individual por variante
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_category_settings (
  commercial_type text PRIMARY KEY,
  unit_cost numeric(12,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT finance_category_type_valid CHECK (
    commercial_type IN (
      'torcedor','feminino','jogador','retro','infantil','calcao','basquete',
      'camisa_calcao','regata_calcao','treino_calca','casaco_calca','corta_vento'
    )
  ),
  CONSTRAINT finance_category_cost_nonnegative CHECK (unit_cost >= 0)
);

CREATE TABLE IF NOT EXISTS public.product_variant_financial_settings (
  variant_id uuid PRIMARY KEY REFERENCES public.product_variants(id) ON DELETE CASCADE,
  unit_cost numeric(12,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT product_variant_financial_cost_nonnegative CHECK (unit_cost >= 0)
);

ALTER TABLE public.finance_category_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_financial_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_category_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.product_variant_financial_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_category_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_financial_settings TO service_role;

INSERT INTO public.finance_category_settings (commercial_type, unit_cost)
VALUES
  ('torcedor', 75.00),
  ('feminino', 75.00),
  ('jogador', 95.00),
  ('retro', 95.00),
  ('infantil', 90.00),
  ('calcao', 75.00),
  ('basquete', 120.00),
  ('camisa_calcao', 110.00),
  ('regata_calcao', 110.00),
  ('treino_calca', 215.00),
  ('casaco_calca', 240.00),
  ('corta_vento', 230.00)
ON CONFLICT (commercial_type) DO NOTHING;

-- Preserva somente as exceções individuais que já haviam sido criadas no
-- Financeiro. Custos automáticos antigos passam a herdar o custo da categoria.
INSERT INTO public.product_variant_financial_settings (variant_id, unit_cost, updated_at, updated_by)
SELECT v.id, pfs.unit_cost, now(), pfs.updated_by
FROM public.product_variants v
JOIN public.product_financial_settings pfs ON pfs.product_id = v.product_id
WHERE v.status <> 'archived'::public.product_variant_status
  AND pfs.is_manual
  AND pfs.unit_cost IS NOT NULL
ON CONFLICT (variant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.finance_category_from_commercial_type(p_commercial_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE COALESCE(p_commercial_type, 'other')
    WHEN 'torcedor' THEN 'torcedor'
    WHEN 'feminino' THEN 'feminina'
    WHEN 'jogador' THEN 'jogador'
    WHEN 'retro' THEN 'retro'
    WHEN 'infantil' THEN 'kit_infantil'
    WHEN 'calcao' THEN 'short_calcao'
    WHEN 'basquete' THEN 'basquete_nba'
    WHEN 'camisa_calcao' THEN 'camisa_calcao'
    WHEN 'regata_calcao' THEN 'regata_calcao'
    WHEN 'treino_calca' THEN 'treino_calca'
    WHEN 'casaco_calca' THEN 'casaco_calca'
    WHEN 'corta_vento' THEN 'corta_vento'
    ELSE 'outro'
  END;
$$;

CREATE OR REPLACE FUNCTION public.finance_effective_commercial_type(
  p_product_id uuid,
  p_variant_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(v.commercial_type, pps.commercial_type, 'other')
  FROM public.products p
  LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
  LEFT JOIN public.product_variants v ON v.id = p_variant_id AND v.product_id = p.id
  WHERE p.id = p_product_id;
$$;

CREATE OR REPLACE FUNCTION public.finance_variant_current_cost(p_variant_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    vfs.unit_cost,
    cfs.unit_cost,
    CASE
      WHEN COALESCE(v.commercial_type, pps.commercial_type, 'other') = 'other' THEN pfs.unit_cost
      ELSE NULL
    END
  )
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
  LEFT JOIN public.product_variant_financial_settings vfs ON vfs.variant_id = v.id
  LEFT JOIN public.finance_category_settings cfs
    ON cfs.commercial_type = COALESCE(v.commercial_type, pps.commercial_type, 'other')
  LEFT JOIN public.product_financial_settings pfs ON pfs.product_id = p.id
  WHERE v.id = p_variant_id;
$$;

REVOKE ALL ON FUNCTION public.finance_category_from_commercial_type(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_effective_commercial_type(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_variant_current_cost(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_category_from_commercial_type(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_effective_commercial_type(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_variant_current_cost(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Snapshot financeiro de NOVOS itens: variante primeiro, categoria depois
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.capture_order_item_financial_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  finance public.finance_settings%ROWTYPE;
  legacy_product_setting public.product_financial_settings%ROWTYPE;
  commercial_type_value text := 'other';
  option_row jsonb;
  option_id text;
  option_revenue numeric(12,2);
  add_on_revenue numeric(12,2) := 0;
  add_on_cost numeric(12,2) := 0;
  base_price numeric(12,2);
  product_cost numeric(12,2);
  category_value text := 'outro';
  order_subtotal numeric(12,2) := 0;
  order_discount numeric(12,2) := 0;
  line_discount numeric(12,2) := 0;
BEGIN
  SELECT * INTO finance
  FROM public.finance_settings
  WHERE singleton = true;

  commercial_type_value := COALESCE(
    public.finance_effective_commercial_type(NEW.product_id, NEW.variant_id),
    'other'
  );

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
    ELSIF option_id = 'purchase-patch' OR option_id LIKE 'purchase-patch-%' THEN
      add_on_cost := add_on_cost + COALESCE(finance.patch_cost, 5.00);
    END IF;
  END LOOP;

  base_price := GREATEST(round(COALESCE(NEW.unit_price, 0) - add_on_revenue, 2), 0);
  product_cost := public.finance_variant_current_cost(NEW.variant_id);
  category_value := public.finance_category_from_commercial_type(commercial_type_value);

  -- Compatibilidade para item sem variante (não esperado no checkout atual) ou
  -- produto ainda não classificado. Não inventa uma categoria comercial.
  IF product_cost IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT * INTO legacy_product_setting
    FROM public.product_financial_settings
    WHERE product_id = NEW.product_id;

    IF commercial_type_value = 'other' AND legacy_product_setting.product_id IS NOT NULL THEN
      product_cost := legacy_product_setting.unit_cost;
    END IF;
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
  NEW.financial_snapshot_version := 2;

  IF product_cost IS NOT NULL THEN
    NEW.unit_total_cost_snapshot := round(product_cost + add_on_cost, 2);
    NEW.line_cost_snapshot := round(
      (product_cost + add_on_cost) * GREATEST(COALESCE(NEW.quantity, 1), 1),
      2
    );
    NEW.line_profit_snapshot := round(NEW.line_revenue_snapshot - NEW.line_cost_snapshot, 2);
  ELSE
    NEW.unit_total_cost_snapshot := NULL;
    NEW.line_cost_snapshot := NULL;
    NEW.line_profit_snapshot := NULL;
  END IF;

  NEW.financial_breakdown := jsonb_build_object(
    'version', 2,
    'commercialType', commercial_type_value,
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

REVOKE ALL ON FUNCTION public.capture_order_item_financial_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_order_item_financial_snapshot() TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Administração por categoria (owner only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owner_finance_category_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  WITH supported(commercial_type, label, sort_order) AS (
    VALUES
      ('torcedor','Torcedor',1),
      ('feminino','Feminina',2),
      ('jogador','Jogador',3),
      ('retro','Retrô',4),
      ('infantil','Kit Infantil',5),
      ('calcao','Short / Calção',6),
      ('basquete','Basquete / NBA',7),
      ('camisa_calcao','Camisa + Calção',8),
      ('regata_calcao','Regata + Calção',9),
      ('treino_calca','Camisa/Top de Treino + Calça',10),
      ('casaco_calca','Casaco + Calça',11),
      ('corta_vento','Corta-vento',12)
  ), targets AS (
    SELECT
      COALESCE(v.commercial_type, pps.commercial_type, 'other') AS commercial_type,
      count(*)::integer AS target_count,
      count(DISTINCT v.product_id)::integer AS product_count,
      count(vfs.variant_id)::integer AS individual_cost_overrides
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    LEFT JOIN public.product_variant_financial_settings vfs ON vfs.variant_id = v.id
    WHERE v.status <> 'archived'::public.product_variant_status
      AND p.status <> 'archived'::public.product_status
    GROUP BY COALESCE(v.commercial_type, pps.commercial_type, 'other')
  )
  SELECT jsonb_build_object(
    'categories', COALESCE(jsonb_agg(
      jsonb_build_object(
        'commercialType', s.commercial_type,
        'label', s.label,
        'salePrice', NULLIF(store.product_type_prices ->> s.commercial_type, '')::numeric,
        'unitCost', cfs.unit_cost,
        'targetCount', COALESCE(t.target_count, 0),
        'productCount', COALESCE(t.product_count, 0),
        'individualCostOverrides', COALESCE(t.individual_cost_overrides, 0)
      ) ORDER BY s.sort_order
    ), '[]'::jsonb)
  )
  INTO result
  FROM supported s
  CROSS JOIN public.store_purchase_settings store
  LEFT JOIN public.finance_category_settings cfs ON cfs.commercial_type = s.commercial_type
  LEFT JOIN targets t ON t.commercial_type = s.commercial_type
  WHERE store.singleton = true;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_apply_finance_category(
  p_commercial_type text,
  p_sale_price numeric DEFAULT NULL,
  p_unit_cost numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_type text := btrim(COALESCE(p_commercial_type, ''));
  affected_targets integer := 0;
  affected_products integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF normalized_type NOT IN (
    'torcedor','feminino','jogador','retro','infantil','calcao','basquete',
    'camisa_calcao','regata_calcao','treino_calca','casaco_calca','corta_vento'
  ) THEN
    RAISE EXCEPTION 'Categoria comercial inválida';
  END IF;

  IF p_sale_price IS NULL AND p_unit_cost IS NULL THEN
    RAISE EXCEPTION 'Informe o novo preço, o novo custo ou ambos';
  END IF;

  IF p_sale_price IS NOT NULL AND p_sale_price < 0 THEN
    RAISE EXCEPTION 'Preço de venda inválido';
  END IF;
  IF p_unit_cost IS NOT NULL AND p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Custo inválido';
  END IF;

  SELECT count(*)::integer, count(DISTINCT v.product_id)::integer
  INTO affected_targets, affected_products
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
  WHERE v.status <> 'archived'::public.product_variant_status
    AND p.status <> 'archived'::public.product_status
    AND COALESCE(v.commercial_type, pps.commercial_type, 'other') = normalized_type;

  IF p_sale_price IS NOT NULL THEN
    UPDATE public.store_purchase_settings
    SET product_type_prices = jsonb_set(
          product_type_prices,
          ARRAY[normalized_type],
          to_jsonb(round(p_sale_price, 2)),
          true
        ),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE singleton = true;

    -- Antes de sincronizar o preço do produto-base com sua variante padrão,
    -- materializa o preço atual das irmãs. Assim uma variante Jogador nunca é
    -- alterada quando somente Torcedor é atualizada (e vice-versa).
    WITH affected_product_ids AS (
      SELECT DISTINCT v.product_id
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
      LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
      WHERE v.status <> 'archived'::public.product_variant_status
        AND p.status <> 'archived'::public.product_status
        AND COALESCE(v.commercial_type, pps.commercial_type, 'other') = normalized_type
    )
    UPDATE public.product_variants v
    SET price_override = p.price,
        promotional_price_override = p.promotional_price,
        updated_at = now()
    FROM public.products p
    JOIN affected_product_ids ap ON ap.product_id = p.id
    WHERE v.product_id = p.id
      AND v.status <> 'archived'::public.product_variant_status
      AND v.price_override IS NULL;

    UPDATE public.product_variants v
    SET price_override = round(p_sale_price, 2),
        promotional_price_override = NULL,
        updated_at = now()
    FROM public.products p
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    WHERE v.product_id = p.id
      AND v.status <> 'archived'::public.product_variant_status
      AND p.status <> 'archived'::public.product_status
      AND COALESCE(v.commercial_type, pps.commercial_type, 'other') = normalized_type;

    -- O catálogo público continua mostrando o preço da variante padrão, enquanto
    -- o checkout usa a própria variante selecionada. Não há fonte paralela.
    WITH affected_product_ids AS (
      SELECT DISTINCT v.product_id
      FROM public.product_variants v
      JOIN public.products p ON p.id = v.product_id
      LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
      WHERE v.status <> 'archived'::public.product_variant_status
        AND p.status <> 'archived'::public.product_status
        AND COALESCE(v.commercial_type, pps.commercial_type, 'other') = normalized_type
    ), preferred_variant AS (
      SELECT DISTINCT ON (v.product_id)
        v.product_id,
        v.price_override,
        v.promotional_price_override
      FROM public.product_variants v
      JOIN affected_product_ids ap ON ap.product_id = v.product_id
      WHERE v.status <> 'archived'::public.product_variant_status
      ORDER BY v.product_id, v.is_default DESC, v.sort_order ASC, v.created_at ASC, v.id ASC
    )
    UPDATE public.products p
    SET price = pv.price_override,
        promotional_price = pv.promotional_price_override,
        updated_at = now()
    FROM preferred_variant pv
    WHERE p.id = pv.product_id
      AND pv.price_override IS NOT NULL;
  END IF;

  IF p_unit_cost IS NOT NULL THEN
    INSERT INTO public.finance_category_settings (commercial_type, unit_cost, updated_at, updated_by)
    VALUES (normalized_type, round(p_unit_cost, 2), now(), auth.uid())
    ON CONFLICT (commercial_type) DO UPDATE
    SET unit_cost = EXCLUDED.unit_cost,
        updated_at = now(),
        updated_by = auth.uid();

    -- “Aplicar a todos” elimina deliberadamente exceções individuais daquele
    -- grupo. Depois o owner pode criar uma nova exceção em qualquer variante.
    DELETE FROM public.product_variant_financial_settings vfs
    USING public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    WHERE vfs.variant_id = v.id
      AND v.status <> 'archived'::public.product_variant_status
      AND p.status <> 'archived'::public.product_status
      AND COALESCE(v.commercial_type, pps.commercial_type, 'other') = normalized_type;
  END IF;

  RETURN jsonb_build_object(
    'commercialType', normalized_type,
    'salePrice', CASE WHEN p_sale_price IS NULL THEN NULL ELSE round(p_sale_price, 2) END,
    'unitCost', CASE WHEN p_unit_cost IS NULL THEN NULL ELSE round(p_unit_cost, 2) END,
    'targetCount', affected_targets,
    'productCount', affected_products,
    'futureSalesOnly', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Edição individual por variante (mesma fonte usada pelo checkout)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owner_finance_variant_targets_page(
  p_query text DEFAULT NULL,
  p_commercial_type text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  query_text text := NULLIF(public.catalog_normalize_text(p_query), '');
  type_filter text := NULLIF(btrim(COALESCE(p_commercial_type, '')), '');
  page_number integer := GREATEST(COALESCE(p_page, 1), 1);
  page_size_value integer := LEAST(GREATEST(COALESCE(p_page_size, 25), 10), 100);
  total_value bigint;
  items_value jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  WITH rows AS (
    SELECT
      v.id AS variant_id,
      v.product_id,
      p.name AS product_name,
      v.name AS variant_name,
      v.sku,
      v.commercial_type AS explicit_type,
      COALESCE(v.commercial_type, pps.commercial_type, 'other') AS effective_type,
      COALESCE(
        v.promotional_price_override,
        CASE WHEN v.price_override IS NULL THEN p.promotional_price ELSE NULL END,
        v.price_override,
        p.price
      ) AS sale_price,
      COALESCE(
        vfs.unit_cost,
        cfs.unit_cost,
        CASE WHEN COALESCE(v.commercial_type, pps.commercial_type, 'other') = 'other' THEN pfs.unit_cost END
      ) AS unit_cost,
      (vfs.variant_id IS NOT NULL) AS has_cost_override,
      p.catalog_search_text
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    LEFT JOIN public.product_variant_financial_settings vfs ON vfs.variant_id = v.id
    LEFT JOIN public.finance_category_settings cfs
      ON cfs.commercial_type = COALESCE(v.commercial_type, pps.commercial_type, 'other')
    LEFT JOIN public.product_financial_settings pfs ON pfs.product_id = p.id
    WHERE v.status <> 'archived'::public.product_variant_status
      AND p.status <> 'archived'::public.product_status
  ), filtered AS (
    SELECT *
    FROM rows
    WHERE (type_filter IS NULL OR effective_type = type_filter)
      AND (
        query_text IS NULL
        OR catalog_search_text LIKE '%' || query_text || '%'
        OR public.catalog_normalize_text(COALESCE(variant_name, '')) LIKE '%' || query_text || '%'
        OR public.catalog_normalize_text(sku) LIKE '%' || query_text || '%'
      )
  )
  SELECT count(*) INTO total_value FROM filtered;

  WITH rows AS (
    SELECT
      v.id AS variant_id,
      v.product_id,
      p.name AS product_name,
      v.name AS variant_name,
      v.sku,
      v.is_default,
      v.sort_order,
      v.commercial_type AS explicit_type,
      COALESCE(v.commercial_type, pps.commercial_type, 'other') AS effective_type,
      COALESCE(
        v.promotional_price_override,
        CASE WHEN v.price_override IS NULL THEN p.promotional_price ELSE NULL END,
        v.price_override,
        p.price
      ) AS sale_price,
      COALESCE(
        vfs.unit_cost,
        cfs.unit_cost,
        CASE WHEN COALESCE(v.commercial_type, pps.commercial_type, 'other') = 'other' THEN pfs.unit_cost END
      ) AS unit_cost,
      (vfs.variant_id IS NOT NULL) AS has_cost_override,
      p.catalog_search_text
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    LEFT JOIN public.product_variant_financial_settings vfs ON vfs.variant_id = v.id
    LEFT JOIN public.finance_category_settings cfs
      ON cfs.commercial_type = COALESCE(v.commercial_type, pps.commercial_type, 'other')
    LEFT JOIN public.product_financial_settings pfs ON pfs.product_id = p.id
    WHERE v.status <> 'archived'::public.product_variant_status
      AND p.status <> 'archived'::public.product_status
  ), filtered AS (
    SELECT *
    FROM rows
    WHERE (type_filter IS NULL OR effective_type = type_filter)
      AND (
        query_text IS NULL
        OR catalog_search_text LIKE '%' || query_text || '%'
        OR public.catalog_normalize_text(COALESCE(variant_name, '')) LIKE '%' || query_text || '%'
        OR public.catalog_normalize_text(sku) LIKE '%' || query_text || '%'
      )
  ), page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY product_name, is_default DESC, sort_order, variant_id
    OFFSET (page_number - 1) * page_size_value
    LIMIT page_size_value
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'variantId', variant_id,
      'productId', product_id,
      'productName', product_name,
      'variantName', variant_name,
      'sku', sku,
      'explicitCommercialType', explicit_type,
      'commercialType', effective_type,
      'salePrice', sale_price,
      'unitCost', unit_cost,
      'hasCostOverride', has_cost_override
    ) ORDER BY product_name, is_default DESC, sort_order, variant_id
  ), '[]'::jsonb)
  INTO items_value
  FROM page_rows;

  RETURN jsonb_build_object(
    'items', items_value,
    'total', total_value,
    'page', page_number,
    'pageSize', page_size_value,
    'totalPages', CASE WHEN total_value = 0 THEN 0 ELSE ceil(total_value::numeric / page_size_value)::integer END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_save_finance_variant(
  p_variant_id uuid,
  p_commercial_type text DEFAULT NULL,
  p_sale_price numeric DEFAULT NULL,
  p_unit_cost numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.product_variants%ROWTYPE;
  parent public.products%ROWTYPE;
  normalized_type text;
  effective_type text;
  resolved_cost numeric(12,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT * INTO target
  FROM public.product_variants
  WHERE id = p_variant_id
    AND status <> 'archived'::public.product_variant_status;

  IF target.id IS NULL THEN
    RAISE EXCEPTION 'Variação não encontrada';
  END IF;

  SELECT * INTO parent
  FROM public.products
  WHERE id = target.product_id
    AND status <> 'archived'::public.product_status;

  IF parent.id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF p_commercial_type IS NOT NULL THEN
    normalized_type := NULLIF(btrim(p_commercial_type), '');
    IF normalized_type IS NOT NULL AND normalized_type NOT IN (
      'torcedor','feminino','jogador','retro','infantil','calcao','basquete',
      'camisa_calcao','regata_calcao','treino_calca','casaco_calca','corta_vento','other'
    ) THEN
      RAISE EXCEPTION 'Categoria comercial inválida';
    END IF;

    UPDATE public.product_variants
    SET commercial_type = normalized_type,
        updated_at = now()
    WHERE id = target.id;
  END IF;

  IF p_sale_price IS NOT NULL THEN
    IF p_sale_price < 0 THEN RAISE EXCEPTION 'Preço de venda inválido'; END IF;

    IF target.is_default THEN
      -- Protege as irmãs antes de alterar o preço-base exibido pelo catálogo.
      UPDATE public.product_variants v
      SET price_override = parent.price,
          promotional_price_override = parent.promotional_price,
          updated_at = now()
      WHERE v.product_id = target.product_id
        AND v.id <> target.id
        AND v.status <> 'archived'::public.product_variant_status
        AND v.price_override IS NULL;
    END IF;

    UPDATE public.product_variants
    SET price_override = round(p_sale_price, 2),
        promotional_price_override = NULL,
        updated_at = now()
    WHERE id = target.id;

    IF target.is_default THEN
      UPDATE public.products
      SET price = round(p_sale_price, 2),
          promotional_price = NULL,
          updated_at = now()
      WHERE id = target.product_id;
    END IF;
  END IF;

  IF p_unit_cost IS NOT NULL THEN
    IF p_unit_cost < 0 THEN RAISE EXCEPTION 'Custo inválido'; END IF;

    INSERT INTO public.product_variant_financial_settings (variant_id, unit_cost, updated_at, updated_by)
    VALUES (target.id, round(p_unit_cost, 2), now(), auth.uid())
    ON CONFLICT (variant_id) DO UPDATE
    SET unit_cost = EXCLUDED.unit_cost,
        updated_at = now(),
        updated_by = auth.uid();
  END IF;

  effective_type := COALESCE(
    (SELECT v.commercial_type FROM public.product_variants v WHERE v.id = target.id),
    (SELECT pps.commercial_type FROM public.product_purchase_settings pps WHERE pps.product_id = target.product_id),
    'other'
  );
  resolved_cost := public.finance_variant_current_cost(target.id);

  RETURN jsonb_build_object(
    'variantId', target.id,
    'productId', target.product_id,
    'commercialType', effective_type,
    'salePrice', COALESCE(
      (SELECT v.promotional_price_override FROM public.product_variants v WHERE v.id = target.id),
      (SELECT v.price_override FROM public.product_variants v WHERE v.id = target.id),
      (SELECT p.promotional_price FROM public.products p WHERE p.id = target.product_id),
      (SELECT p.price FROM public.products p WHERE p.id = target.product_id)
    ),
    'unitCost', resolved_cost,
    'futureSalesOnly', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Compatibilidade do editor individual já existente
-- ---------------------------------------------------------------------------

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

  WITH product_page AS (
    SELECT p.*
    FROM public.products p
    WHERE p.status <> 'archived'::public.product_status
      AND (query_text IS NULL OR p.catalog_search_text LIKE '%' || query_text || '%')
    ORDER BY p.name, p.id
    OFFSET (page_number - 1) * page_size_value
    LIMIT page_size_value
  ), preferred_variant AS (
    SELECT DISTINCT ON (v.product_id)
      v.product_id,
      v.id AS variant_id,
      v.name AS variant_name,
      v.commercial_type,
      v.price_override,
      v.promotional_price_override
    FROM public.product_variants v
    JOIN product_page p ON p.id = v.product_id
    WHERE v.status <> 'archived'::public.product_variant_status
    ORDER BY v.product_id, v.is_default DESC, v.sort_order, v.created_at, v.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'productId', p.id,
    'name', p.name,
    'sku', p.sku,
    'commercialType', COALESCE(pv.commercial_type, pps.commercial_type, 'other'),
    'salePrice', COALESCE(
      pv.promotional_price_override,
      CASE WHEN pv.price_override IS NULL THEN p.promotional_price ELSE NULL END,
      pv.price_override,
      p.price
    ),
    'unitCost', public.finance_variant_current_cost(pv.variant_id),
    'costConfigured', public.finance_variant_current_cost(pv.variant_id) IS NOT NULL,
    'isManualCost', vfs.variant_id IS NOT NULL,
    'financialCategory', public.finance_category_from_commercial_type(
      COALESCE(pv.commercial_type, pps.commercial_type, 'other')
    )
  ) ORDER BY p.name), '[]'::jsonb)
  INTO items_value
  FROM product_page p
  LEFT JOIN preferred_variant pv ON pv.product_id = p.id
  LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
  LEFT JOIN public.product_variant_financial_settings vfs ON vfs.variant_id = pv.variant_id;

  RETURN jsonb_build_object(
    'items', items_value,
    'total', total_value,
    'page', page_number,
    'pageSize', page_size_value,
    'totalPages', CASE WHEN total_value = 0 THEN 0 ELSE ceil(total_value::numeric / page_size_value)::integer END
  );
END;
$$;

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
  variant_id_value uuid;
  commercial_type_value text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Custo inválido';
  END IF;

  SELECT v.id
  INTO variant_id_value
  FROM public.product_variants v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.product_id = p_product_id
    AND v.status <> 'archived'::public.product_variant_status
    AND p.status <> 'archived'::public.product_status
  ORDER BY v.is_default DESC, v.sort_order, v.created_at, v.id
  LIMIT 1;

  IF variant_id_value IS NULL THEN
    RAISE EXCEPTION 'Produto sem variação editável';
  END IF;

  INSERT INTO public.product_variant_financial_settings (variant_id, unit_cost, updated_at, updated_by)
  VALUES (variant_id_value, round(p_unit_cost, 2), now(), auth.uid())
  ON CONFLICT (variant_id) DO UPDATE
  SET unit_cost = EXCLUDED.unit_cost,
      updated_at = now(),
      updated_by = auth.uid();

  commercial_type_value := COALESCE(
    public.finance_effective_commercial_type(p_product_id, variant_id_value),
    'other'
  );

  RETURN jsonb_build_object(
    'productId', p_product_id,
    'unitCost', round(p_unit_cost, 2),
    'financialCategory', public.finance_category_from_commercial_type(commercial_type_value),
    'isManualCost', true
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Os editores de compra existentes passam a reconhecer os 12 grupos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owner_save_store_purchase_settings_v2(
  p_personalization_price numeric,
  p_personalization_name_max integer,
  p_phrase_price numeric,
  p_phrase_max integer,
  p_patch_default_price numeric,
  p_production_business_days integer,
  p_delivery_min_business_days integer,
  p_delivery_max_business_days integer,
  p_product_type_prices jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  required_key text;
  previous_prices jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_personalization_price < 0 OR p_phrase_price < 0 OR p_patch_default_price < 0 THEN
    RAISE EXCEPTION 'Os adicionais não podem ter valor negativo';
  END IF;
  IF p_personalization_name_max NOT BETWEEN 1 AND 50 OR p_phrase_max NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Limites de personalização inválidos';
  END IF;
  IF p_production_business_days NOT BETWEEN 0 AND 60
     OR p_delivery_min_business_days NOT BETWEEN 0 AND 120
     OR p_delivery_max_business_days NOT BETWEEN p_delivery_min_business_days AND 180 THEN
    RAISE EXCEPTION 'Prazos inválidos';
  END IF;
  IF jsonb_typeof(p_product_type_prices) <> 'object' THEN
    RAISE EXCEPTION 'Tabela de preços inválida';
  END IF;

  FOREACH required_key IN ARRAY ARRAY[
    'torcedor','feminino','jogador','retro','infantil','calcao','basquete',
    'camisa_calcao','regata_calcao','treino_calca','casaco_calca','corta_vento'
  ]
  LOOP
    IF NOT (p_product_type_prices ? required_key)
       OR (p_product_type_prices->>required_key)::numeric < 0 THEN
      RAISE EXCEPTION 'Preço inválido para %', required_key;
    END IF;
  END LOOP;

  SELECT product_type_prices INTO previous_prices
  FROM public.store_purchase_settings
  WHERE singleton = true;

  UPDATE public.store_purchase_settings SET
    personalization_price = round(p_personalization_price, 2),
    personalization_name_max = p_personalization_name_max,
    phrase_price = round(p_phrase_price, 2),
    phrase_max = p_phrase_max,
    patch_default_price = round(p_patch_default_price, 2),
    production_business_days = p_production_business_days,
    delivery_min_business_days = p_delivery_min_business_days,
    delivery_max_business_days = p_delivery_max_business_days,
    product_type_prices = p_product_type_prices,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE singleton = true;

  -- Se o editor antigo de preços por modelo for usado, ele também atualiza a
  -- fonte real do checkout para todos os itens da categoria.
  FOREACH required_key IN ARRAY ARRAY[
    'torcedor','feminino','jogador','retro','infantil','calcao','basquete',
    'camisa_calcao','regata_calcao','treino_calca','casaco_calca','corta_vento'
  ]
  LOOP
    IF COALESCE(previous_prices->>required_key, '') IS DISTINCT FROM COALESCE(p_product_type_prices->>required_key, '') THEN
      PERFORM public.owner_apply_finance_category(
        required_key,
        (p_product_type_prices->>required_key)::numeric,
        NULL
      );
    END IF;
  END LOOP;

  RETURN public.owner_get_store_purchase_settings();
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_save_product_purchase_settings_v2(
  p_product_id uuid,
  p_commercial_type text,
  p_size_enabled boolean,
  p_personalization_enabled boolean,
  p_phrase_enabled boolean,
  p_patches jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  type_prices jsonb;
  fixed_price numeric;
  old_product public.products%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_commercial_type NOT IN (
    'torcedor','feminino','jogador','retro','infantil','calcao','basquete',
    'camisa_calcao','regata_calcao','treino_calca','casaco_calca','corta_vento','other'
  ) THEN
    RAISE EXCEPTION 'Modelo comercial inválido';
  END IF;
  IF jsonb_typeof(COALESCE(p_patches, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Patches inválidos';
  END IF;

  SELECT * INTO old_product
  FROM public.products
  WHERE id = p_product_id
    AND status <> 'archived'::public.product_status;
  IF old_product.id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  INSERT INTO public.product_purchase_settings(
    product_id, commercial_type, size_enabled, personalization_enabled, phrase_enabled, patches, updated_by
  ) VALUES (
    p_product_id, p_commercial_type, p_size_enabled, p_personalization_enabled,
    p_phrase_enabled, COALESCE(p_patches, '[]'::jsonb), auth.uid()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    commercial_type = EXCLUDED.commercial_type,
    size_enabled = EXCLUDED.size_enabled,
    personalization_enabled = EXCLUDED.personalization_enabled,
    phrase_enabled = EXCLUDED.phrase_enabled,
    patches = EXCLUDED.patches,
    updated_at = now(),
    updated_by = auth.uid();

  IF p_commercial_type <> 'other' THEN
    SELECT product_type_prices INTO type_prices
    FROM public.store_purchase_settings
    WHERE singleton = true;
    fixed_price := NULLIF(type_prices->>p_commercial_type, '')::numeric;

    IF fixed_price IS NOT NULL THEN
      -- Variantes com classificação própria não podem herdar acidentalmente a
      -- mudança do produto-base.
      UPDATE public.product_variants v
      SET price_override = old_product.price,
          promotional_price_override = old_product.promotional_price,
          updated_at = now()
      WHERE v.product_id = p_product_id
        AND v.status <> 'archived'::public.product_variant_status
        AND v.commercial_type IS NOT NULL
        AND v.price_override IS NULL;

      UPDATE public.products
      SET price = round(fixed_price, 2),
          promotional_price = NULL,
          updated_at = now()
      WHERE id = p_product_id;
    END IF;
  END IF;

  RETURN public.owner_get_product_purchase_settings(p_product_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Segurança explícita dos novos/alterados RPCs
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.owner_finance_category_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_apply_finance_category(text,numeric,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_finance_variant_targets_page(text,text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_save_finance_variant(uuid,text,numeric,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_finance_products_page(text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_save_product_finance(uuid,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_save_store_purchase_settings_v2(numeric,integer,numeric,integer,numeric,integer,integer,integer,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_save_product_purchase_settings_v2(uuid,text,boolean,boolean,boolean,jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owner_finance_category_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_apply_finance_category(text,numeric,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_finance_variant_targets_page(text,text,integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_save_finance_variant(uuid,text,numeric,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_finance_products_page(text,integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_save_product_finance(uuid,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_save_store_purchase_settings_v2(numeric,integer,numeric,integer,numeric,integer,integer,integer,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_save_product_purchase_settings_v2(uuid,text,boolean,boolean,boolean,jsonb) TO authenticated, service_role;

COMMIT;
