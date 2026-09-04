from pathlib import Path
import textwrap

ROOT = Path('.')

def write(path: str, content: str):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).lstrip(), encoding='utf-8')


def replace_once(path: str, old: str, new: str):
    target = ROOT / path
    content = target.read_text(encoding='utf-8')
    if old not in content:
        raise RuntimeError(f'Pattern not found in {path}: {old[:100]!r}')
    target.write_text(content.replace(old, new, 1), encoding='utf-8')


MIGRATION = r'''
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
'''

write('supabase/migrations/20260904190000_product_purchase_options.sql', MIGRATION)

write('src/lib/product-purchase.ts', r'''
import { supabase } from "@/integrations/supabase/client";

export type ProductCommercialType =
  | "torcedor"
  | "feminino"
  | "jogador"
  | "retro"
  | "infantil"
  | "calcao"
  | "basquete"
  | "other";

export type PurchaseCustomization = {
  size: string | null;
  personalization: { name: string; number: string } | null;
  phrase: string | null;
  patchCode: string | null;
};

export type PurchasePatch = {
  code: string;
  label: string;
  price: number;
};

export type ProductPurchaseConfig = {
  sizes: string[];
  personalizationPrice: number;
  personalizationNameMax: number;
  phrasePrice: number;
  phraseMax: number;
  patchDefaultPrice: number;
  productionBusinessDays: number;
  deliveryMinBusinessDays: number;
  deliveryMaxBusinessDays: number;
  commercialType: ProductCommercialType;
  sizeEnabled: boolean;
  personalizationEnabled: boolean;
  phraseEnabled: boolean;
  patches: PurchasePatch[];
};

export const EMPTY_PURCHASE_CUSTOMIZATION: PurchaseCustomization = {
  size: null,
  personalization: null,
  phrase: null,
  patchCode: null,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizePurchaseCustomization(value: unknown): PurchaseCustomization {
  const row = record(value);
  const personalizationRow = record(row.personalization);
  const name = typeof personalizationRow.name === "string" ? personalizationRow.name.trim() : "";
  const number = typeof personalizationRow.number === "string" ? personalizationRow.number.trim() : "";
  return {
    size: typeof row.size === "string" && row.size.trim() ? row.size.trim().toUpperCase() : null,
    personalization: name || number ? { name, number } : null,
    phrase: typeof row.phrase === "string" && row.phrase.trim() ? row.phrase.trim() : null,
    patchCode:
      typeof row.patchCode === "string" && row.patchCode.trim() ? row.patchCode.trim() : null,
  };
}

function normalizeConfig(value: unknown): ProductPurchaseConfig {
  const row = record(value);
  const allowedTypes: ProductCommercialType[] = [
    "torcedor", "feminino", "jogador", "retro", "infantil", "calcao", "basquete", "other",
  ];
  const commercialType = allowedTypes.includes(row.commercialType as ProductCommercialType)
    ? (row.commercialType as ProductCommercialType)
    : "other";
  return {
    sizes: Array.isArray(row.sizes)
      ? row.sizes.filter((item): item is string => typeof item === "string")
      : ["P", "M", "G", "GG", "2GG", "3GG", "4XL"],
    personalizationPrice: numberValue(row.personalizationPrice, 25),
    personalizationNameMax: numberValue(row.personalizationNameMax, 12),
    phrasePrice: numberValue(row.phrasePrice, 45),
    phraseMax: numberValue(row.phraseMax, 50),
    patchDefaultPrice: numberValue(row.patchDefaultPrice, 15),
    productionBusinessDays: numberValue(row.productionBusinessDays, 5),
    deliveryMinBusinessDays: numberValue(row.deliveryMinBusinessDays, 15),
    deliveryMaxBusinessDays: numberValue(row.deliveryMaxBusinessDays, 25),
    commercialType,
    sizeEnabled: row.sizeEnabled !== false,
    personalizationEnabled: row.personalizationEnabled !== false,
    phraseEnabled: row.phraseEnabled !== false,
    patches: Array.isArray(row.patches)
      ? row.patches.flatMap((item) => {
          const patch = record(item);
          return typeof patch.code === "string" && typeof patch.label === "string"
            ? [{ code: patch.code, label: patch.label, price: numberValue(patch.price, 15) }]
            : [];
        })
      : [],
  };
}

export async function fetchProductPurchaseConfig(productId: string) {
  const { data, error } = await (supabase as any).rpc("get_product_purchase_config", {
    p_product_id: productId,
  });
  if (error) throw error;
  return normalizeConfig(data);
}

export function calculatePurchaseSurcharge(
  config: ProductPurchaseConfig,
  customization: PurchaseCustomization,
) {
  let total = 0;
  if (customization.personalization) total += config.personalizationPrice;
  if (customization.phrase) total += config.phrasePrice;
  if (customization.patchCode) {
    total += config.patches.find((patch) => patch.code === customization.patchCode)?.price ?? 0;
  }
  return total;
}

export function validatePurchaseCustomization(
  config: ProductPurchaseConfig,
  customization: PurchaseCustomization,
) {
  if (config.sizeEnabled && (!customization.size || !config.sizes.includes(customization.size))) {
    return "Escolha o tamanho da peça.";
  }
  if (customization.personalization && customization.phrase) {
    return "Escolha personalização comum ou frase personalizada.";
  }
  if (customization.personalization) {
    if (!customization.personalization.name.trim()) return "Informe o nome da personalização.";
    if (customization.personalization.name.trim().length > config.personalizationNameMax) {
      return `O nome pode ter no máximo ${config.personalizationNameMax} caracteres.`;
    }
    if (!/^\d{1,3}$/.test(customization.personalization.number)) {
      return "Informe um número válido para a personalização.";
    }
  }
  if (customization.phrase && customization.phrase.length > config.phraseMax) {
    return `A frase pode ter no máximo ${config.phraseMax} caracteres.`;
  }
  if (
    customization.patchCode &&
    !config.patches.some((patch) => patch.code === customization.patchCode)
  ) {
    return "Escolha um patch disponível para este produto.";
  }
  return null;
}

export function customizationToCartOptions(
  config: ProductPurchaseConfig,
  customization: PurchaseCustomization,
) {
  const options: Array<{
    optionId: string;
    optionName: string;
    optionKind: "size" | "style" | "color" | "other";
    valueId: string;
    valueLabel: string;
  }> = [];
  if (customization.size) {
    options.push({ optionId: "purchase-size", optionName: "Tamanho", optionKind: "size", valueId: customization.size.toLowerCase(), valueLabel: customization.size });
  }
  if (customization.personalization) {
    options.push({ optionId: "purchase-name", optionName: "Nome personalizado", optionKind: "other", valueId: "custom-name", valueLabel: customization.personalization.name });
    options.push({ optionId: "purchase-number", optionName: "Número", optionKind: "other", valueId: "custom-number", valueLabel: customization.personalization.number });
  }
  if (customization.phrase) {
    options.push({ optionId: "purchase-phrase", optionName: "Frase personalizada", optionKind: "other", valueId: "custom-phrase", valueLabel: customization.phrase });
  }
  if (customization.patchCode) {
    const patch = config.patches.find((item) => item.code === customization.patchCode);
    if (patch) options.push({ optionId: "purchase-patch", optionName: "Patch", optionKind: "other", valueId: patch.code, valueLabel: patch.label });
  }
  return options;
}
''')

