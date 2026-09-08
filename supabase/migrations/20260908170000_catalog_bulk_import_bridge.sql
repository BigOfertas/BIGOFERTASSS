BEGIN;

-- BIGofertas — ponte de importação em massa do catálogo definitivo.
-- O código P000XXX é privado/interno e garante idempotência entre reimportações.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS catalog_code text;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS catalog_variant_code text;

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS catalog_source_key text,
  ADD COLUMN IF NOT EXISTS catalog_source_sha256 text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_catalog_code_format'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_catalog_code_format
      CHECK (catalog_code IS NULL OR catalog_code ~ '^P[0-9]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_catalog_variant_code_not_blank'
      AND conrelid = 'public.product_variants'::regclass
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_catalog_variant_code_not_blank
      CHECK (catalog_variant_code IS NULL OR length(btrim(catalog_variant_code)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_catalog_source_key_not_blank'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_catalog_source_key_not_blank
      CHECK (catalog_source_key IS NULL OR length(btrim(catalog_source_key)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_catalog_source_sha256_format'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_catalog_source_sha256_format
      CHECK (
        catalog_source_sha256 IS NULL
        OR catalog_source_sha256 ~ '^[0-9a-f]{64}$'
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS products_catalog_code_uidx
  ON public.products (catalog_code)
  WHERE catalog_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_catalog_code_uidx
  ON public.product_variants (product_id, catalog_variant_code)
  WHERE catalog_variant_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_catalog_source_active_uidx
  ON public.product_images (product_id, catalog_source_key)
  WHERE catalog_source_key IS NOT NULL
    AND status <> 'archived'::public.product_image_status;

CREATE INDEX IF NOT EXISTS product_images_catalog_source_sha_idx
  ON public.product_images (product_id, catalog_source_sha256)
  WHERE catalog_source_sha256 IS NOT NULL;

CREATE OR REPLACE FUNCTION public.owner_catalog_import_upsert_category(
  p_name text,
  p_slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_id uuid;
  normalized_name text := NULLIF(btrim(p_name), '');
  normalized_slug text := public.slugify(COALESCE(NULLIF(btrim(p_slug), ''), p_name));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF normalized_name IS NULL OR normalized_slug = '' THEN
    RAISE EXCEPTION 'Categoria inválida';
  END IF;

  INSERT INTO public.categories(name, slug, is_active)
  VALUES (normalized_name, normalized_slug, true)
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = true,
        updated_at = now()
  RETURNING id INTO target_id;

  RETURN target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_upsert_category(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_upsert_category(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_catalog_import_upsert_product(
  p_catalog_code text,
  p_name text,
  p_description text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_promotional_price numeric DEFAULT NULL,
  p_primary_category_id uuid DEFAULT NULL,
  p_campeonato text DEFAULT NULL,
  p_liga text DEFAULT NULL,
  p_time text DEFAULT NULL,
  p_season text DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_audience text DEFAULT NULL,
  p_commercial_type text DEFAULT 'other'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_code text := upper(btrim(COALESCE(p_catalog_code, '')));
  target_id uuid;
  was_created boolean := false;
  current_product public.products%ROWTYPE;
  current_commercial_type text;
  resolved_price numeric;
  resolved_promotional_price numeric;
  resolved_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF normalized_code !~ '^P[0-9]{6}$' OR NULLIF(btrim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Código ou nome do produto inválido';
  END IF;

  SELECT p.*
  INTO current_product
  FROM public.products p
  WHERE p.catalog_code = normalized_code
  FOR UPDATE;

  target_id := current_product.id;

  IF target_id IS NULL THEN
    resolved_price := COALESCE(p_price, 0);
    resolved_promotional_price := p_promotional_price;
    target_id := public.owner_save_catalog_product(
      NULL,
      p_name,
      COALESCE(p_description, ''),
      resolved_price,
      resolved_promotional_price,
      'draft',
      p_primary_category_id,
      COALESCE(p_campeonato, ''),
      COALESCE(p_liga, ''),
      COALESCE(p_time, ''),
      COALESCE(p_season, ''),
      COALESCE(p_brand, ''),
      COALESCE(p_audience, ''),
      COALESCE(NULLIF(btrim(p_commercial_type), ''), 'other'),
      NULL,
      NULL,
      NULL,
      NULL
    );

    UPDATE public.products
    SET catalog_code = normalized_code
    WHERE id = target_id;

    was_created := true;
  ELSE
    SELECT COALESCE(pps.commercial_type, 'other')
    INTO current_commercial_type
    FROM public.products p
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    WHERE p.id = target_id;

    resolved_price := COALESCE(p_price, current_product.price);
    resolved_promotional_price := COALESCE(p_promotional_price, current_product.promotional_price);
    resolved_status := current_product.status::text;

    PERFORM public.owner_save_catalog_product(
      target_id,
      p_name,
      COALESCE(NULLIF(btrim(p_description), ''), current_product.description, ''),
      resolved_price,
      resolved_promotional_price,
      resolved_status,
      COALESCE(p_primary_category_id, current_product.primary_category_id),
      COALESCE(NULLIF(btrim(p_campeonato), ''), current_product.campeonato, ''),
      COALESCE(NULLIF(btrim(p_liga), ''), current_product.liga, ''),
      COALESCE(NULLIF(btrim(p_time), ''), current_product.time, ''),
      COALESCE(NULLIF(btrim(p_season), ''), current_product.season, ''),
      COALESCE(NULLIF(btrim(p_brand), ''), current_product.brand, ''),
      COALESCE(NULLIF(btrim(p_audience), ''), current_product.audience, ''),
      COALESCE(NULLIF(btrim(p_commercial_type), ''), current_commercial_type, 'other'),
      current_product.weight_grams,
      current_product.length_cm,
      current_product.width_cm,
      current_product.height_cm
    );
  END IF;

  RETURN jsonb_build_object(
    'id', target_id,
    'catalogCode', normalized_code,
    'created', was_created
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_upsert_product(
  text,text,text,numeric,numeric,uuid,text,text,text,text,text,text,text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_upsert_product(
  text,text,text,numeric,numeric,uuid,text,text,text,text,text,text,text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_catalog_import_upsert_variant(
  p_product_id uuid,
  p_variant_code text,
  p_name text,
  p_is_default boolean DEFAULT false,
  p_sort_order integer DEFAULT 0,
  p_stock_quantity integer DEFAULT 0,
  p_options jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_code text := lower(btrim(COALESCE(p_variant_code, '')));
  target_id uuid;
  was_created boolean := false;
  reused_placeholder boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF normalized_code = '' OR p_stock_quantity < 0 OR p_sort_order < 0 THEN
    RAISE EXCEPTION 'Dados da variação inválidos';
  END IF;

  SELECT v.id
  INTO target_id
  FROM public.product_variants v
  WHERE v.product_id = p_product_id
    AND v.catalog_variant_code = normalized_code
  LIMIT 1
  FOR UPDATE;

  IF target_id IS NULL AND normalized_code = 'versao-01' THEN
    SELECT v.id
    INTO target_id
    FROM public.product_variants v
    WHERE v.product_id = p_product_id
      AND v.catalog_variant_code IS NULL
      AND v.is_default
      AND v.status <> 'archived'::public.product_variant_status
    ORDER BY v.created_at, v.id
    LIMIT 1
    FOR UPDATE;

    reused_placeholder := target_id IS NOT NULL;
  END IF;

  was_created := target_id IS NULL;

  target_id := public.owner_save_catalog_variant(
    p_product_id,
    target_id,
    COALESCE(NULLIF(btrim(p_name), ''), normalized_code),
    'active',
    p_is_default,
    NULL,
    NULL,
    p_stock_quantity,
    COALESCE(p_options, '[]'::jsonb)
  );

  UPDATE public.product_variants
  SET catalog_variant_code = normalized_code,
      sort_order = p_sort_order,
      updated_at = now()
  WHERE id = target_id
    AND product_id = p_product_id;

  RETURN jsonb_build_object(
    'id', target_id,
    'variantCode', normalized_code,
    'created', was_created,
    'reusedPlaceholder', reused_placeholder
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_upsert_variant(
  uuid,text,text,boolean,integer,integer,jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_upsert_variant(
  uuid,text,text,boolean,integer,integer,jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_catalog_import_image_state(
  p_product_id uuid,
  p_source_key text
)
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
    'id', i.id,
    'status', i.status,
    'variantId', i.variant_id,
    'sourceKey', i.catalog_source_key,
    'sourceSha256', i.catalog_source_sha256,
    'isPrimary', i.is_primary,
    'sortOrder', i.sort_order
  )
  INTO result
  FROM public.product_images i
  WHERE i.product_id = p_product_id
    AND i.catalog_source_key = NULLIF(btrim(p_source_key), '')
    AND i.status <> 'archived'::public.product_image_status
  ORDER BY i.updated_at DESC, i.created_at DESC
  LIMIT 1;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_image_state(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_image_state(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_catalog_import_finalize_image(
  p_product_id uuid,
  p_image_id uuid,
  p_source_key text,
  p_source_sha256 text,
  p_is_primary boolean DEFAULT false,
  p_sort_order integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_source_key text := NULLIF(btrim(p_source_key), '');
  normalized_sha text := lower(btrim(COALESCE(p_source_sha256, '')));
  image_status public.product_image_status;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF normalized_source_key IS NULL OR normalized_sha !~ '^[0-9a-f]{64}$' OR p_sort_order < 0 THEN
    RAISE EXCEPTION 'Identificação da imagem inválida';
  END IF;

  SELECT i.status
  INTO image_status
  FROM public.product_images i
  WHERE i.id = p_image_id
    AND i.product_id = p_product_id
  FOR UPDATE;

  IF image_status IS NULL THEN
    RAISE EXCEPTION 'Imagem não encontrada';
  END IF;
  IF image_status <> 'ready'::public.product_image_status THEN
    RAISE EXCEPTION 'Imagem ainda não está pronta';
  END IF;

  UPDATE public.product_images
  SET status = 'archived'::public.product_image_status,
      is_primary = false,
      updated_at = now()
  WHERE product_id = p_product_id
    AND id <> p_image_id
    AND catalog_source_key = normalized_source_key
    AND status <> 'archived'::public.product_image_status;

  UPDATE public.product_images
  SET catalog_source_key = normalized_source_key,
      catalog_source_sha256 = normalized_sha,
      sort_order = p_sort_order,
      updated_at = now()
  WHERE id = p_image_id
    AND product_id = p_product_id;

  IF p_is_primary THEN
    PERFORM public.set_primary_product_image(p_image_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_finalize_image(
  uuid,uuid,text,text,boolean,integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_finalize_image(
  uuid,uuid,text,text,boolean,integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_catalog_import_set_product_status(
  p_product_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_price numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF p_status NOT IN ('draft','active','inactive') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT p.price INTO target_price
  FROM public.products p
  WHERE p.id = p_product_id
  FOR UPDATE;

  IF target_price IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF p_status = 'active' THEN
    IF target_price <= 0 THEN
      RAISE EXCEPTION 'Produto sem preço válido não pode ser ativado';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.product_images i
      WHERE i.product_id = p_product_id
        AND i.status = 'ready'::public.product_image_status
    ) THEN
      RAISE EXCEPTION 'Produto sem imagem pronta não pode ser ativado';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.product_variants v
      WHERE v.product_id = p_product_id
        AND v.status = 'active'::public.product_variant_status
    ) THEN
      RAISE EXCEPTION 'Produto sem variação ativa não pode ser ativado';
    END IF;
  END IF;

  UPDATE public.products
  SET status = p_status::public.product_status,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_set_product_status(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_set_product_status(uuid,text) TO authenticated;

COMMENT ON COLUMN public.products.catalog_code IS
  'Código mestre privado do acervo (P000XXX). Usado para reimportar/atualizar sem duplicar produtos.';
COMMENT ON COLUMN public.product_variants.catalog_variant_code IS
  'Código estável da variação no acervo, por exemplo versao-01.';
COMMENT ON COLUMN public.product_images.catalog_source_key IS
  'Caminho lógico do arquivo no ZIP definitivo. Permite reimportação idempotente.';
COMMENT ON COLUMN public.product_images.catalog_source_sha256 IS
  'SHA-256 do arquivo fonte do ZIP definitivo para detectar mudança real da imagem.';

COMMIT;
