BEGIN;

-- Etapa 2: a orientação de tamanho precisa acompanhar a variante efetivamente selecionada.
-- O catálogo já possui product_variants.commercial_type; esta migração apenas expõe esse
-- campo estruturado no detalhe público, sem alterar preço, checkout ou regras financeiras.
CREATE OR REPLACE FUNCTION public.storefront_product_detail_v2(p_identifier text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH base AS (
    SELECT public.storefront_product_detail_v1(p_identifier) AS payload
  ),
  target AS (
    SELECT
      base.payload,
      CASE
        WHEN base.payload IS NULL OR base.payload->'product'->>'id' IS NULL THEN NULL
        ELSE (base.payload->'product'->>'id')::uuid
      END AS product_id
    FROM base
  ),
  image_values AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'product_id', i.product_id,
          'variant_id', i.variant_id,
          'storage_key', i.storage_key,
          'card_storage_key', i.card_storage_key,
          'thumb_storage_key', i.thumb_storage_key,
          'external_url', i.external_url,
          'image_source', i.image_source,
          'original_filename', i.original_filename,
          'alt_text', i.alt_text,
          'mime_type', i.mime_type,
          'status', i.status,
          'is_primary', i.is_primary,
          'sort_order', i.sort_order,
          'byte_size', i.byte_size,
          'checksum_sha256', i.checksum_sha256,
          'etag', i.etag,
          'width_px', i.width_px,
          'height_px', i.height_px,
          'catalog_source_key', i.catalog_source_key,
          'created_at', i.created_at,
          'updated_at', i.updated_at
        )
        ORDER BY
          (i.variant_id IS NULL) DESC,
          i.is_primary DESC,
          i.sort_order ASC,
          i.created_at ASC,
          i.id ASC
      ),
      '[]'::jsonb
    ) AS value
    FROM target t
    JOIN public.product_images i ON i.product_id = t.product_id
    WHERE i.status = 'ready'::public.product_image_status
  ),
  variant_values AS (
    SELECT COALESCE(
      jsonb_agg(
        rows.variant || jsonb_build_object('commercial_type', v.commercial_type)
        ORDER BY rows.ordinal
      ) FILTER (WHERE rows.variant IS NOT NULL),
      '[]'::jsonb
    ) AS value
    FROM target t
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(t.payload->'variants', '[]'::jsonb))
      WITH ORDINALITY AS rows(variant, ordinal) ON true
    LEFT JOIN public.product_variants v
      ON v.id = NULLIF(rows.variant->>'id', '')::uuid
  )
  SELECT CASE
    WHEN target.payload IS NULL THEN NULL
    ELSE jsonb_set(
      jsonb_set(target.payload, '{images}', image_values.value, true),
      '{variants}',
      variant_values.value,
      true
    )
  END
  FROM target
  CROSS JOIN image_values
  CROSS JOIN variant_values;
$$;

REVOKE ALL ON FUNCTION public.storefront_product_detail_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_product_detail_v2(text) TO anon, authenticated;

COMMENT ON FUNCTION public.storefront_product_detail_v2(text) IS
  'Detalhe público com galeria R2/externa e commercial_type estruturado por variante para orientação dinâmica de tamanho.';

COMMIT;