write('src/lib/admin-product-purchase.ts', r'''
import { callSupabaseRpc } from "@/lib/supabase-rpc";
import type { ProductCommercialType } from "@/lib/product-purchase";

export type PurchaseGlobalAdmin = {
  sizes: string[];
  personalizationPrice: number;
  personalizationNameMax: number;
  phrasePrice: number;
  phraseMax: number;
  patchDefaultPrice: number;
  patchCatalog: Array<{ code: string; label: string }>;
  productionBusinessDays: number;
  deliveryMinBusinessDays: number;
  deliveryMaxBusinessDays: number;
  productTypePrices: Record<string, number>;
};

export type PurchaseProductAdmin = {
  productId: string;
  name: string;
  sku: string;
  price: number;
  commercialType: ProductCommercialType;
  sizeEnabled: boolean;
  personalizationEnabled: boolean;
  phraseEnabled: boolean;
  patches: Array<{ code: string; enabled?: boolean; price?: number | null }>;
};

export type PurchaseAdminSnapshot = {
  global: PurchaseGlobalAdmin;
  products: PurchaseProductAdmin[];
};

export function fetchPurchaseAdminSnapshot() {
  return callSupabaseRpc<PurchaseAdminSnapshot>("owner_get_product_purchase_admin");
}

export function savePurchaseGlobal(input: PurchaseGlobalAdmin) {
  return callSupabaseRpc<PurchaseAdminSnapshot>("owner_save_store_purchase_settings", {
    p_personalization_price: input.personalizationPrice,
    p_personalization_name_max: input.personalizationNameMax,
    p_phrase_price: input.phrasePrice,
    p_phrase_max: input.phraseMax,
    p_patch_default_price: input.patchDefaultPrice,
    p_production_business_days: input.productionBusinessDays,
    p_delivery_min_business_days: input.deliveryMinBusinessDays,
    p_delivery_max_business_days: input.deliveryMaxBusinessDays,
    p_product_type_prices: input.productTypePrices,
  });
}

export function saveProductPurchaseSettings(input: PurchaseProductAdmin) {
  return callSupabaseRpc<PurchaseAdminSnapshot>("owner_save_product_purchase_settings", {
    p_product_id: input.productId,
    p_commercial_type: input.commercialType,
    p_size_enabled: input.sizeEnabled,
    p_personalization_enabled: input.personalizationEnabled,
    p_phrase_enabled: input.phraseEnabled,
    p_patches: input.patches,
  });
}
''')

