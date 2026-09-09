BEGIN;

-- BIGofertas — tamanhos comerciais específicos por produto.
-- O catálogo adulto continua usando a grade global; produtos Infantil/Kids usam 16–28.
ALTER TABLE public.product_purchase_settings
  ADD COLUMN IF NOT EXISTS sizes_override text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_purchase_sizes_override_valid'
      AND conrelid = 'public.product_purchase_settings'::regclass
  ) THEN
    ALTER TABLE public.product_purchase_settings
      ADD CONSTRAINT product_purchase_sizes_override_valid
      CHECK (
        sizes_override IS NULL
        OR (
          cardinality(sizes_override) BETWEEN 1 AND 20
          AND array_position(sizes_override, '') IS NULL
          AND array_position(sizes_override, NULL) IS NULL
        )
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_default_product_purchase_sizes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  kids_sizes constant text[] := ARRAY['16','18','20','22','24','26','28'];
BEGIN
  IF NEW.commercial_type = 'infantil' THEN
    IF NEW.sizes_override IS NULL
       OR (
         TG_OP = 'UPDATE'
         AND OLD.commercial_type IS DISTINCT FROM NEW.commercial_type
         AND OLD.sizes_override IS NULL
       ) THEN
      NEW.sizes_override := kids_sizes;
    END IF;
  ELSIF TG_OP = 'UPDATE'
        AND OLD.commercial_type = 'infantil'
        AND OLD.sizes_override = kids_sizes
        AND NEW.sizes_override = OLD.sizes_override THEN
    NEW.sizes_override := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_default_product_purchase_sizes_before_write
  ON public.product_purchase_settings;
CREATE TRIGGER set_default_product_purchase_sizes_before_write
BEFORE INSERT OR UPDATE OF commercial_type, sizes_override
ON public.product_purchase_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_default_product_purchase_sizes();

UPDATE public.product_purchase_settings
SET sizes_override = ARRAY['16','18','20','22','24','26','28'],
    updated_at = now()
WHERE commercial_type = 'infantil'
  AND sizes_override IS NULL;

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
    'sizes', to_jsonb(COALESCE(product_row.sizes_override, global_row.sizes)),
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

COMMIT;
