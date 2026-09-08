BEGIN;

CREATE OR REPLACE FUNCTION public.owner_get_store_purchase_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.store_purchase_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  SELECT * INTO s FROM public.store_purchase_settings WHERE singleton = true;
  RETURN jsonb_build_object(
    'sizes', to_jsonb(s.sizes),
    'personalizationPrice', s.personalization_price,
    'personalizationNameMax', s.personalization_name_max,
    'phrasePrice', s.phrase_price,
    'phraseMax', s.phrase_max,
    'patchDefaultPrice', s.patch_default_price,
    'patchCatalog', s.patch_catalog,
    'productionBusinessDays', s.production_business_days,
    'deliveryMinBusinessDays', s.delivery_min_business_days,
    'deliveryMaxBusinessDays', s.delivery_max_business_days,
    'productTypePrices', s.product_type_prices
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_get_store_purchase_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_get_store_purchase_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_purchase_products_page(
  p_query text DEFAULT NULL,
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
  page_number integer := GREATEST(COALESCE(p_page, 1), 1);
  page_size_value integer := LEAST(GREATEST(COALESCE(p_page_size, 25), 10), 100);
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'productId', p.id,
    'name', p.name,
    'price', p.price,
    'commercialType', COALESCE(s.commercial_type, 'other'),
    'sizeEnabled', COALESCE(s.size_enabled, true),
    'personalizationEnabled', COALESCE(s.personalization_enabled, true),
    'phraseEnabled', COALESCE(s.phrase_enabled, true),
    'patches', COALESCE(s.patches, '[]'::jsonb)
  ) ORDER BY p.name), '[]'::jsonb)
  INTO items_value
  FROM (
    SELECT p.*
    FROM public.products p
    WHERE p.status <> 'archived'::public.product_status
      AND (query_text IS NULL OR p.catalog_search_text LIKE '%' || query_text || '%')
    ORDER BY p.name, p.id
    OFFSET (page_number - 1) * page_size_value
    LIMIT page_size_value
  ) p
  LEFT JOIN public.product_purchase_settings s ON s.product_id = p.id;

  RETURN jsonb_build_object(
    'items', items_value,
    'total', total_value,
    'page', page_number,
    'pageSize', page_size_value,
    'totalPages', CASE WHEN total_value = 0 THEN 0 ELSE ceil(total_value::numeric / page_size_value)::integer END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_purchase_products_page(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_purchase_products_page(text,integer,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_get_product_purchase_settings(p_product_id uuid)
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
  SELECT jsonb_build_object(
    'productId', p.id,
    'name', p.name,
    'price', p.price,
    'commercialType', COALESCE(s.commercial_type, 'other'),
    'sizeEnabled', COALESCE(s.size_enabled, true),
    'personalizationEnabled', COALESCE(s.personalization_enabled, true),
    'phraseEnabled', COALESCE(s.phrase_enabled, true),
    'patches', COALESCE(s.patches, '[]'::jsonb)
  ) INTO result
  FROM public.products p
  LEFT JOIN public.product_purchase_settings s ON s.product_id = p.id
  WHERE p.id = p_product_id AND p.status <> 'archived'::public.product_status;
  IF result IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_get_product_purchase_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_get_product_purchase_settings(uuid) TO authenticated, service_role;

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
  FOREACH required_key IN ARRAY ARRAY['torcedor','feminino','jogador','retro','infantil','calcao','basquete']
  LOOP
    IF NOT (p_product_type_prices ? required_key)
       OR (p_product_type_prices->>required_key)::numeric < 0 THEN
      RAISE EXCEPTION 'Preço inválido para %', required_key;
    END IF;
  END LOOP;

  UPDATE public.store_purchase_settings SET
    personalization_price = p_personalization_price,
    personalization_name_max = p_personalization_name_max,
    phrase_price = p_phrase_price,
    phrase_max = p_phrase_max,
    patch_default_price = p_patch_default_price,
    production_business_days = p_production_business_days,
    delivery_min_business_days = p_delivery_min_business_days,
    delivery_max_business_days = p_delivery_max_business_days,
    product_type_prices = p_product_type_prices,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE singleton = true;

  RETURN public.owner_get_store_purchase_settings();
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_store_purchase_settings_v2(numeric,integer,numeric,integer,numeric,integer,integer,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_store_purchase_settings_v2(numeric,integer,numeric,integer,numeric,integer,integer,integer,jsonb) TO authenticated, service_role;

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
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_commercial_type NOT IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete','other') THEN
    RAISE EXCEPTION 'Modelo comercial inválido';
  END IF;
  IF jsonb_typeof(COALESCE(p_patches, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Patches inválidos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND status <> 'archived'::public.product_status) THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

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
    SELECT product_type_prices INTO type_prices FROM public.store_purchase_settings WHERE singleton = true;
    fixed_price := NULLIF(type_prices->>p_commercial_type, '')::numeric;
    IF fixed_price IS NOT NULL THEN
      UPDATE public.products SET price = fixed_price, promotional_price = NULL WHERE id = p_product_id;
    END IF;
  END IF;

  RETURN public.owner_get_product_purchase_settings(p_product_id);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_product_purchase_settings_v2(uuid,text,boolean,boolean,boolean,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_product_purchase_settings_v2(uuid,text,boolean,boolean,boolean,jsonb) TO authenticated, service_role;

COMMIT;