write('src/components/product/ProductPurchaseOptions.tsx', r'''
import type { ProductPurchaseConfig, PurchaseCustomization } from "@/lib/product-purchase";
import { calculatePurchaseSurcharge } from "@/lib/product-purchase";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ProductPurchaseOptions({
  config,
  value,
  onChange,
}: {
  config: ProductPurchaseConfig;
  value: PurchaseCustomization;
  onChange: (next: PurchaseCustomization) => void;
}) {
  const surcharge = calculatePurchaseSurcharge(config, value);
  const normalEnabled = Boolean(value.personalization);
  const phraseEnabled = Boolean(value.phrase);

  return (
    <div className="space-y-5 border-t border-gray-100 py-6">
      {config.sizeEnabled ? (
        <fieldset>
          <legend className="mb-3 text-xs font-black uppercase tracking-widest text-gray-800">
            Tamanho <span className="text-red-600">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {config.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ ...value, size })}
                className={`min-h-11 min-w-12 rounded-md border px-4 py-2 text-sm font-bold transition-colors ${
                  value.size === size
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gray-300 bg-white text-gray-800 hover:border-red-600"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-gray-500">O tamanho não altera o preço do produto.</p>
        </fieldset>
      ) : null}

      {config.personalizationEnabled ? (
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-gray-800" htmlFor="personalizar">
            Personalizar
          </label>
          <select
            id="personalizar"
            className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
            value={normalEnabled ? "yes" : "no"}
            onChange={(event) =>
              onChange(
                event.target.value === "yes"
                  ? { ...value, personalization: { name: "", number: "" }, phrase: null }
                  : { ...value, personalization: null },
              )
            }
          >
            <option value="no">Não</option>
            <option value="yes">Sim (+{currency.format(config.personalizationPrice)})</option>
          </select>
          {normalEnabled ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
              <label className="text-sm font-semibold text-gray-700">
                Nome
                <input
                  value={value.personalization?.name ?? ""}
                  maxLength={config.personalizationNameMax}
                  onChange={(event) => onChange({
                    ...value,
                    personalization: { name: event.target.value, number: value.personalization?.number ?? "" },
                  })}
                  className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 outline-none focus:border-red-500"
                  placeholder={`Até ${config.personalizationNameMax} caracteres`}
                />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Número
                <input
                  inputMode="numeric"
                  maxLength={3}
                  value={value.personalization?.number ?? ""}
                  onChange={(event) => onChange({
                    ...value,
                    personalization: { name: value.personalization?.name ?? "", number: event.target.value.replace(/\D/g, "").slice(0, 3) },
                  })}
                  className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 outline-none focus:border-red-500"
                  placeholder="Ex.: 10"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="text-xs font-black uppercase tracking-widest text-gray-800" htmlFor="patch">
          Patch
        </label>
        <select
          id="patch"
          className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
          value={value.patchCode ?? ""}
          onChange={(event) => onChange({ ...value, patchCode: event.target.value || null })}
        >
          <option value="">Sem patch</option>
          {config.patches.map((patch) => (
            <option key={patch.code} value={patch.code}>
              {patch.label} (+{currency.format(patch.price)})
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-amber-700">Escolha com atenção: os patches disponíveis variam conforme o produto.</p>
      </div>

      {config.phraseEnabled ? (
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-gray-800" htmlFor="frase-personalizada">
            Frase personalizada
          </label>
          <select
            id="frase-personalizada"
            className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
            value={phraseEnabled ? "yes" : "no"}
            onChange={(event) =>
              onChange(
                event.target.value === "yes"
                  ? { ...value, phrase: " ", personalization: null }
                  : { ...value, phrase: null },
              )
            }
          >
            <option value="no">Não</option>
            <option value="yes">Sim (+{currency.format(config.phrasePrice)})</option>
          </select>
          {phraseEnabled ? (
            <label className="mt-3 block text-sm font-semibold text-gray-700">
              Frase personalizada
              <textarea
                maxLength={config.phraseMax}
                value={value.phrase?.trimStart() ?? ""}
                onChange={(event) => onChange({ ...value, phrase: event.target.value })}
                className="mt-1 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-red-500"
                placeholder={`Até ${config.phraseMax} caracteres, sem número separado`}
              />
              <span className="mt-1 block text-right text-xs font-medium text-gray-400">
                {(value.phrase?.trimStart().length ?? 0)}/{config.phraseMax}
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {surcharge > 0 ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          Adicionais desta peça: +{currency.format(surcharge)}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
        <strong className="text-gray-900">Prazo:</strong> preparação em até {config.productionBusinessDays} dias úteis após a confirmação do pagamento. Entrega estimada em {config.deliveryMinBusinessDays} a {config.deliveryMaxBusinessDays} dias úteis, podendo variar conforme a localidade.
      </div>
    </div>
  );
}
''')

