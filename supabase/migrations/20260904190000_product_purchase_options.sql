BEGIN;

CREATE TABLE IF NOT EXISTS public.store_purchase_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  sizes text[] NOT NULL DEFAULT ARRAY['P','M','G','GG','2GG','3GG','4XL'],
  personalization_price numeric(12,2) NOT NULL DEFAULT 25.00,
  personalization_name_max smallint NOT NULL DEFAULT 12,
  phrase_price numeric(12,2) NOT NULL DEFAULT 45.00,
  phrase_max smallint NOT NULL DEFAULT 50,
  patch_default_price numeric(12,2) NOT NULL DEFAULT 15.00,
  patch_catalog jsonb NOT NULL DEFAULT '[{"code":"brasileirao","label":"Brasileirão"},{"code":"libertadores","label":"Libertadores"},{"code":"sul-americana","label":"Sul-Americana"},{"code":"copa-do-brasil","label":"Copa do Brasil"},{"code":"mundial-de-clubes","label":"Mundial de Clubes"}]'::jsonb,
  production_business_days smallint NOT NULL DEFAULT 5,
  delivery_min_business_days smallint NOT NULL DEFAULT 15,
  delivery_max_business_days smallint NOT NULL DEFAULT 25,
  product_type_prices jsonb NOT NULL DEFAULT '{"torcedor":184.90,"feminino":184.90,"jogador":219.90,"retro":219.90,"infantil":169.90,"calcao":159.90,"basquete":229.90}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT store_purchase_prices_positive CHECK (
    personalization_price >= 0 AND phrase_price >= 0 AND patch_default_price >= 0
  ),
  CONSTRAINT store_purchase_limits_valid CHECK (
    personalization_name_max BETWEEN 1 AND 50
    AND phrase_max BETWEEN 1 AND 200
    AND production_business_days BETWEEN 0 AND 60
    AND delivery_min_business_days BETWEEN 0 AND 120
    AND delivery_max_business_days BETWEEN delivery_min_business_days AND 180
  ),
  CONSTRAINT store_purchase_patch_catalog_array CHECK (jsonb_typeof(patch_catalog) = 'array'),
  CONSTRAINT store_purchase_type_prices_object CHECK (jsonb_typeof(product_type_prices) = 'object')
);

INSERT INTO public.store_purchase_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.product_purchase_settings (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  commercial_type text NOT NULL DEFAULT 'other',
  size_enabled boolean NOT NULL DEFAULT true,
  personalization_enabled boolean NOT NULL DEFAULT true,
  phrase_enabled boolean NOT NULL DEFAULT true,
  patches jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT product_purchase_commercial_type_valid CHECK (
    commercial_type IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete','other')
  ),
  CONSTRAINT product_purchase_patches_array CHECK (jsonb_typeof(patches) = 'array')
);

ALTER TABLE public.store_purchase_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_purchase_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.store_purchase_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.product_purchase_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.store_purchase_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_purchase_settings TO service_role;

