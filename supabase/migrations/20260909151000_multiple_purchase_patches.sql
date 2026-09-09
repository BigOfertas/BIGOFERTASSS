BEGIN;

-- BIGofertas — seleção de múltiplos patches, R$ 15 por patch.
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
  requested_patch_codes jsonb := '[]'::jsonb;
  normalized_patch_codes jsonb := '[]'::jsonb;
  first_patch_code text;
  name_limit integer := (config->>'personalizationNameMax')::integer;
  phrase_limit integer := (config->>'phraseMax')::integer;
BEGIN
  IF jsonb_typeof(raw) <> 'object' OR length(raw::text) > 5000 THEN
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

  IF raw ? 'patchCodes' AND raw->'patchCodes' IS NOT NULL AND raw->'patchCodes' <> 'null'::jsonb THEN
    IF jsonb_typeof(raw->'patchCodes') <> 'array' THEN
      RAISE EXCEPTION 'Lista de patches inválida';
    END IF;
    requested_patch_codes := raw->'patchCodes';
  ELSIF NULLIF(btrim(COALESCE(raw->>'patchCode', '')), '') IS NOT NULL THEN
    requested_patch_codes := jsonb_build_array(btrim(raw->>'patchCode'));
  END IF;

  IF jsonb_array_length(requested_patch_codes) > 8 THEN
    RAISE EXCEPTION 'Quantidade de patches inválida';
  END IF;

  FOR patch_code IN
    SELECT DISTINCT btrim(value)
    FROM jsonb_array_elements_text(requested_patch_codes) AS requested(value)
    WHERE btrim(value) <> ''
    ORDER BY btrim(value)
  LOOP
    SELECT value INTO patch_row
    FROM jsonb_array_elements(config->'patches')
    WHERE value->>'code' = patch_code
    LIMIT 1;

    IF patch_row IS NULL THEN
      RAISE EXCEPTION 'Patch indisponível para este produto: %', patch_code;
    END IF;

    patch_price := (patch_row->>'price')::numeric;
    surcharge := surcharge + patch_price;
    normalized_patch_codes := normalized_patch_codes || jsonb_build_array(patch_code);
    first_patch_code := COALESCE(first_patch_code, patch_code);
    selected_options := selected_options || jsonb_build_array(jsonb_build_object(
      'option_id', 'purchase-patch-' || patch_code,
      'option_name', 'Patch',
      'option_kind', 'other',
      'value_id', patch_code,
      'value_label', patch_row->>'label',
      'price_addition', patch_price
    ));
  END LOOP;

  normalized := normalized || jsonb_build_object(
    'patchCodes', normalized_patch_codes,
    'patchCode', first_patch_code
  );

  RETURN jsonb_build_object(
    'normalized', normalized,
    'surcharge', round(surcharge, 2),
    'selectedOptions', selected_options
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_product_purchase_customization(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_product_purchase_customization(uuid,jsonb) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.resolve_product_purchase_customization(uuid,jsonb) IS
  'Valida tamanho, personalizações e zero ou mais patches; aceita patchCodes e mantém patchCode legado.';

COMMIT;