write('src/components/admin/ProductPurchaseAdmin.tsx', r'''
import { useEffect, useMemo, useState } from "react";
import {
  fetchPurchaseAdminSnapshot,
  saveProductPurchaseSettings,
  savePurchaseGlobal,
  type PurchaseAdminSnapshot,
  type PurchaseProductAdmin,
} from "@/lib/admin-product-purchase";
import type { ProductCommercialType } from "@/lib/product-purchase";

const TYPE_LABELS: Array<[ProductCommercialType, string]> = [
  ["torcedor", "Modelo torcedor"],
  ["feminino", "Modelo feminino"],
  ["jogador", "Modelo jogador"],
  ["retro", "Retrô"],
  ["infantil", "Infantil"],
  ["calcao", "Calção"],
  ["basquete", "Basquete"],
  ["other", "Outro / preço manual"],
];

function numberInput(value: number, onChange: (value: number) => void) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-red-500"
    />
  );
}

export function ProductPurchaseAdmin() {
  const [snapshot, setSnapshot] = useState<PurchaseAdminSnapshot | null>(null);
  const [globalDraft, setGlobalDraft] = useState<PurchaseAdminSnapshot["global"] | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productDraft, setProductDraft] = useState<PurchaseProductAdmin | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchPurchaseAdminSnapshot();
      setSnapshot(data);
      setGlobalDraft(data.global);
    } catch {
      setError("Não foi possível carregar as regras de tamanhos, personalização e patches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (snapshot?.products ?? []).filter((product) =>
      !term || `${product.name} ${product.sku}`.toLowerCase().includes(term),
    );
  }, [search, snapshot?.products]);

  useEffect(() => {
    if (!selectedProductId || !snapshot) { setProductDraft(null); return; }
    const found = snapshot.products.find((product) => product.productId === selectedProductId) ?? null;
    setProductDraft(found ? { ...found, patches: found.patches.map((patch) => ({ ...patch })) } : null);
  }, [selectedProductId, snapshot]);

  async function saveGlobalRules() {
    if (!globalDraft || saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const data = await savePurchaseGlobal(globalDraft);
      setSnapshot(data); setGlobalDraft(data.global);
      setMessage("Regras gerais atualizadas.");
    } catch {
      setError("Não foi possível salvar as regras gerais.");
    } finally { setSaving(false); }
  }

  async function saveProductRules() {
    if (!productDraft || saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const data = await saveProductPurchaseSettings(productDraft);
      setSnapshot(data); setGlobalDraft(data.global);
      setMessage("Regras do produto atualizadas.");
    } catch {
      setError("Não foi possível salvar as regras deste produto.");
    } finally { setSaving(false); }
  }

  if (loading) return <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Carregando regras de venda...</section>;
  if (!snapshot || !globalDraft) return <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || "Regras de venda indisponíveis."}</section>;

  return (
    <section className="mt-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-gray-950">Tamanhos, personalização e patches</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">Edite os valores gerais da loja e, abaixo, escolha exatamente o que cada produto oferece.</p>
      </div>

      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-black text-gray-950">Regras gerais</h3>
        <p className="mt-1 text-sm text-gray-500">Tamanhos fixos: P, M, G, GG, 2GG, 3GG e 4XL. Tamanho nunca muda o preço.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold">Personalização comum (R$){numberInput(globalDraft.personalizationPrice, (value) => setGlobalDraft({ ...globalDraft, personalizationPrice: value }))}</label>
          <label className="text-sm font-semibold">Limite do nome{numberInput(globalDraft.personalizationNameMax, (value) => setGlobalDraft({ ...globalDraft, personalizationNameMax: Math.round(value) }))}</label>
          <label className="text-sm font-semibold">Frase estendida (R$){numberInput(globalDraft.phrasePrice, (value) => setGlobalDraft({ ...globalDraft, phrasePrice: value }))}</label>
          <label className="text-sm font-semibold">Limite da frase{numberInput(globalDraft.phraseMax, (value) => setGlobalDraft({ ...globalDraft, phraseMax: Math.round(value) }))}</label>
          <label className="text-sm font-semibold">Patch padrão (R$){numberInput(globalDraft.patchDefaultPrice, (value) => setGlobalDraft({ ...globalDraft, patchDefaultPrice: value }))}</label>
          <label className="text-sm font-semibold">Preparação (dias úteis){numberInput(globalDraft.productionBusinessDays, (value) => setGlobalDraft({ ...globalDraft, productionBusinessDays: Math.round(value) }))}</label>
          <label className="text-sm font-semibold">Entrega mínima (dias úteis){numberInput(globalDraft.deliveryMinBusinessDays, (value) => setGlobalDraft({ ...globalDraft, deliveryMinBusinessDays: Math.round(value) }))}</label>
          <label className="text-sm font-semibold">Entrega máxima (dias úteis){numberInput(globalDraft.deliveryMaxBusinessDays, (value) => setGlobalDraft({ ...globalDraft, deliveryMaxBusinessDays: Math.round(value) }))}</label>
        </div>

        <h4 className="mt-6 font-black text-gray-950">Preço fixo por modelo</h4>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TYPE_LABELS.filter(([type]) => type !== "other").map(([type, label]) => (
            <label key={type} className="text-sm font-semibold">{label} (R$){numberInput(globalDraft.productTypePrices[type] ?? 0, (value) => setGlobalDraft({ ...globalDraft, productTypePrices: { ...globalDraft.productTypePrices, [type]: value } }))}</label>
          ))}
        </div>
        <button type="button" disabled={saving} onClick={() => void saveGlobalRules()} className="mt-6 h-10 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50">Salvar regras gerais</button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-black text-gray-950">Configuração individual por produto</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto por nome ou SKU" className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-red-500" />
          <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-red-500">
            <option value="">Selecione um produto</option>
            {filteredProducts.map((product) => <option key={product.productId} value={product.productId}>{product.name} — {product.sku}</option>)}
          </select>
        </div>

        {productDraft ? (
          <div className="mt-5 space-y-5 border-t border-gray-100 pt-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">Modelo comercial
                <select value={productDraft.commercialType} onChange={(event) => setProductDraft({ ...productDraft, commercialType: event.target.value as ProductCommercialType })} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  {TYPE_LABELS.map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                </select>
                <span className="mt-1 block text-xs text-gray-500">Ao salvar um modelo conhecido, o preço-base do produto recebe automaticamente o valor geral desse modelo.</span>
              </label>
              <div className="space-y-2 text-sm font-semibold">
                <label className="flex items-center gap-2"><input type="checkbox" checked={productDraft.sizeEnabled} onChange={(event) => setProductDraft({ ...productDraft, sizeEnabled: event.target.checked })} /> Exigir tamanho</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={productDraft.personalizationEnabled} onChange={(event) => setProductDraft({ ...productDraft, personalizationEnabled: event.target.checked })} /> Permitir personalização comum</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={productDraft.phraseEnabled} onChange={(event) => setProductDraft({ ...productDraft, phraseEnabled: event.target.checked })} /> Permitir frase personalizada</label>
              </div>
            </div>

            <div>
              <h4 className="font-black text-gray-950">Patches disponíveis neste produto</h4>
              <p className="mt-1 text-xs text-gray-500">Marque somente campeonatos que fazem sentido para a peça. O preço vazio usa o padrão geral.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {globalDraft.patchCatalog.map((patch) => {
                  const current = productDraft.patches.find((item) => item.code === patch.code);
                  const enabled = Boolean(current?.enabled ?? current);
                  return (
                    <div key={patch.code} className="rounded-lg border border-gray-200 p-3">
                      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={enabled} onChange={(event) => {
                        const others = productDraft.patches.filter((item) => item.code !== patch.code);
                        setProductDraft({ ...productDraft, patches: event.target.checked ? [...others, { code: patch.code, enabled: true, price: current?.price ?? null }] : others });
                      }} /> {patch.label}</label>
                      {enabled ? <input type="number" min="0" step="0.01" placeholder={`Padrão: R$ ${globalDraft.patchDefaultPrice.toFixed(2).replace('.', ',')}`} value={current?.price ?? ""} onChange={(event) => {
                        const others = productDraft.patches.filter((item) => item.code !== patch.code);
                        setProductDraft({ ...productDraft, patches: [...others, { code: patch.code, enabled: true, price: event.target.value ? Number(event.target.value) : null }] });
                      }} className="mt-2 h-9 w-full rounded-md border border-gray-300 px-2 text-sm" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <button type="button" disabled={saving} onClick={() => void saveProductRules()} className="h-10 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">Salvar este produto</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
''')