CREATE OR REPLACE FUNCTION public.get_product_purchase_config(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  global_row public.store_purchase_settings%ROWTYPE;
  product_row public.product_purchase_settings%ROWTYPE;
  resolved_patches jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO global_row
  FROM public.store_purchase_settings
  WHERE singleton = true;

  SELECT * INTO product_row
  FROM public.product_purchase_settings
  WHERE product_id = p_product_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'code', catalog_item->>'code',
      'label', catalog_item->>'label',
      'price', COALESCE(NULLIF(product_patch->>'price','')::numeric, global_row.patch_default_price)
    ) ORDER BY catalog_ord
  ), '[]'::jsonb)
  INTO resolved_patches
  FROM jsonb_array_elements(global_row.patch_catalog) WITH ORDINALITY AS c(catalog_item, catalog_ord)
  JOIN LATERAL (
    SELECT value AS product_patch
    FROM jsonb_array_elements(COALESCE(product_row.patches, '[]'::jsonb))
    WHERE value->>'code' = catalog_item->>'code'
      AND COALESCE((value->>'enabled')::boolean, true)
    LIMIT 1
  ) enabled_patch ON true;

  RETURN jsonb_build_object(
    'sizes', to_jsonb(global_row.sizes),
    'personalizationPrice', global_row.personalization_price,
    'personalizationNameMax', global_row.personalization_name_max,
    'phrasePrice', global_row.phrase_price,
    'phraseMax', global_row.phrase_max,
    'patchDefaultPrice', global_row.patch_default_price,
    'productionBusinessDays', global_row.production_business_days,
    'deliveryMinBusinessDays', global_row.delivery_min_business_days,
    'deliveryMaxBusinessDays', global_row.delivery_max_business_days,
    'commercialType', COALESCE(product_row.commercial_type, 'other'),
    'sizeEnabled', COALESCE(product_row.size_enabled, true),
    'personalizationEnabled', COALESCE(product_row.personalization_enabled, true),
    'phraseEnabled', COALESCE(product_row.phrase_enabled, true),
    'patches', resolved_patches
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_product_purchase_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_purchase_config(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_product_purchase_customization(
  p_product_id uuid,
  p_customization jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  config jsonb := public.get_product_purchase_config(p_product_id);
  raw jsonb := COALESCE(p_customization, '{}'::jsonb);
  normalized jsonb := '{}'::jsonb;
  selected_options jsonb := '[]'::jsonb;
  surcharge numeric(12,2) := 0;
  size_value text;
  personalization jsonb;
  personalization_name text;
  personalization_number text;
  phrase_value text;
  patch_code text;
  patch_row jsonb;
  patch_price numeric(12,2);
  name_limit integer := (config->>'personalizationNameMax')::integer;
  phrase_limit integer := (config->>'phraseMax')::integer;
BEGIN
  IF jsonb_typeof(raw) <> 'object' OR length(raw::text) > 3000 THEN
    RAISE EXCEPTION 'Personalização inválida';
  END IF;

  IF COALESCE((config->>'sizeEnabled')::boolean, false) THEN
    size_value := upper(btrim(COALESCE(raw->>'size', '')));
    IF size_value = '' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(config->'sizes') s(value)
      WHERE upper(value) = size_value
    ) THEN
      RAISE EXCEPTION 'Escolha um tamanho válido';
    END IF;
    normalized := normalized || jsonb_build_object('size', size_value);
    selected_options := selected_options || jsonb_build_array(jsonb_build_object(
      'option_id', 'purchase-size',
      'option_name', 'Tamanho',
      'option_kind', 'size',
      'value_id', lower(size_value),
      'value_label', size_value,
      'price_addition', 0
    ));
  ELSE
    normalized := normalized || jsonb_build_object('size', NULL);
  END IF;

  personalization := raw->'personalization';
  phrase_value := NULLIF(btrim(COALESCE(raw->>'phrase', '')), '');

  IF personalization IS NOT NULL AND personalization <> 'null'::jsonb THEN
    IF NOT COALESCE((config->>'personalizationEnabled')::boolean, false) THEN
      RAISE EXCEPTION 'Personalização comum não disponível';
    END IF;
    IF jsonb_typeof(personalization) <> 'object' THEN
      RAISE EXCEPTION 'Personalização inválida';
    END IF;
    IF phrase_value IS NOT NULL THEN
      RAISE EXCEPTION 'Escolha personalização comum ou frase personalizada';
    END IF;

    personalization_name := NULLIF(btrim(COALESCE(personalization->>'name', '')), '');
    personalization_number := NULLIF(btrim(COALESCE(personalization->>'number', '')), '');

    IF personalization_name IS NULL OR char_length(personalization_name) > name_limit THEN
      RAISE EXCEPTION 'Nome personalizado inválido';
    END IF;
    IF personalization_number IS NULL OR personalization_number !~ '^[0-9]{1,3}$' THEN
      RAISE EXCEPTION 'Número personalizado inválido';
    END IF;

    surcharge := surcharge + (config->>'personalizationPrice')::numeric;
    normalized := normalized || jsonb_build_object(
      'personalization', jsonb_build_object('name', personalization_name, 'number', personalization_number),
      'phrase', NULL
    );
    selected_options := selected_options || jsonb_build_array(
      jsonb_build_object(
        'option_id', 'purchase-personalization-name',
        'option_name', 'Nome personalizado',
        'option_kind', 'other',
        'value_id', 'custom-name',
        'value_label', personalization_name,
        'price_addition', (config->>'personalizationPrice')::numeric
      ),
      jsonb_build_object(
        'option_id', 'purchase-personalization-number',
        'option_name', 'Número',
        'option_kind', 'other',
        'value_id', 'custom-number',
        'value_label', personalization_number,
        'price_addition', 0
      )
    );
  ELSE
    normalized := normalized || jsonb_build_object('personalization', NULL);
  END IF;

  IF phrase_value IS NOT NULL THEN
    IF NOT COALESCE((config->>'phraseEnabled')::boolean, false) THEN
      RAISE EXCEPTION 'Frase personalizada não disponível';
    END IF;
    IF char_length(phrase_value) > phrase_limit THEN
      RAISE EXCEPTION 'Frase personalizada muito longa';
    END IF;
    surcharge := surcharge + (config->>'phrasePrice')::numeric;
    normalized := normalized || jsonb_build_object('phrase', phrase_value, 'personalization', NULL);
    selected_options := selected_options || jsonb_build_array(jsonb_build_object(
      'option_id', 'purchase-phrase',
      'option_name', 'Frase personalizada',
      'option_kind', 'other',
      'value_id', 'custom-phrase',
      'value_label', phrase_value,
      'price_addition', (config->>'phrasePrice')::numeric
    ));
  ELSIF NOT (normalized ? 'phrase') THEN
    normalized := normalized || jsonb_build_object('phrase', NULL);
  END IF;

  patch_code := NULLIF(btrim(COALESCE(raw->>'patchCode', '')), '');
  IF patch_code IS NOT NULL THEN
    SELECT value INTO patch_row
    FROM jsonb_array_elements(config->'patches')
    WHERE value->>'code' = patch_code
    LIMIT 1;

    IF patch_row IS NULL THEN
      RAISE EXCEPTION 'Patch indisponível para este produto';
    END IF;
    patch_price := (patch_row->>'price')::numeric;
    surcharge := surcharge + patch_price;
    normalized := normalized || jsonb_build_object('patchCode', patch_code);
    selected_options := selected_options || jsonb_build_array(jsonb_build_object(
      'option_id', 'purchase-patch',
      'option_name', 'Patch',
      'option_kind', 'other',
      'value_id', patch_code,
      'value_label', patch_row->>'label',
      'price_addition', patch_price
    ));
  ELSE
    normalized := normalized || jsonb_build_object('patchCode', NULL);
  END IF;

  RETURN jsonb_build_object(
    'normalized', normalized,
    'surcharge', round(surcharge, 2),
    'selectedOptions', selected_options
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_product_purchase_customization(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_product_purchase_customization(uuid, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_get_product_purchase_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.store_purchase_settings%ROWTYPE;
  products_json jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT * INTO settings_row FROM public.store_purchase_settings WHERE singleton = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'productId', p.id,
    'name', p.name,
    'sku', p.sku,
    'price', p.price,
    'commercialType', COALESCE(s.commercial_type, 'other'),
    'sizeEnabled', COALESCE(s.size_enabled, true),
    'personalizationEnabled', COALESCE(s.personalization_enabled, true),
    'phraseEnabled', COALESCE(s.phrase_enabled, true),
    'patches', COALESCE(s.patches, '[]'::jsonb)
  ) ORDER BY p.name), '[]'::jsonb)
  INTO products_json
  FROM public.products p
  LEFT JOIN public.product_purchase_settings s ON s.product_id = p.id
  WHERE p.status <> 'archived'::public.product_status;

  RETURN jsonb_build_object(
    'global', jsonb_build_object(
      'sizes', to_jsonb(settings_row.sizes),
      'personalizationPrice', settings_row.personalization_price,
      'personalizationNameMax', settings_row.personalization_name_max,
      'phrasePrice', settings_row.phrase_price,
      'phraseMax', settings_row.phrase_max,
      'patchDefaultPrice', settings_row.patch_default_price,
      'patchCatalog', settings_row.patch_catalog,
      'productionBusinessDays', settings_row.production_business_days,
      'deliveryMinBusinessDays', settings_row.delivery_min_business_days,
      'deliveryMaxBusinessDays', settings_row.delivery_max_business_days,
      'productTypePrices', settings_row.product_type_prices
    ),
    'products', products_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_get_product_purchase_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_get_product_purchase_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_save_store_purchase_settings(
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
  key text;
  required_keys text[] := ARRAY['torcedor','feminino','jogador','retro','infantil','calcao','basquete'];
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
  FOREACH key IN ARRAY required_keys LOOP
    IF NOT (p_product_type_prices ? key)
       OR (p_product_type_prices->>key)::numeric <= 0 THEN
      RAISE EXCEPTION 'Preço inválido para %', key;
    END IF;
  END LOOP;

  UPDATE public.store_purchase_settings
  SET personalization_price = round(p_personalization_price, 2),
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

  RETURN public.owner_get_product_purchase_admin();
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_store_purchase_settings(numeric, integer, numeric, integer, numeric, integer, integer, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_store_purchase_settings(numeric, integer, numeric, integer, numeric, integer, integer, integer, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_save_product_purchase_settings(
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
  settings_row public.store_purchase_settings%ROWTYPE;
  target_price numeric;
  patch_item jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_commercial_type NOT IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete','other') THEN
    RAISE EXCEPTION 'Tipo comercial inválido';
  END IF;
  IF jsonb_typeof(COALESCE(p_patches, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_patches, '[]'::jsonb)) > 30 THEN
    RAISE EXCEPTION 'Configuração de patches inválida';
  END IF;

  SELECT * INTO settings_row FROM public.store_purchase_settings WHERE singleton = true;

  FOR patch_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_patches, '[]'::jsonb)) LOOP
    IF NULLIF(btrim(COALESCE(patch_item->>'code','')), '') IS NULL THEN
      RAISE EXCEPTION 'Patch inválido';
    END IF;
    IF patch_item ? 'price' AND patch_item->>'price' IS NOT NULL AND (patch_item->>'price')::numeric < 0 THEN
      RAISE EXCEPTION 'Preço de patch inválido';
    END IF;
  END LOOP;

  INSERT INTO public.product_purchase_settings (
    product_id, commercial_type, size_enabled, personalization_enabled, phrase_enabled,
    patches, updated_at, updated_by
  ) VALUES (
    p_product_id, p_commercial_type, p_size_enabled, p_personalization_enabled,
    p_phrase_enabled, COALESCE(p_patches, '[]'::jsonb), now(), auth.uid()
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
    target_price := (settings_row.product_type_prices->>p_commercial_type)::numeric;
    IF target_price IS NULL OR target_price <= 0 THEN
      RAISE EXCEPTION 'Preço do tipo comercial não configurado';
    END IF;
    UPDATE public.products
    SET price = round(target_price, 2), promotional_price = NULL, updated_at = now()
    WHERE id = p_product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  END IF;

  RETURN public.owner_get_product_purchase_admin();
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_product_purchase_settings(uuid, text, boolean, boolean, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_product_purchase_settings(uuid, text, boolean, boolean, boolean, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_cart_items(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  result jsonb := '[]'::jsonb;
  product_row record;
  variant_row record;
  customization_result jsonb;
  product_id_value uuid;
  variant_id_value uuid;
  base_price numeric(12,2);
  final_price numeric(12,2);
  status_value text;
  line_value text;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' THEN RETURN '[]'::jsonb; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LIMIT 100 LOOP
    line_value := COALESCE(item->>'line_id','');
    product_id_value := NULL;
    variant_id_value := NULL;
    base_price := NULL;
    final_price := NULL;
    customization_result := NULL;
    status_value := 'unavailable';

    IF COALESCE(item->>'product_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      product_id_value := (item->>'product_id')::uuid;
    END IF;
    IF COALESCE(item->>'variant_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      variant_id_value := (item->>'variant_id')::uuid;
    END IF;

    SELECT p.id, p.slug, p.name, p.price, p.promotional_price
    INTO product_row
    FROM public.products p
    WHERE p.id = product_id_value AND p.status = 'active'::public.product_status;

    SELECT v.id, v.sku, v.name, v.stock_quantity, v.price_override, v.promotional_price_override
    INTO variant_row
    FROM public.product_variants v
    WHERE v.id = variant_id_value
      AND v.product_id = product_id_value
      AND v.status = 'active'::public.product_variant_status;

    IF product_row.id IS NOT NULL AND variant_row.id IS NOT NULL THEN
      base_price := COALESCE(
        variant_row.promotional_price_override,
        CASE WHEN variant_row.price_override IS NULL THEN product_row.promotional_price ELSE NULL END,
        variant_row.price_override,
        product_row.price
      );
      BEGIN
        customization_result := public.resolve_product_purchase_customization(
          product_id_value,
          COALESCE(item->'customization', '{}'::jsonb)
        );
        final_price := round(base_price + (customization_result->>'surcharge')::numeric, 2);
        status_value := CASE WHEN variant_row.stock_quantity <= 0 THEN 'out_of_stock' ELSE 'available' END;
      EXCEPTION WHEN OTHERS THEN
        status_value := 'needs_review';
      END;
    END IF;

    result := result || jsonb_build_array(jsonb_build_object(
      'line_id', line_value,
      'product_id', product_id_value,
      'product_slug', product_row.slug,
      'product_name', product_row.name,
      'variant_id', variant_id_value,
      'variant_sku', variant_row.sku,
      'variant_name', variant_row.name,
      'unit_price', final_price,
      'available_stock', variant_row.stock_quantity,
      'customization', customization_result->'normalized',
      'status', status_value
    ));
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_cart_items(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cart_items(jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_order_core(
  p_user_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_shipping jsonb DEFAULT NULL,
  p_payment jsonb DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_record record;
  address_record record;
  product_record record;
  variant_record record;
  item jsonb;
  product_id_value uuid;
  variant_id_value uuid;
  quantity_value integer;
  base_unit_price_value numeric(12,2);
  surcharge_value numeric(12,2);
  unit_price_value numeric(12,2);
  line_total_value numeric(12,2);
  subtotal_value numeric(12,2) := 0;
  discountable_subtotal_value numeric(12,2) := 0;
  total_units_value integer := 0;
  discount_percent_value smallint := 0;
  discount_value numeric(12,2) := 0;
  shipping_base_value numeric(12,2) := 0;
  shipping_additional_value numeric(12,2) := 0;
  shipping_discount_value numeric(12,2) := 0;
  shipping_total_value numeric(12,2) := 0;
  requested_shipping_total numeric(12,2) := 0;
  options_value jsonb;
  customization_result jsonb;
  image_storage_key_value text;
  image_alt_text_value text;
  resolved_items jsonb := '[]'::jsonb;
  resolved_item jsonb;
  normalized_idempotency_key text := NULLIF(btrim(p_idempotency_key), '');
  created_order public.orders%ROWTYPE;
BEGIN
  PERFORM p_discount_amount;
  IF p_user_id IS NULL OR p_address_id IS NULL THEN RAISE EXCEPTION 'Usuario e endereco sao obrigatorios'; END IF;
  IF normalized_idempotency_key IS NOT NULL AND length(normalized_idempotency_key) NOT BETWEEN 8 AND 120 THEN
    RAISE EXCEPTION 'Chave de idempotencia invalida';
  END IF;
  IF normalized_idempotency_key IS NOT NULL THEN
    SELECT o.* INTO created_order FROM public.orders o
    WHERE o.user_id = p_user_id AND o.idempotency_key = normalized_idempotency_key;
    IF FOUND THEN RETURN created_order; END IF;
  END IF;

  SELECT p.full_name, p.email, p.phone INTO profile_record
  FROM public.profiles p WHERE p.id = p_user_id;
  IF profile_record IS NULL
     OR length(btrim(COALESCE(profile_record.full_name,''))) < 2
     OR length(btrim(COALESCE(profile_record.email,''))) < 3
     OR COALESCE(profile_record.phone,'') !~ '^[0-9]{10,11}$' THEN
    RAISE EXCEPTION 'A conta precisa ter nome, email e telefone validos';
  END IF;

  SELECT a.* INTO address_record FROM public.customer_addresses a
  WHERE a.id = p_address_id AND a.user_id = p_user_id;
  IF address_record IS NULL THEN RAISE EXCEPTION 'Endereco de entrega invalido'; END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'O pedido precisa ter entre 1 e 100 itens';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE(item->>'product_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR COALESCE(item->>'variant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR COALESCE(item->>'quantity','') !~ '^[1-9][0-9]?$' THEN
      RAISE EXCEPTION 'Item do pedido invalido';
    END IF;

    product_id_value := (item->>'product_id')::uuid;
    variant_id_value := (item->>'variant_id')::uuid;
    quantity_value := (item->>'quantity')::integer;
    total_units_value := total_units_value + quantity_value;

    SELECT p.id,p.name,p.slug,p.sku,p.price,p.promotional_price,p.image_url
    INTO product_record FROM public.products p
    WHERE p.id = product_id_value AND p.status = 'active'::public.product_status;

    SELECT v.id,v.product_id,v.name,v.sku,v.price_override,v.promotional_price_override
    INTO variant_record FROM public.product_variants v
    WHERE v.id = variant_id_value AND v.product_id = product_id_value
      AND v.status = 'active'::public.product_variant_status;

    IF product_record IS NULL OR variant_record IS NULL THEN RAISE EXCEPTION 'Produto ou variante indisponivel'; END IF;

    base_unit_price_value := COALESCE(
      variant_record.promotional_price_override,
      CASE WHEN variant_record.price_override IS NULL THEN product_record.promotional_price ELSE NULL END,
      variant_record.price_override,
      product_record.price
    );

    customization_result := public.resolve_product_purchase_customization(
      product_id_value,
      COALESCE(item->'customization', '{}'::jsonb)
    );
    surcharge_value := (customization_result->>'surcharge')::numeric;
    unit_price_value := round(base_unit_price_value + surcharge_value, 2);
    line_total_value := unit_price_value * quantity_value;
    subtotal_value := subtotal_value + line_total_value;
    discountable_subtotal_value := discountable_subtotal_value + (base_unit_price_value * quantity_value);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'option_id', o.id,
      'option_name', o.name,
      'option_kind', o.kind,
      'value_id', ov.id,
      'value_label', ov.value,
      'price_addition', 0
    ) ORDER BY o.sort_order,o.name), '[]'::jsonb)
    INTO options_value
    FROM public.product_variant_values r
    JOIN public.product_options o ON o.id = r.option_id
    JOIN public.product_option_values ov ON ov.id = r.option_value_id
    WHERE r.variant_id = variant_id_value;

    options_value := options_value || COALESCE(customization_result->'selectedOptions','[]'::jsonb);

    SELECT pi.storage_key, pi.alt_text INTO image_storage_key_value, image_alt_text_value
    FROM public.product_images pi
    WHERE pi.product_id = product_id_value
      AND pi.status = 'ready'::public.product_image_status
      AND (pi.variant_id = variant_id_value OR pi.variant_id IS NULL)
    ORDER BY CASE WHEN pi.variant_id = variant_id_value THEN 0 ELSE 1 END,
             pi.is_primary DESC, pi.sort_order, pi.created_at
    LIMIT 1;

    resolved_items := resolved_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_id_value,
      'variant_id', variant_id_value,
      'product_name', product_record.name,
      'product_slug', product_record.slug,
      'product_sku', product_record.sku,
      'variant_name', variant_record.name,
      'variant_sku', variant_record.sku,
      'selected_options', options_value,
      'image_storage_key', image_storage_key_value,
      'image_url', product_record.image_url,
      'image_alt_text', COALESCE(image_alt_text_value, product_record.name),
      'quantity', quantity_value,
      'unit_price', unit_price_value,
      'line_total', line_total_value
    ));
    image_storage_key_value := NULL;
    image_alt_text_value := NULL;
  END LOOP;

  discount_percent_value := public.bigofertas_progressive_discount_percent(total_units_value);
  discount_value := round(discountable_subtotal_value * discount_percent_value::numeric / 100, 2);

  IF p_shipping IS NOT NULL THEN
    IF jsonb_typeof(p_shipping) <> 'object' THEN RAISE EXCEPTION 'Snapshot de frete invalido'; END IF;
    shipping_base_value := COALESCE(NULLIF(p_shipping->>'base_amount','')::numeric,0);
    shipping_additional_value := COALESCE(NULLIF(p_shipping->>'additional_amount','')::numeric,0);
    requested_shipping_total := COALESCE(NULLIF(p_shipping->>'amount','')::numeric, shipping_base_value + shipping_additional_value);
  END IF;
  IF shipping_base_value < 0 OR shipping_additional_value < 0 THEN RAISE EXCEPTION 'Valores de frete invalidos'; END IF;

  IF total_units_value >= 45 THEN
    shipping_discount_value := shipping_base_value + shipping_additional_value;
    shipping_total_value := 0;
  ELSE
    shipping_discount_value := 0;
    shipping_total_value := requested_shipping_total;
    IF shipping_total_value <> shipping_base_value + shipping_additional_value THEN RAISE EXCEPTION 'Valores de frete invalidos'; END IF;
  END IF;

  INSERT INTO public.orders (
    public_number,user_id,source_address_id,idempotency_key,
    customer_name,customer_email,customer_phone,
    address_recipient_name,address_postal_code,address_street,address_number,address_complement,
    address_neighborhood,address_city,address_state,
    subtotal_amount,discount_amount,discount_percent,
    shipping_base_amount,shipping_additional_amount,shipping_discount_amount,shipping_amount,total_amount,
    shipping_provider,shipping_service,shipping_quote_reference,shipping_transit_business_days,shipping_quoted_at,
    payment_provider,payment_reference,payment_method
  ) VALUES (
    public.next_order_public_number(),p_user_id,p_address_id,normalized_idempotency_key,
    btrim(profile_record.full_name),btrim(profile_record.email),profile_record.phone,
    address_record.recipient_name,address_record.postal_code,address_record.street,address_record.number,address_record.complement,
    address_record.neighborhood,address_record.city,address_record.state,
    subtotal_value,discount_value,discount_percent_value,
    shipping_base_value,shipping_additional_value,shipping_discount_value,shipping_total_value,
    subtotal_value - discount_value + shipping_total_value,
    NULLIF(btrim(p_shipping->>'provider'),''),NULLIF(btrim(p_shipping->>'service'),''),
    NULLIF(btrim(p_shipping->>'quote_reference'),''),NULLIF(p_shipping->>'transit_business_days','')::smallint,
    NULLIF(p_shipping->>'quoted_at','')::timestamptz,
    NULLIF(btrim(p_payment->>'provider'),''),NULLIF(btrim(p_payment->>'reference'),''),NULLIF(btrim(p_payment->>'method'),'')
  )
  ON CONFLICT (user_id,idempotency_key) DO NOTHING
  RETURNING * INTO created_order;

  IF created_order.id IS NULL THEN
    SELECT o.* INTO created_order FROM public.orders o
    WHERE o.user_id = p_user_id AND o.idempotency_key = normalized_idempotency_key;
    RETURN created_order;
  END IF;

  FOR resolved_item IN SELECT value FROM jsonb_array_elements(resolved_items) LOOP
    INSERT INTO public.order_items (
      order_id,product_id,variant_id,product_name,product_slug,product_sku,variant_name,variant_sku,
      selected_options,image_storage_key,image_url,image_alt_text,quantity,unit_price,line_total
    ) VALUES (
      created_order.id,
      (resolved_item->>'product_id')::uuid,(resolved_item->>'variant_id')::uuid,
      resolved_item->>'product_name',resolved_item->>'product_slug',resolved_item->>'product_sku',
      NULLIF(resolved_item->>'variant_name',''),resolved_item->>'variant_sku',resolved_item->'selected_options',
      NULLIF(resolved_item->>'image_storage_key',''),NULLIF(resolved_item->>'image_url',''),
      NULLIF(resolved_item->>'image_alt_text',''),(resolved_item->>'quantity')::integer,
      (resolved_item->>'unit_price')::numeric,(resolved_item->>'line_total')::numeric
    );
  END LOOP;

  INSERT INTO public.order_timeline (order_id,status,note)
  VALUES (created_order.id,'pending'::public.order_status,'Pedido criado');

  RETURN created_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) TO service_role;

COMMIT;
