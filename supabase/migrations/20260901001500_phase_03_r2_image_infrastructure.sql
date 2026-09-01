BEGIN;

-- BIGofertas — Fase 03
-- Infraestrutura de imagens preparada para Cloudflare R2.
-- Esta migration NAO carrega imagens reais e NAO cria produtos.

DO $$
BEGIN
  CREATE TYPE public.product_image_status AS ENUM (
    'pending',
    'ready',
    'failed',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  original_filename text,
  alt_text text,
  mime_type text NOT NULL DEFAULT 'image/webp',
  status public.product_image_status NOT NULL DEFAULT 'pending'::public.product_image_status,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  width_px integer,
  height_px integer,
  byte_size bigint,
  etag text,
  checksum_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT product_images_storage_key_length
    CHECK (length(btrim(storage_key)) BETWEEN 3 AND 512),
  CONSTRAINT product_images_storage_key_relative
    CHECK (storage_key !~ '^/' AND storage_key !~ '(^|/)\.\.(/|$)'),
  CONSTRAINT product_images_original_filename_length
    CHECK (original_filename IS NULL OR length(original_filename) <= 255),
  CONSTRAINT product_images_alt_text_length
    CHECK (alt_text IS NULL OR length(alt_text) <= 300),
  CONSTRAINT product_images_mime_type_supported
    CHECK (mime_type IN ('image/webp', 'image/avif', 'image/jpeg', 'image/png')),
  CONSTRAINT product_images_sort_order_nonnegative
    CHECK (sort_order >= 0),
  CONSTRAINT product_images_dimensions_valid
    CHECK (
      (width_px IS NULL AND height_px IS NULL)
      OR (width_px > 0 AND height_px > 0)
    ),
  CONSTRAINT product_images_byte_size_positive
    CHECK (byte_size IS NULL OR byte_size > 0),
  CONSTRAINT product_images_checksum_sha256_valid
    CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT product_images_primary_must_be_ready
    CHECK (NOT is_primary OR status = 'ready'::public.product_image_status)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_images_storage_key_unique
  ON public.product_images (storage_key);

CREATE INDEX IF NOT EXISTS product_images_product_gallery_idx
  ON public.product_images (product_id, status, sort_order, created_at);

CREATE INDEX IF NOT EXISTS product_images_variant_gallery_idx
  ON public.product_images (variant_id, status, sort_order, created_at)
  WHERE variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_per_product
  ON public.product_images (product_id)
  WHERE is_primary
    AND status = 'ready'::public.product_image_status
    AND variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_per_variant
  ON public.product_images (variant_id)
  WHERE is_primary
    AND status = 'ready'::public.product_image_status
    AND variant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_product_image()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  variant_product_id uuid;
  has_primary boolean;
BEGIN
  NEW.storage_key := regexp_replace(replace(btrim(NEW.storage_key), E'\\', '/'), '/+', '/', 'g');
  NEW.mime_type := lower(btrim(NEW.mime_type));
  NEW.original_filename := NULLIF(btrim(NEW.original_filename), '');
  NEW.alt_text := NULLIF(btrim(NEW.alt_text), '');
  NEW.etag := NULLIF(btrim(NEW.etag), '');
  NEW.checksum_sha256 := lower(NULLIF(btrim(NEW.checksum_sha256), ''));

  IF NEW.storage_key = '' OR NEW.storage_key ~ '^/' OR NEW.storage_key ~ '(^|/)\.\.(/|$)' THEN
    RAISE EXCEPTION 'storage_key do R2 invalido';
  END IF;

  IF NEW.variant_id IS NOT NULL THEN
    SELECT v.product_id
    INTO variant_product_id
    FROM public.product_variants v
    WHERE v.id = NEW.variant_id;

    IF variant_product_id IS NULL THEN
      RAISE EXCEPTION 'Variante inexistente: %', NEW.variant_id;
    END IF;

    IF variant_product_id <> NEW.product_id THEN
      RAISE EXCEPTION 'A variante informada nao pertence ao produto da imagem';
    END IF;
  END IF;

  IF NEW.status <> 'ready'::public.product_image_status THEN
    NEW.is_primary := false;
  ELSIF NOT NEW.is_primary
    AND (
      TG_OP = 'INSERT'
      OR OLD.status IS DISTINCT FROM NEW.status
    ) THEN
    IF NEW.variant_id IS NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.product_images i
        WHERE i.product_id = NEW.product_id
          AND i.variant_id IS NULL
          AND i.status = 'ready'::public.product_image_status
          AND i.is_primary
          AND i.id <> NEW.id
      ) INTO has_primary;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.product_images i
        WHERE i.variant_id = NEW.variant_id
          AND i.status = 'ready'::public.product_image_status
          AND i.is_primary
          AND i.id <> NEW.id
      ) INTO has_primary;
    END IF;

    IF NOT has_primary THEN
      NEW.is_primary := true;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_product_image_before_write ON public.product_images;