# Cart model: customization becomes part of the line identity and validation payload.
replace_once('src/lib/cart.ts',
'import type { Json } from "@/integrations/supabase/types";\n',
'import type { Json } from "@/integrations/supabase/types";\nimport { EMPTY_PURCHASE_CUSTOMIZATION, normalizePurchaseCustomization, type PurchaseCustomization } from "@/lib/product-purchase";\n')
replace_once('src/lib/cart.ts',
'  selectedOptions: CartOptionSnapshot[];\n  status: CartItemStatus;\n}',
'  selectedOptions: CartOptionSnapshot[];\n  customization: PurchaseCustomization;\n  status: CartItemStatus;\n}')
replace_once('src/lib/cart.ts',
'  selectedOptions: CartOptionSnapshot[];\n}\n\ninterface CartStorageEnvelope',
'  selectedOptions: CartOptionSnapshot[];\n  customization: PurchaseCustomization;\n}\n\ninterface CartStorageEnvelope')
replace_once('src/lib/cart.ts',
'export function createCartLineId(productId: string, variantId: string | null) {\n  return `${productId}::${variantId ?? "legacy"}`;\n}',
r'''function customizationFingerprint(customization: PurchaseCustomization) {
  const raw = JSON.stringify(normalizePurchaseCustomization(customization));
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createCartLineId(
  productId: string,
  variantId: string | null,
  customization: PurchaseCustomization = EMPTY_PURCHASE_CUSTOMIZATION,
) {
  return `${productId}::${variantId ?? "legacy"}::${customizationFingerprint(customization)}`;
}''')
replace_once('src/lib/cart.ts',
'  const availableStock = rawStock;\n  const imageUrl = nullableString(value["imageUrl"]);',
'  const availableStock = rawStock;\n  const imageUrl = nullableString(value["imageUrl"]);\n  const customization = normalizePurchaseCustomization(value["customization"]);')
replace_once('src/lib/cart.ts',
'    lineId: createCartLineId(productId, variantId),',
'    lineId: createCartLineId(productId, variantId, customization),')
replace_once('src/lib/cart.ts',
'    selectedOptions,\n    status,',
'    selectedOptions,\n    customization,\n    status,')
replace_once('src/lib/cart.ts',
'    selectedOptions: [],\n    status: "needs_review",',
'    selectedOptions: [],\n    customization: EMPTY_PURCHASE_CUSTOMIZATION,\n    status: "needs_review",')
replace_once('src/lib/cart.ts',
'    lineId: createCartLineId(input.productId, input.variantId),',
'    lineId: createCartLineId(input.productId, input.variantId, input.customization),')
replace_once('src/lib/cart.ts',
'    selectedOptions: input.selectedOptions,\n    status: "available",',
'    selectedOptions: input.selectedOptions,\n    customization: normalizePurchaseCustomization(input.customization),\n    status: "available",')
replace_once('src/lib/cart.ts',
'    variant_id: item.variantId,\n  }));',
'    variant_id: item.variantId,\n    customization: item.customization,\n  }));')
replace_once('src/lib/cart.ts',
'  status: CartItemStatus;\n}\n\nfunction isRecord',
'  customization: PurchaseCustomization;\n  status: CartItemStatus;\n}\n\nfunction isRecord')
replace_once('src/lib/cart.ts',
'        available_stock: null,\n        status:',
'        available_stock: null,\n        customization: normalizePurchaseCustomization(entry["customization"]),\n        status:')

