BEGIN;

CREATE TABLE IF NOT EXISTS public.site_asset_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  original_filename text,
  mime_type text NOT NULL,
  byte_size bigint,
  etag text,
  width_px integer,
  height_px integer,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT site_asset_uploads_slot_valid CHECK (
    slot_key IN (
      'top_banner_desktop','top_banner_mobile','hero_desktop','hero_mobile',
      'brasileirao_banner_desktop','brasileirao_banner_mobile',
      'ambient_banner_desktop','ambient_banner_mobile',
      'category_kids','category_training','category_shorts','category_basketball',
      'category_windbreaker','category_fifa','category_retro'
    )
  ),
  CONSTRAINT site_asset_uploads_status_valid CHECK (status IN ('pending','ready','failed')),
  CONSTRAINT site_asset_uploads_dimensions_valid CHECK (
    (width_px IS NULL AND height_px IS NULL)
    OR (width_px > 0 AND height_px > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.site_personalization_assets (
  slot_key text PRIMARY KEY,
  upload_id uuid REFERENCES public.site_asset_uploads(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT site_personalization_slot_valid CHECK (
    slot_key IN (
      'top_banner_desktop','top_banner_mobile','hero_desktop','hero_mobile',
      'brasileirao_banner_desktop','brasileirao_banner_mobile',
      'ambient_banner_desktop','ambient_banner_mobile',
      'category_kids','category_training','category_shorts','category_basketball',
      'category_windbreaker','category_fifa','category_retro'
    )
  )
);

INSERT INTO public.site_personalization_assets (slot_key)
SELECT slot_key
FROM unnest(ARRAY[
  'top_banner_desktop','top_banner_mobile','hero_desktop','hero_mobile',
  'brasileirao_banner_desktop','brasileirao_banner_mobile',
  'ambient_banner_desktop','ambient_banner_mobile',
  'category_kids','category_training','category_shorts','category_basketball',
  'category_windbreaker','category_fifa','category_retro'
]::text[]) AS slot_key
ON CONFLICT (slot_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS site_asset_uploads_slot_created_idx
  ON public.site_asset_uploads (slot_key, created_at DESC);

ALTER TABLE public.site_asset_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_personalization_assets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.site_asset_uploads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.site_personalization_assets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_asset_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_personalization_assets TO authenticated;
GRANT ALL ON TABLE public.site_asset_uploads TO service_role;
GRANT ALL ON TABLE public.site_personalization_assets TO service_role;

DROP POLICY IF EXISTS site_asset_uploads_owner_all ON public.site_asset_uploads;
CREATE POLICY site_asset_uploads_owner_all
ON public.site_asset_uploads
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

DROP POLICY IF EXISTS site_personalization_assets_owner_all ON public.site_personalization_assets;
CREATE POLICY site_personalization_assets_owner_all
ON public.site_personalization_assets
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

CREATE OR REPLACE FUNCTION public.get_storefront_personalization()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    jsonb_object_agg(
      a.slot_key,
      jsonb_build_object(
        'slotKey', a.slot_key,
        'storageKey', u.storage_key,
        'mimeType', u.mime_type,
        'widthPx', u.width_px,
        'heightPx', u.height_px,
        'byteSize', u.byte_size,
        'updatedAt', a.updated_at
      )
    ) FILTER (WHERE u.id IS NOT NULL AND u.status = 'ready'),
    '{}'::jsonb
  )
  FROM public.site_personalization_assets a
  LEFT JOIN public.site_asset_uploads u ON u.id = a.upload_id;
$$;

CREATE OR REPLACE FUNCTION public.owner_get_storefront_personalization()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  RETURN public.get_storefront_personalization();
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_clear_storefront_personalization(p_slot_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF p_slot_key NOT IN (
    'top_banner_desktop','top_banner_mobile','hero_desktop','hero_mobile',
    'brasileirao_banner_desktop','brasileirao_banner_mobile',
    'ambient_banner_desktop','ambient_banner_mobile',
    'category_kids','category_training','category_shorts','category_basketball',
    'category_windbreaker','category_fifa','category_retro'
  ) THEN
    RAISE EXCEPTION 'Slot de personalizacao invalido';
  END IF;

  UPDATE public.site_personalization_assets
  SET upload_id = NULL,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE slot_key = p_slot_key;

  RETURN public.get_storefront_personalization();
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_personalization() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_get_storefront_personalization() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_clear_storefront_personalization(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_storefront_personalization() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_get_storefront_personalization() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_clear_storefront_personalization(text) TO authenticated;

COMMIT;