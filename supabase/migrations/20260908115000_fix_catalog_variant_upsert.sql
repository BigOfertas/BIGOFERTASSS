BEGIN;

CREATE OR REPLACE FUNCTION public.owner_save_catalog_variant(
  p_product_id uuid,
  p_variant_id uuid,
  p_name text,
  p_status text,
  p_is_default boolean,
  p_price_override numeric,
  p_promotional_price_override numeric,
  p_stock_quantity integer,
  p_options jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_id uuid := p_variant_id;
  product_sku_value text;
  option_row jsonb;
  option_id_value uuid;
  option_value_id_value uuid;
  option_kind_value public.product_option_kind;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_status NOT IN ('active','inactive','archived')
     OR p_stock_quantity < 0
     OR jsonb_typeof(p_options) <> 'array' THEN
    RAISE EXCEPTION 'Dados da variação inválidos';
  END IF;
  IF p_price_override IS NOT NULL AND p_price_override < 0 THEN
    RAISE EXCEPTION 'Preço da variação inválido';
  END IF;
  IF p_promotional_price_override IS NOT NULL
     AND (p_promotional_price_override < 0
       OR (p_price_override IS NOT NULL AND p_promotional_price_override >= p_price_override)) THEN
    RAISE EXCEPTION 'Preço promocional da variação inválido';
  END IF;

  SELECT p.sku
  INTO product_sku_value
  FROM public.products p
  WHERE p.id = p_product_id;

  IF product_sku_value IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF p_is_default THEN
    UPDATE public.product_variants
    SET is_default = false
    WHERE product_id = p_product_id
      AND is_default;
  END IF;

  IF target_id IS NULL THEN
    INSERT INTO public.product_variants(
      product_id,
      sku,
      name,
      status,
      is_default,
      sort_order,
      price_override,
      promotional_price_override,
      stock_quantity
    )
    VALUES (
      p_product_id,
      product_sku_value || '-V' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      NULLIF(btrim(p_name), ''),
      p_status::public.product_variant_status,
      p_is_default,
      COALESCE(
        (SELECT max(sort_order) + 1 FROM public.product_variants WHERE product_id = p_product_id),
        0
      ),
      p_price_override,
      p_promotional_price_override,
      p_stock_quantity
    )
    RETURNING id INTO target_id;
  ELSE
    UPDATE public.product_variants
    SET
      name = NULLIF(btrim(p_name), ''),
      status = p_status::public.product_variant_status,
      is_default = p_is_default,
      price_override = p_price_override,
      promotional_price_override = p_promotional_price_override,
      stock_quantity = p_stock_quantity
    WHERE id = target_id
      AND product_id = p_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variação não encontrada';
    END IF;
  END IF;

  DELETE FROM public.product_variant_values
  WHERE variant_id = target_id;

  FOR option_row IN
    SELECT value FROM jsonb_array_elements(p_options)
  LOOP
    IF NULLIF(btrim(option_row->>'name'), '') IS NULL
       OR NULLIF(btrim(option_row->>'value'), '') IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      option_kind_value := COALESCE(
        NULLIF(option_row->>'kind', ''),
        'other'
      )::public.product_option_kind;
    EXCEPTION WHEN invalid_text_representation THEN
      option_kind_value := 'other'::public.product_option_kind;
    END;

    INSERT INTO public.product_options(product_id, name, kind, sort_order, is_required)
    VALUES (
      p_product_id,
      btrim(option_row->>'name'),
      option_kind_value,
      COALESCE((option_row->>'sortOrder')::integer, 0),
      true
    )
    ON CONFLICT (product_id, (lower(name)))
    DO UPDATE SET kind = EXCLUDED.kind
    RETURNING id INTO option_id_value;

    INSERT INTO public.product_option_values(option_id, value, sort_order, is_active)
    VALUES (
      option_id_value,
      btrim(option_row->>'value'),
      0,
      true
    )
    ON CONFLICT (option_id, (lower(value)))
    DO UPDATE SET is_active = true
    RETURNING id INTO option_value_id_value;

    INSERT INTO public.product_variant_values(variant_id, option_id, option_value_id)
    VALUES (target_id, option_id_value, option_value_id_value)
    ON CONFLICT (variant_id, option_id)
    DO UPDATE SET option_value_id = EXCLUDED.option_value_id;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM public.product_variants
    WHERE product_id = p_product_id
      AND is_default
      AND status <> 'archived'::public.product_variant_status
  ) THEN
    UPDATE public.product_variants
    SET is_default = true
    WHERE id = (
      SELECT id
      FROM public.product_variants
      WHERE product_id = p_product_id
        AND status <> 'archived'::public.product_variant_status
      ORDER BY sort_order, created_at
      LIMIT 1
    );
  END IF;

  RETURN target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_catalog_variant(
  uuid,uuid,text,text,boolean,numeric,numeric,integer,jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_catalog_variant(
  uuid,uuid,text,text,boolean,numeric,numeric,integer,jsonb
) TO authenticated, service_role;

COMMIT;