# Cart context keeps server-normalized customization and line identity.
replace_once('src/context/CartContext.tsx',
'            lineId: createCartLineId(item.productId, resolvedVariantId),',
'            lineId: createCartLineId(item.productId, resolvedVariantId, result.customization),')
replace_once('src/context/CartContext.tsx',
'            availableStock,\n            quantity,',
'            availableStock,\n            customization: result.customization,\n            quantity,')

# Client checkout sends customization.
replace_once('src/lib/checkout.ts',
'      quantity: item.quantity,\n    };',
'      quantity: item.quantity,\n      customization: item.customization,\n    };')

# Edge checkout accepts and forwards customization without trusting client prices.
for checkout_path in ['supabase/functions/checkout-start/index.ts', 'src/lib/infinitepay-server.ts']:
    replace_once(checkout_path,
'  quantity: number;\n};',
'  quantity: number;\n  customization: Record<string, unknown>;\n};')

# Edge implementation uses dot keys, legacy server uses bracket keys: handle separately.
replace_once('supabase/functions/checkout-start/index.ts',
'    const quantity = (item as Record<string, unknown>).quantity;\n',
'    const quantity = (item as Record<string, unknown>).quantity;\n    const customizationRaw = (item as Record<string, unknown>).customization;\n    const customization = customizationRaw && typeof customizationRaw === "object" && !Array.isArray(customizationRaw)\n      ? (customizationRaw as Record<string, unknown>)\n      : {};\n    if (JSON.stringify(customization).length > 3000) {\n      throw new CheckoutError("Personalização inválida.", 400, "CHECKOUT_CART_INVALID");\n    }\n')
replace_once('supabase/functions/checkout-start/index.ts',
'    return { productId, variantId, quantity };',
'    return { productId, variantId, quantity, customization };')
replace_once('supabase/functions/checkout-start/index.ts',
'        quantity: item.quantity,\n      })),',
'        quantity: item.quantity,\n        customization: item.customization,\n      })),')

