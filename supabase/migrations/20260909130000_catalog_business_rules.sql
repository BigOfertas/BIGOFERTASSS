BEGIN;

-- Regras comerciais definitivas informadas para o catálogo BIGofertas.
UPDATE public.store_purchase_settings
SET
  sizes = ARRAY['P','M','G','GG','2GG','3GG','4XL'],
  personalization_price = 25.00,
  personalization_name_max = 12,
  phrase_price = 45.00,
  phrase_max = 50,
  patch_default_price = 15.00,
  patch_catalog = '[
    {"code":"brasileirao","label":"Brasileirão"},
    {"code":"libertadores","label":"Libertadores"},
    {"code":"sul-americana","label":"Sul Americana"},
    {"code":"copa-do-brasil","label":"Copa do Brasil"},
    {"code":"mundial-de-clubes","label":"Mundial de Clubes"}
  ]'::jsonb,
  product_type_prices = '{
    "torcedor":184.90,
    "feminino":184.90,
    "jogador":219.90,
    "retro":219.90,
    "infantil":169.90,
    "calcao":159.90,
    "basquete":229.90
  }'::jsonb,
  updated_at = now()
WHERE singleton = true;

-- Garante que produtos já classificados também obedeçam à tabela fixa.
UPDATE public.products p
SET
  price = (s.product_type_prices ->> pps.commercial_type)::numeric,
  promotional_price = NULL,
  updated_at = now()
FROM public.product_purchase_settings pps
CROSS JOIN public.store_purchase_settings s
WHERE s.singleton = true
  AND pps.product_id = p.id
  AND pps.commercial_type IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete')
  AND s.product_type_prices ? pps.commercial_type;

-- O importador usa esta função para registrar a leitura I/II/III como a última
-- característica do produto sem expor escrita direta na tabela pública.
CREATE OR REPLACE FUNCTION public.owner_catalog_import_set_specifications(
  p_product_id uuid,
  p_specifications text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_specs text := NULLIF(btrim(COALESCE(p_specifications, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id = p_product_id
      AND status <> 'archived'::public.product_status
  ) THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  UPDATE public.products
  SET specifications = normalized_specs,
      updated_at = now()
  WHERE id = p_product_id;

  RETURN normalized_specs;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_set_specifications(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_set_specifications(uuid,text) TO authenticated, service_role;

-- Preço por variação: permite que um mesmo produto-base tenha, por exemplo,
-- Torcedor a R$ 184,90 e Jogador a R$ 219,90 sem duplicar o produto-base.
CREATE OR REPLACE FUNCTION public.owner_catalog_import_set_variant_price(
  p_product_id uuid,
  p_variant_id uuid,
  p_price_override numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_price_override IS NULL OR p_price_override < 0 THEN
    RAISE EXCEPTION 'Preço da variação inválido';
  END IF;

  UPDATE public.product_variants
  SET price_override = p_price_override,
      promotional_price_override = NULL,
      updated_at = now()
  WHERE id = p_variant_id
    AND product_id = p_product_id
    AND status <> 'archived'::public.product_variant_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variação não encontrada';
  END IF;

  RETURN p_price_override;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_set_variant_price(uuid,uuid,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_set_variant_price(uuid,uuid,numeric) TO authenticated, service_role;

-- A frase estendida é texto puro: até 50 caracteres e não aceita números.
-- Mantemos a função canônica no mesmo OID para que validação do carrinho/pedido
-- continue passando obrigatoriamente por esta regra no servidor.
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
    IF phrase_value ~ '[0-9]' THEN
      RAISE EXCEPTION 'A frase personalizada não pode conter números';
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

REVOKE ALL ON FUNCTION public.resolve_product_purchase_customization(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_product_purchase_customization(uuid,jsonb) TO anon, authenticated, service_role;

COMMIT;