CREATE TRIGGER prepare_product_image_before_write
BEFORE INSERT OR UPDATE ON public.product_images
FOR EACH ROW
EXECUTE FUNCTION public.prepare_product_image();

CREATE OR REPLACE FUNCTION public.set_primary_product_image(target_image_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_product_id uuid;
  target_variant_id uuid;
  target_status public.product_image_status;
BEGIN
  IF NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Permissao insuficiente'
      USING ERRCODE = '42501';
  END IF;

  SELECT i.product_id, i.variant_id, i.status
  INTO target_product_id, target_variant_id, target_status
  FROM public.product_images i
  WHERE i.id = target_image_id
  FOR UPDATE;

  IF target_product_id IS NULL THEN
    RAISE EXCEPTION 'Imagem inexistente: %', target_image_id;
  END IF;

  IF target_status <> 'ready'::public.product_image_status THEN
    RAISE EXCEPTION 'Somente imagens prontas podem ser definidas como principais';
  END IF;

  IF target_variant_id IS NULL THEN
    UPDATE public.product_images
    SET is_primary = false
    WHERE product_id = target_product_id
      AND variant_id IS NULL
      AND is_primary;
  ELSE
    UPDATE public.product_images
    SET is_primary = false
    WHERE variant_id = target_variant_id
      AND is_primary;
  END IF;

  UPDATE public.product_images
  SET is_primary = true
  WHERE id = target_image_id;
END;
$$;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_images_public_read_ready" ON public.product_images;
DROP POLICY IF EXISTS "product_images_owner_all" ON public.product_images;

CREATE POLICY "product_images_public_read_ready"
ON public.product_images
FOR SELECT
TO anon, authenticated
USING (
  status = 'ready'::public.product_image_status
  AND EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_id
      AND p.status = 'active'::public.product_status
  )
  AND (
    variant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.product_variants v
      WHERE v.id = variant_id
        AND v.product_id = product_id
        AND v.status = 'active'::public.product_variant_status
    )
  )
);

CREATE POLICY "product_images_owner_all"
ON public.product_images
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

GRANT SELECT ON public.product_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;

REVOKE ALL ON FUNCTION public.set_primary_product_image(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_primary_product_image(uuid) TO authenticated;

COMMENT ON TABLE public.product_images IS
  'Catalogo definitivo de imagens de produtos no Cloudflare R2. Guarda chaves de objeto; a URL publica e derivada da configuracao do ambiente.';

COMMENT ON COLUMN public.product_images.storage_key IS
  'Chave relativa do objeto no bucket R2, sem dominio e sem barra inicial. Ex.: products/<product_uuid>/<image_uuid>.webp.';

COMMENT ON COLUMN public.product_images.status IS
  'pending enquanto o upload nao foi confirmado; ready quando o objeto foi verificado no R2; failed para upload invalido; archived para retirada logica.';

COMMENT ON COLUMN public.products.image_url IS
  'Fallback legado temporario. A partir da Fase 03 o frontend prefere product_images/R2. Remover somente apos a carga definitiva de imagens reais perto do fim do projeto.';

COMMIT;