replace_once('src/lib/infinitepay-server.ts',
'    const quantity = itemRecord["quantity"];\n',
'    const quantity = itemRecord["quantity"];\n    const customizationRaw = itemRecord["customization"];\n    const customization = customizationRaw && typeof customizationRaw === "object" && !Array.isArray(customizationRaw)\n      ? (customizationRaw as Record<string, unknown>)\n      : {};\n    if (JSON.stringify(customization).length > 3000) {\n      throw new CheckoutError("Personalização inválida.", 400, "CHECKOUT_CART_INVALID");\n    }\n')
replace_once('src/lib/infinitepay-server.ts',
'    return { productId, variantId, quantity };',
'    return { productId, variantId, quantity, customization };')
replace_once('src/lib/infinitepay-server.ts',
'        quantity: item.quantity,\n      })),',
'        quantity: item.quantity,\n        customization: item.customization,\n      })),')

# Product page: fetch rules, render selectors, validate them, and add canonical customization to cart.
replace_once('src/routes/product/$id.tsx',
'import ProductGallery from "@/components/product/ProductGallery";\n',
'import ProductGallery from "@/components/product/ProductGallery";\nimport { ProductPurchaseOptions } from "@/components/product/ProductPurchaseOptions";\n')
replace_once('src/routes/product/$id.tsx',
'import { getProductGalleryItems } from "@/lib/product-images";\n',
'import { getProductGalleryItems } from "@/lib/product-images";\nimport {\n  EMPTY_PURCHASE_CUSTOMIZATION,\n  calculatePurchaseSurcharge,\n  customizationToCartOptions,\n  fetchProductPurchaseConfig,\n  validatePurchaseCustomization,\n} from "@/lib/product-purchase";\n')
replace_once('src/routes/product/$id.tsx',
'  const [selection, setSelection] = useState<Record<string, string>>({});\n',
'  const [selection, setSelection] = useState<Record<string, string>>({});\n  const [purchaseCustomization, setPurchaseCustomization] = useState(EMPTY_PURCHASE_CUSTOMIZATION);\n')
replace_once('src/routes/product/$id.tsx',
'    setQuantity(1);\n  }, [detail]);',
'    setQuantity(1);\n    setPurchaseCustomization(EMPTY_PURCHASE_CUSTOMIZATION);\n  }, [detail]);')
replace_once('src/routes/product/$id.tsx',
'  const relatedQuery = useQuery({',
r'''  const purchaseConfigQuery = useQuery({
    queryKey: ["product-purchase-config", product?.id],
    queryFn: () => fetchProductPurchaseConfig(product!.id),
    enabled: Boolean(product),
    staleTime: 60_000,
  });
  const purchaseConfig = purchaseConfigQuery.data ?? null;

  const relatedQuery = useQuery({''')
