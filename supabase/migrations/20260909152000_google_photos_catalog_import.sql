BEGIN;

-- BIGofertas — importador transacional do catálogo normalizado.
-- O payload já vem do coletor/normalizador; esta função preserva IDs em reprocessamentos,
-- reserva P000XXX sem colisão, cadastra variações e grava URLs externas diretamente.
CREATE OR REPLACE FUNCTION public.catalog_apply_normalized_batch(
  p_payload jsonb,
  p_reset_catalog boolean DEFAULT false,
  p_activate boolean DEFAULT false,
  p_default_stock integer DEFAULT 999
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  product_item jsonb;
  variant_item jsonb;
  image_item jsonb;
  patch_item jsonb;
  target_product_id uuid;
  target_variant_id uuid;
  target_category_id uuid;
  version_option_id uuid;
  version_value_id uuid;
  existing_image_id uuid;
  product_source_key text;
  product_source_title text;
  requested_code text;
  resolved_code text;
  variant_code text;
  variant_name text;
  image_source_key text;
  image_url text;
  category_name text;
  category_slug text;
  product_name text;
  product_slug text;
  product_sku text;
  product_patches jsonb;
  product_count integer := 0;
  variant_count integer := 0;
  image_count integer := 0;
  activated_count integer := 0;
  next_code integer;
  variant_index integer;
  image_index integer;
  variants_total integer;
  resolved_stock integer;
  first_image_url text;
BEGIN
  IF jsonb_typeof(p_payload) <> 'object'
     OR jsonb_typeof(p_payload->'products') <> 'array'
     OR jsonb_array_length(p_payload->'products') = 0 THEN
    RAISE EXCEPTION 'Payload normalizado inválido';
  END IF;

  IF p_default_stock < 0 OR p_default_stock > 1000000 THEN
    RAISE EXCEPTION 'Estoque padrão inválido';
  END IF;

  IF p_reset_catalog THEN
    -- Pedidos preservam snapshots; suas FKs de produto/variação usam ON DELETE SET NULL.
    UPDATE public.products
    SET status = 'archived'::public.product_status,
        updated_at = now()
    WHERE status <> 'archived'::public.product_status;

    DELETE FROM public.products;
  END IF;

  SELECT COALESCE(max(substring(catalog_code from 2)::integer), 0)
  INTO next_code
  FROM public.products
  WHERE catalog_code ~ '^P[0-9]{6}$';

  FOR product_item IN
    SELECT value
    FROM jsonb_array_elements(p_payload->'products') AS rows(value)
  LOOP
    product_source_key := NULLIF(btrim(COALESCE(product_item->>'sourceKey', '')), '');
    product_source_title := NULLIF(btrim(COALESCE(product_item->>'sourceTitle', '')), '');
    product_name := NULLIF(btrim(COALESCE(product_item->>'name', '')), '');
    requested_code := upper(NULLIF(btrim(COALESCE(product_item->>'catalogCode', '')), ''));
    category_name := COALESCE(NULLIF(btrim(product_item->'category'->>'name'), ''), 'Camisas');
    category_slug := public.slugify(COALESCE(NULLIF(btrim(product_item->'category'->>'slug'), ''), category_name));
    variants_total := COALESCE(jsonb_array_length(product_item->'variants'), 0);
    product_patches := COALESCE(product_item->'patches', '[]'::jsonb);

    IF product_source_key IS NULL OR product_name IS NULL OR variants_total = 0 THEN
      RAISE EXCEPTION 'Produto normalizado incompleto: %', COALESCE(product_name, product_source_key, '(sem identificação)');
    END IF;

    IF requested_code IS NOT NULL AND requested_code !~ '^P[0-9]{6}$' THEN
      RAISE EXCEPTION 'Código P inválido: %', requested_code;
    END IF;

    IF jsonb_typeof(product_patches) <> 'array' THEN
      RAISE EXCEPTION 'Patches inválidos em %', product_name;
    END IF;

    FOR patch_item IN SELECT value FROM jsonb_array_elements(product_patches) AS patches(value)
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.store_purchase_settings s,
             jsonb_array_elements(s.patch_catalog) catalog_patch
        WHERE s.singleton = true
          AND catalog_patch->>'code' = patch_item->>'code'
      ) THEN
        RAISE EXCEPTION 'Patch não cadastrado (%): %', product_name, patch_item->>'code';
      END IF;
    END LOOP;

    INSERT INTO public.categories(name, slug, is_active)
    VALUES (category_name, category_slug, true)
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = true,
          updated_at = now()
    RETURNING id INTO target_category_id;

    SELECT id, catalog_code
    INTO target_product_id, resolved_code
    FROM public.products
    WHERE catalog_source_key = product_source_key
    LIMIT 1
    FOR UPDATE;

    IF target_product_id IS NULL THEN
      IF requested_code IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.products
          WHERE catalog_code = requested_code
            AND catalog_source_key IS DISTINCT FROM product_source_key
        ) THEN
          RAISE EXCEPTION 'Código % já pertence a outra origem', requested_code;
        END IF;
        resolved_code := requested_code;
        next_code := GREATEST(next_code, substring(requested_code from 2)::integer);
      ELSE
        next_code := next_code + 1;
        resolved_code := 'P' || lpad(next_code::text, 6, '0');
      END IF;

      product_sku := 'BIG-' || resolved_code;
      product_slug := public.slugify(product_name || '-' || lower(resolved_code));

      INSERT INTO public.products(
        name, description, price, promotional_price, image_url,
        sku, slug, status, primary_category_id,
        campeonato, liga, time, season, brand, audience, specifications,
        catalog_code, catalog_source_key, catalog_source_title
      ) VALUES (
        product_name,
        COALESCE(product_item->>'description', ''),
        COALESCE(NULLIF(product_item->>'price', '')::numeric, 0),
        NULL,
        NULL,
        product_sku,
        product_slug,
        'draft'::public.product_status,
        target_category_id,
        NULLIF(btrim(COALESCE(product_item->>'competition', '')), ''),
        NULLIF(btrim(COALESCE(product_item->>'league', '')), ''),
        NULLIF(btrim(COALESCE(product_item->>'team', '')), ''),
        NULLIF(btrim(COALESCE(product_item->>'season', '')), ''),
        NULLIF(btrim(COALESCE(product_item->>'brand', '')), ''),
        NULLIF(btrim(COALESCE(product_item->>'audience', '')), ''),
        NULLIF(btrim(COALESCE(product_item->>'specifications', '')), ''),
        resolved_code,
        product_source_key,
        product_source_title
      )
      RETURNING id INTO target_product_id;
    ELSE
      resolved_code := COALESCE(resolved_code, requested_code);
      IF requested_code IS NOT NULL AND resolved_code IS DISTINCT FROM requested_code THEN
        RAISE EXCEPTION 'Origem % já possui código %; não pode trocar para %', product_source_key, resolved_code, requested_code;
      END IF;

      UPDATE public.products
      SET name = product_name,
          description = COALESCE(product_item->>'description', description, ''),
          price = COALESCE(NULLIF(product_item->>'price', '')::numeric, price),
          promotional_price = NULL,
          primary_category_id = target_category_id,
          campeonato = NULLIF(btrim(COALESCE(product_item->>'competition', '')), ''),
          liga = NULLIF(btrim(COALESCE(product_item->>'league', '')), ''),
          time = NULLIF(btrim(COALESCE(product_item->>'team', '')), ''),
          season = NULLIF(btrim(COALESCE(product_item->>'season', '')), ''),
          brand = NULLIF(btrim(COALESCE(product_item->>'brand', '')), ''),
          audience = NULLIF(btrim(COALESCE(product_item->>'audience', '')), ''),
          specifications = NULLIF(btrim(COALESCE(product_item->>'specifications', '')), ''),
          catalog_source_title = product_source_title,
          status = 'draft'::public.product_status,
          updated_at = now()
      WHERE id = target_product_id;
    END IF;

    INSERT INTO public.product_purchase_settings(
      product_id, commercial_type, size_enabled,
      personalization_enabled, phrase_enabled, patches, updated_at
    ) VALUES (
      target_product_id,
      COALESCE(NULLIF(product_item->>'commercialType', ''), 'other'),
      true,
      COALESCE((product_item->>'personalizationEnabled')::boolean, true),
      COALESCE((product_item->>'phraseEnabled')::boolean, true),
      product_patches,
      now()
    )
    ON CONFLICT (product_id) DO UPDATE
      SET commercial_type = EXCLUDED.commercial_type,
          size_enabled = EXCLUDED.size_enabled,
          personalization_enabled = EXCLUDED.personalization_enabled,
          phrase_enabled = EXCLUDED.phrase_enabled,
          patches = EXCLUDED.patches,
          updated_at = now();

    -- Reprocessamento preserva IDs, mas retira logicamente imagens/variações que não vierem mais no lote.
    UPDATE public.product_images
    SET status = 'archived'::public.product_image_status,
        is_primary = false,
        updated_at = now()
    WHERE product_id = target_product_id
      AND image_source = 'google_photos';

    UPDATE public.product_variants
    SET is_default = false,
        updated_at = now()
    WHERE product_id = target_product_id;

    IF variants_total > 1 THEN
      SELECT id INTO version_option_id
      FROM public.product_options
      WHERE product_id = target_product_id
        AND lower(name) = 'versão'
      LIMIT 1;

      IF version_option_id IS NULL THEN
        INSERT INTO public.product_options(product_id, name, kind, sort_order, is_required)
        VALUES (target_product_id, 'Versão', 'style'::public.product_option_kind, 0, true)
        RETURNING id INTO version_option_id;
      END IF;
    ELSE
      version_option_id := NULL;
    END IF;

    variant_index := 0;
    first_image_url := NULL;

    FOR variant_item IN
      SELECT value
      FROM jsonb_array_elements(product_item->'variants') AS variants(value)
    LOOP
      variant_code := lower(COALESCE(NULLIF(btrim(variant_item->>'code'), ''), 'versao-' || lpad((variant_index + 1)::text, 2, '0')));
      variant_name := COALESCE(NULLIF(btrim(variant_item->>'name'), ''), 'Versão ' || lpad((variant_index + 1)::text, 2, '0'));
      resolved_stock := COALESCE(NULLIF(variant_item->>'stock', '')::integer, p_default_stock);

      IF resolved_stock < 0 THEN
        RAISE EXCEPTION 'Estoque inválido em % / %', product_name, variant_name;
      END IF;

      SELECT id INTO target_variant_id
      FROM public.product_variants
      WHERE product_id = target_product_id
        AND catalog_variant_code = variant_code
      LIMIT 1
      FOR UPDATE;

      IF target_variant_id IS NULL THEN
        INSERT INTO public.product_variants(
          product_id, sku, name, status, is_default, sort_order,
          price_override, promotional_price_override, stock_quantity,
          catalog_variant_code, catalog_source_title
        ) VALUES (
          target_product_id,
          left('BIG-' || resolved_code || '-V' || lpad((variant_index + 1)::text, 2, '0'), 64),
          variant_name,
          'active'::public.product_variant_status,
          variant_index = 0,
          variant_index,
          COALESCE(NULLIF(variant_item->>'price', '')::numeric, NULLIF(product_item->>'price', '')::numeric),
          NULL,
          resolved_stock,
          variant_code,
          NULLIF(btrim(COALESCE(variant_item->>'sourceTitle', '')), '')
        )
        RETURNING id INTO target_variant_id;
      ELSE
        UPDATE public.product_variants
        SET name = variant_name,
            status = 'active'::public.product_variant_status,
            is_default = (variant_index = 0),
            sort_order = variant_index,
            price_override = COALESCE(NULLIF(variant_item->>'price', '')::numeric, price_override),
            promotional_price_override = NULL,
            stock_quantity = resolved_stock,
            catalog_source_title = NULLIF(btrim(COALESCE(variant_item->>'sourceTitle', '')), ''),
            updated_at = now()
        WHERE id = target_variant_id;
      END IF;

      IF version_option_id IS NOT NULL THEN
        SELECT id INTO version_value_id
        FROM public.product_option_values
        WHERE option_id = version_option_id
          AND lower(value) = lower(variant_name)
        LIMIT 1;

        IF version_value_id IS NULL THEN
          INSERT INTO public.product_option_values(option_id, value, sort_order, is_active)
          VALUES (version_option_id, variant_name, variant_index, true)
          RETURNING id INTO version_value_id;
        ELSE
          UPDATE public.product_option_values
          SET is_active = true,
              sort_order = variant_index,
              updated_at = now()
          WHERE id = version_value_id;
        END IF;

        INSERT INTO public.product_variant_values(variant_id, option_id, option_value_id)
        VALUES (target_variant_id, version_option_id, version_value_id)
        ON CONFLICT (variant_id, option_id) DO UPDATE
          SET option_value_id = EXCLUDED.option_value_id;
      END IF;

      IF jsonb_typeof(variant_item->'images') <> 'array'
         OR jsonb_array_length(variant_item->'images') = 0 THEN
        RAISE EXCEPTION 'Variação sem imagens: % / %', product_name, variant_name;
      END IF;

      image_index := 0;
      FOR image_item IN
        SELECT value
        FROM jsonb_array_elements(variant_item->'images') AS images(value)
      LOOP
        image_url := NULLIF(btrim(COALESCE(image_item->>'url', '')), '');
        image_source_key := NULLIF(btrim(COALESCE(image_item->>'sourceKey', '')), '');

        IF image_url IS NULL
           OR image_url !~ '^https://lh[0-9]+\.googleusercontent\.com/'
           OR image_source_key IS NULL THEN
          RAISE EXCEPTION 'URL Google Photos inválida em % / %', product_name, variant_name;
        END IF;

        SELECT id INTO existing_image_id
        FROM public.product_images
        WHERE product_id = target_product_id
          AND catalog_source_key = image_source_key
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        FOR UPDATE;

        IF existing_image_id IS NULL THEN
          INSERT INTO public.product_images(
            product_id, variant_id, storage_key, external_url, image_source,
            original_filename, alt_text, mime_type, status, is_primary, sort_order,
            catalog_source_key
          ) VALUES (
            target_product_id,
            target_variant_id,
            NULL,
            image_url,
            'google_photos',
            NULL,
            product_name,
            'image/jpeg',
            'ready'::public.product_image_status,
            image_index = 0,
            image_index,
            image_source_key
          );
        ELSE
          UPDATE public.product_images
          SET variant_id = target_variant_id,
              storage_key = NULL,
              card_storage_key = NULL,
              thumb_storage_key = NULL,
              external_url = image_url,
              image_source = 'google_photos',
              alt_text = product_name,
              status = 'ready'::public.product_image_status,
              is_primary = (image_index = 0),
              sort_order = image_index,
              updated_at = now()
          WHERE id = existing_image_id;
        END IF;

        IF first_image_url IS NULL AND variant_index = 0 AND image_index = 0 THEN
          first_image_url := image_url;
        END IF;

        image_index := image_index + 1;
        image_count := image_count + 1;
      END LOOP;

      variant_index := variant_index + 1;
      variant_count := variant_count + 1;
    END LOOP;

    UPDATE public.product_variants v
    SET status = 'inactive'::public.product_variant_status,
        is_default = false,
        updated_at = now()
    WHERE v.product_id = target_product_id
      AND v.catalog_variant_code IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(product_item->'variants') current_variant(value)
        WHERE lower(COALESCE(NULLIF(btrim(current_variant.value->>'code'), ''), '')) = v.catalog_variant_code
      );

    UPDATE public.products
    SET image_url = first_image_url,
        updated_at = now()
    WHERE id = target_product_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.product_variants
      WHERE product_id = target_product_id
        AND status = 'active'::public.product_variant_status
        AND stock_quantity >= 0
    ) THEN
      RAISE EXCEPTION 'Produto sem variação ativa: %', product_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.product_images
      WHERE product_id = target_product_id
        AND status = 'ready'::public.product_image_status
        AND external_url IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Produto sem imagem externa pronta: %', product_name;
    END IF;

    IF COALESCE((SELECT price FROM public.products WHERE id = target_product_id), 0) <= 0 THEN
      RAISE EXCEPTION 'Produto sem preço válido: %', product_name;
    END IF;

    IF p_activate THEN
      UPDATE public.products
      SET status = 'active'::public.product_status,
          updated_at = now()
      WHERE id = target_product_id;
      activated_count := activated_count + 1;
    END IF;

    product_count := product_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'products', product_count,
    'variants', variant_count,
    'images', image_count,
    'activated', activated_count,
    'resetCatalog', p_reset_catalog
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalog_apply_normalized_batch(jsonb,boolean,boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_apply_normalized_batch(jsonb,boolean,boolean,integer) TO service_role;

COMMENT ON FUNCTION public.catalog_apply_normalized_batch(jsonb,boolean,boolean,integer) IS
  'Importador transacional/idempotente do catálogo normalizado. Preserva source keys, códigos P e snapshots de pedidos.';

COMMIT;
