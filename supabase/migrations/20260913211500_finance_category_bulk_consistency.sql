BEGIN;

-- Mantém o editor legado de regras do produto coerente com a nova fonte
-- variante-aware. Variantes explicitamente classificadas preservam seu preço;
-- variantes que herdam o tipo do produto voltam a herdar também o preço-base.

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
  IF old_product.id IS NULL THEN
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
    SELECT product_type_prices INTO type_prices
    FROM public.store_purchase_settings
    WHERE singleton = true;
    fixed_price := NULLIF(type_prices->>p_commercial_type, '')::numeric;

    IF fixed_price IS NOT NULL THEN
      -- Antes de trocar o preço-base, congela somente as variantes que possuem
      -- classificação comercial própria e ainda herdavam o preço antigo.
      UPDATE public.product_variants v
      SET price_override = old_product.price,
          promotional_price_override = old_product.promotional_price,
          updated_at = now()
      WHERE v.product_id = p_product_id
        AND v.status <> 'archived'::public.product_variant_status
        AND v.commercial_type IS NOT NULL
        AND v.price_override IS NULL;

      -- Variantes sem classificação própria pertencem ao grupo do produto.
      -- Remover overrides delas garante que o checkout herde exatamente o
      -- mesmo preço-base que o catálogo passa a exibir.
      UPDATE public.product_variants v
      SET price_override = NULL,
          promotional_price_override = NULL,
          updated_at = now()
      WHERE v.product_id = p_product_id
        AND v.status <> 'archived'::public.product_variant_status
        AND v.commercial_type IS NULL;

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

REVOKE ALL ON FUNCTION public.owner_save_product_purchase_settings_v2(uuid,text,boolean,boolean,boolean,jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_save_product_purchase_settings_v2(uuid,text,boolean,boolean,boolean,jsonb)
TO authenticated, service_role;

COMMIT;