replace_once('src/routes/product/$id.tsx',
'  const selectedOptions = detail.options.flatMap((option) => {',
'  const variantSelectedOptions = detail.options.flatMap((option) => {')
replace_once('src/routes/product/$id.tsx',
'  const builtInSpecs = [',
r'''  const purchaseSurcharge = purchaseConfig
    ? calculatePurchaseSurcharge(purchaseConfig, purchaseCustomization)
    : 0;
  const finalUnitPrice = effectivePrice + purchaseSurcharge;
  const selectedOptions = purchaseConfig
    ? [...variantSelectedOptions, ...customizationToCartOptions(purchaseConfig, purchaseCustomization)]
    : variantSelectedOptions;

  const builtInSpecs = [''')
replace_once('src/routes/product/$id.tsx',
'    if (!selectedVariant || !selectionComplete) {\n      toast.error("Selecione as opções do produto antes de continuar.");\n      return;\n    }\n\n    addToCart(',
'    if (!selectedVariant || !selectionComplete) {\n      toast.error("Selecione as opções do produto antes de continuar.");\n      return;\n    }\n    if (!purchaseConfig) {\n      toast.error("As opções de compra ainda estão carregando.");\n      return;\n    }\n    const purchaseError = validatePurchaseCustomization(purchaseConfig, purchaseCustomization);\n    if (purchaseError) {\n      toast.error(purchaseError);\n      return;\n    }\n\n    addToCart(')
replace_once('src/routes/product/$id.tsx',
'        unitPrice: effectivePrice,',
'        unitPrice: finalUnitPrice,')
replace_once('src/routes/product/$id.tsx',
'        selectedOptions,\n      },',
'        selectedOptions,\n        customization: purchaseCustomization,\n      },')
replace_once('src/routes/product/$id.tsx',
'            <div className="mt-auto space-y-5 border-t border-gray-100 pt-6">',
'            {purchaseConfig ? (\n              <ProductPurchaseOptions\n                config={purchaseConfig}\n                value={purchaseCustomization}\n                onChange={setPurchaseCustomization}\n              />\n            ) : null}\n\n            <div className="mt-auto space-y-5 border-t border-gray-100 pt-6">')

# Admin route exposes the global + per-product editor in Produtos.
replace_once('src/routes/admin.tsx',
'import { ProductImageAdmin } from "@/components/admin/ProductImageAdmin";\n',
'import { ProductImageAdmin } from "@/components/admin/ProductImageAdmin";\nimport { ProductPurchaseAdmin } from "@/components/admin/ProductPurchaseAdmin";\n')
replace_once('src/routes/admin.tsx',
'                <ProductAdmin />\n                <ProductImageAdmin />',
'                <ProductAdmin />\n                <ProductPurchaseAdmin />\n                <ProductImageAdmin />')

# Tiny regression validator for this feature.
write('scripts/validate-product-purchase-options.mjs', r'''
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260904190000_product_purchase_options.sql", "utf8");
const productPage = fs.readFileSync("src/routes/product/$id.tsx", "utf8");
const cart = fs.readFileSync("src/lib/cart.ts", "utf8");
const checkout = fs.readFileSync("supabase/functions/checkout-start/index.ts", "utf8");
const admin = fs.readFileSync("src/components/admin/ProductPurchaseAdmin.tsx", "utf8");
const checks = [
  ["tamanhos fixos sem acrescimo", migration.includes("ARRAY['P','M','G','GG','2GG','3GG','4XL']")],
  ["personalizacao normal 25 e frase 45", migration.includes("DEFAULT 25.00") && migration.includes("DEFAULT 45.00")],
  ["patch padrao 15", migration.includes("DEFAULT 15.00")],
  ["precos por modelo", ["184.90","219.90","169.90","159.90","229.90"].every((value) => migration.includes(value))],
  ["servidor recalcula adicionais", migration.includes("resolve_product_purchase_customization") && migration.includes("base_unit_price_value + surcharge_value")],
  ["carrinho diferencia personalizacoes", cart.includes("customizationFingerprint") && cart.includes("customization: item.customization")],
  ["checkout envia personalizacao", checkout.includes("customization: item.customization")],
  ["pagina mostra controles", productPage.includes("ProductPurchaseOptions") && productPage.includes("validatePurchaseCustomization")],
  ["admin geral e individual", admin.includes("Regras gerais") && admin.includes("Configuração individual por produto")],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
''')

# Self cleanup happens after successful workflow validation.
print('Product purchase options implementation written successfully.')
