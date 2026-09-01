-- BIGofertas - Fase 02: modelagem definitiva dos produtos
-- Escopo: identidade comercial, status, precificacao, categorias,
-- peso/dimensoes, opcoes/tamanhos, variantes, estoque e regras de banco.
-- Imagens permanecem deliberadamente fora da modelagem definitiva desta fase:
-- image_url e apenas compatibilidade temporaria ate a Fase 03 (Cloudflare R2).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'product_status'
  ) THEN
    CREATE TYPE public.product_status AS ENUM (
      'draft',
      'active',
      'inactive',
      'archived'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'product_variant_status'
  ) THEN
    CREATE TYPE public.product_variant_status AS ENUM (
      'active',
      'inactive',
      'archived'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'product_option_kind'
  ) THEN
    CREATE TYPE public.product_option_kind AS ENUM (
      'size',
      'style',
      'color',
      'other'
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.slugify(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT trim(
    BOTH '-'
    FROM regexp_replace(
      translate(
        lower(value),
        'áàãâäéèêëíìîïóòõôöúùûüçñýÿ',
        'aaaaaeeeeiiiiooooouuuucnyy'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Categorias normalizadas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT categories_sort_order_nonnegative CHECK (sort_order >= 0),
  CONSTRAINT categories_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique
  ON public.categories (slug);

CREATE INDEX IF NOT EXISTS categories_parent_id_idx
  ON public.categories (parent_id);

CREATE INDEX IF NOT EXISTS categories_active_sort_idx
  ON public.categories (is_active, sort_order, name);

CREATE OR REPLACE FUNCTION public.prepare_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.name := btrim(NEW.name);
  NEW.slug := public.slugify(COALESCE(NULLIF(btrim(NEW.slug), ''), NEW.name));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_category_before_write ON public.categories;
CREATE TRIGGER prepare_category_before_write
BEFORE INSERT OR UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.prepare_category();

-- ---------------------------------------------------------------------------
-- Produto principal
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS promotional_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS status public.product_status,
  ADD COLUMN IF NOT EXISTS primary_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight_grams integer,
  ADD COLUMN IF NOT EXISTS length_cm numeric(10, 2),
  ADD COLUMN IF NOT EXISTS width_cm numeric(10, 2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(10, 2);

-- Imagens incompletas nao podem impedir a existencia de produto real.
ALTER TABLE public.products
  ALTER COLUMN image_url DROP NOT NULL;

UPDATE public.products
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND btrim(image_url) = '';

UPDATE public.products
SET price = 0
WHERE price IS NULL;

UPDATE public.products
SET stock = 0
WHERE stock IS NULL;

UPDATE public.products
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.products
SET updated_at = now()
WHERE updated_at IS NULL;

UPDATE public.products
SET sku = 'BIG-' || upper(replace(id::text, '-', ''))
WHERE sku IS NULL OR btrim(sku) = '';

WITH product_slugs AS (
  SELECT
    id,
    CASE
      WHEN public.slugify(name) = '' THEN 'produto'
      ELSE public.slugify(name)
    END AS base_slug,
    row_number() OVER (
      PARTITION BY CASE
        WHEN public.slugify(name) = '' THEN 'produto'
        ELSE public.slugify(name)
      END
      ORDER BY created_at, id
    ) AS slug_position
  FROM public.products
  WHERE slug IS NULL OR btrim(slug) = ''
)
UPDATE public.products p
SET slug = CASE
  WHEN ps.slug_position = 1 THEN ps.base_slug
  ELSE ps.base_slug || '-' || substr(replace(p.id::text, '-', ''), 1, 8)
END
FROM product_slugs ps
WHERE p.id = ps.id;

-- Produtos que ja existiam no catalogo continuam visiveis apos a migracao.
UPDATE public.products
SET status = 'active'::public.product_status
WHERE status IS NULL;

ALTER TABLE public.products
  ALTER COLUMN sku SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft'::public.product_status,
  ALTER COLUMN stock SET NOT NULL,
  ALTER COLUMN stock SET DEFAULT 0,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_name_not_blank'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_name_not_blank
      CHECK (length(btrim(name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_price_nonnegative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_nonnegative
      CHECK (price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_promotional_price_valid'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_promotional_price_valid
      CHECK (
        promotional_price IS NULL
        OR (promotional_price >= 0 AND promotional_price < price)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_stock_nonnegative'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_nonnegative
      CHECK (stock >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_weight_positive'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_weight_positive
      CHECK (weight_grams IS NULL OR weight_grams > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_dimensions_positive'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_dimensions_positive
      CHECK (
        (length_cm IS NULL OR length_cm > 0)
        AND (width_cm IS NULL OR width_cm > 0)
        AND (height_cm IS NULL OR height_cm > 0)
      );
  END IF;


  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_dimensions_complete'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_dimensions_complete
      CHECK (num_nonnulls(length_cm, width_cm, height_cm) IN (0, 3));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_sku_not_blank'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sku_not_blank
      CHECK (length(btrim(sku)) BETWEEN 3 AND 64);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_sku_format'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sku_format
      CHECK (sku ~ '^[A-Z0-9][A-Z0-9._-]{2,63}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_slug_format'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_slug_format
      CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique_ci
  ON public.products (lower(sku));

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique
  ON public.products (slug);

CREATE INDEX IF NOT EXISTS products_status_idx
  ON public.products (status);

CREATE INDEX IF NOT EXISTS products_primary_category_idx
  ON public.products (primary_category_id);

CREATE INDEX IF NOT EXISTS products_catalog_sort_idx
  ON public.products (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.prepare_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  resolved_category_name text;
BEGIN
  NEW.name := btrim(NEW.name);
  NEW.sku := upper(
    trim(
      BOTH '-'
      FROM regexp_replace(btrim(NEW.sku), '[^A-Za-z0-9._-]+', '-', 'g')
    )
  );

  NEW.slug := public.slugify(
    COALESCE(NULLIF(btrim(NEW.slug), ''), NEW.name)
  );

  IF TG_OP = 'INSERT' THEN
    -- Estoque do produto e sempre derivado das variantes.
    NEW.stock := 0;
  END IF;

  IF NEW.primary_category_id IS NOT NULL THEN
    SELECT c.name
    INTO resolved_category_name
    FROM public.categories c
    WHERE c.id = NEW.primary_category_id;

    IF resolved_category_name IS NULL THEN
      RAISE EXCEPTION 'Categoria principal inexistente: %', NEW.primary_category_id;
    END IF;

    -- Coluna antiga mantida apenas como cache de compatibilidade ate a Fase 04.
    NEW.category := resolved_category_name;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_product_before_write ON public.products;
CREATE TRIGGER prepare_product_before_write
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.prepare_product();

-- Migra categorias textuais existentes para a estrutura normalizada.
WITH source_categories AS (
  SELECT DISTINCT btrim(category) AS name
  FROM public.products
  WHERE category IS NOT NULL
    AND btrim(category) <> ''
), ranked_categories AS (
  SELECT
    name,
    CASE
      WHEN public.slugify(name) = '' THEN 'categoria'
      ELSE public.slugify(name)
    END AS base_slug,
    row_number() OVER (
      PARTITION BY CASE
        WHEN public.slugify(name) = '' THEN 'categoria'
        ELSE public.slugify(name)
      END
      ORDER BY name
    ) AS slug_position
  FROM source_categories
)
INSERT INTO public.categories (name, slug)
SELECT
  name,
  CASE
    WHEN slug_position = 1 THEN base_slug
    ELSE base_slug || '-' || substr(md5(name), 1, 6)
  END
FROM ranked_categories
ON CONFLICT (slug) DO NOTHING;

UPDATE public.products p
SET primary_category_id = c.id
FROM public.categories c
WHERE p.primary_category_id IS NULL
  AND p.category IS NOT NULL
  AND lower(btrim(p.category)) = lower(btrim(c.name));

CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS product_categories_category_idx
  ON public.product_categories (category_id, product_id);

INSERT INTO public.product_categories (product_id, category_id)
SELECT id, primary_category_id
FROM public.products
WHERE primary_category_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_primary_category_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.primary_category_id IS NOT NULL THEN
    INSERT INTO public.product_categories (product_id, category_id)
    VALUES (NEW.id, NEW.primary_category_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_primary_category_membership_after_write ON public.products;
CREATE TRIGGER sync_primary_category_membership_after_write
AFTER INSERT OR UPDATE OF primary_category_id ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_primary_category_membership();

CREATE OR REPLACE FUNCTION public.sync_legacy_category_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.products
    SET category = NEW.name
    WHERE primary_category_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_legacy_category_name_after_update ON public.categories;
CREATE TRIGGER sync_legacy_category_name_after_update
AFTER UPDATE OF name ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.sync_legacy_category_name();

-- ---------------------------------------------------------------------------
-- Opcoes e valores (Tamanho, Versao, Cor etc.)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind public.product_option_kind NOT NULL DEFAULT 'other'::public.product_option_kind,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_options_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT product_options_sort_order_nonnegative CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_options_name_unique_ci
  ON public.product_options (product_id, lower(name));

CREATE INDEX IF NOT EXISTS product_options_product_sort_idx
  ON public.product_options (product_id, sort_order, name);

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_option_values_value_not_blank CHECK (length(btrim(value)) > 0),
  CONSTRAINT product_option_values_sort_order_nonnegative CHECK (sort_order >= 0),
  CONSTRAINT product_option_values_id_option_unique UNIQUE (id, option_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_option_values_unique_ci
  ON public.product_option_values (option_id, lower(value));

CREATE INDEX IF NOT EXISTS product_option_values_option_sort_idx
  ON public.product_option_values (option_id, sort_order, value);

CREATE OR REPLACE FUNCTION public.touch_product_configuration_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_product_options_updated_at ON public.product_options;
CREATE TRIGGER touch_product_options_updated_at
BEFORE UPDATE ON public.product_options
FOR EACH ROW
EXECUTE FUNCTION public.touch_product_configuration_updated_at();

DROP TRIGGER IF EXISTS touch_product_option_values_updated_at ON public.product_option_values;
CREATE TRIGGER touch_product_option_values_updated_at
BEFORE UPDATE ON public.product_option_values
FOR EACH ROW
EXECUTE FUNCTION public.touch_product_configuration_updated_at();

-- ---------------------------------------------------------------------------
-- Variantes comerciais e estoque
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text,
  status public.product_variant_status NOT NULL DEFAULT 'active'::public.product_variant_status,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  price_override numeric(10, 2),
  promotional_price_override numeric(10, 2),
  stock_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_sku_not_blank CHECK (length(btrim(sku)) BETWEEN 3 AND 64),
  CONSTRAINT product_variants_sort_order_nonnegative CHECK (sort_order >= 0),
  CONSTRAINT product_variants_price_nonnegative CHECK (price_override IS NULL OR price_override >= 0),
  CONSTRAINT product_variants_promo_nonnegative CHECK (
    promotional_price_override IS NULL OR promotional_price_override >= 0
  ),
  CONSTRAINT product_variants_local_promo_valid CHECK (
    promotional_price_override IS NULL
    OR price_override IS NULL
    OR promotional_price_override < price_override
  ),
  CONSTRAINT product_variants_stock_nonnegative CHECK (stock_quantity >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_unique_ci
  ON public.product_variants (lower(sku));

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_one_default_per_product
  ON public.product_variants (product_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS product_variants_product_status_idx
  ON public.product_variants (product_id, status, sort_order);

CREATE TABLE IF NOT EXISTS public.product_variant_values (
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.product_options(id) ON DELETE CASCADE,
  option_value_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, option_id),
  CONSTRAINT product_variant_values_option_value_fk
    FOREIGN KEY (option_value_id, option_id)
    REFERENCES public.product_option_values(id, option_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS product_variant_values_value_idx
  ON public.product_variant_values (option_value_id, variant_id);

CREATE OR REPLACE FUNCTION public.prepare_product_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_price numeric(10, 2);
  parent_promotional_price numeric(10, 2);
  effective_price numeric(10, 2);
  effective_promotional_price numeric(10, 2);
BEGIN
  NEW.sku := upper(
    trim(
      BOTH '-'
      FROM regexp_replace(btrim(NEW.sku), '[^A-Za-z0-9._-]+', '-', 'g')
    )
  );
  NEW.name := NULLIF(btrim(NEW.name), '');
  NEW.updated_at := now();

  SELECT p.price, p.promotional_price
  INTO parent_price, parent_promotional_price
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF parent_price IS NULL THEN
    RAISE EXCEPTION 'Produto pai inexistente para a variante: %', NEW.product_id;
  END IF;

  effective_price := COALESCE(NEW.price_override, parent_price);
  effective_promotional_price := COALESCE(
    NEW.promotional_price_override,
    CASE
      WHEN NEW.price_override IS NULL THEN parent_promotional_price
      ELSE NULL
    END
  );

  IF effective_promotional_price IS NOT NULL
     AND effective_promotional_price >= effective_price THEN
    RAISE EXCEPTION 'Preco promocional efetivo deve ser menor que o preco efetivo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_product_variant_before_write ON public.product_variants;
CREATE TRIGGER prepare_product_variant_before_write
BEFORE INSERT OR UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.prepare_product_variant();

CREATE OR REPLACE FUNCTION public.validate_variant_option_value()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  variant_product_id uuid;
  option_product_id uuid;
BEGIN
  SELECT v.product_id
  INTO variant_product_id
  FROM public.product_variants v
  WHERE v.id = NEW.variant_id;

  SELECT o.product_id
  INTO option_product_id
  FROM public.product_options o
  WHERE o.id = NEW.option_id;

  IF variant_product_id IS NULL OR option_product_id IS NULL THEN
    RAISE EXCEPTION 'Variante ou opcao inexistente';
  END IF;

  IF variant_product_id <> option_product_id THEN
    RAISE EXCEPTION 'Opcao e variante devem pertencer ao mesmo produto';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_variant_option_value_before_write ON public.product_variant_values;
CREATE TRIGGER validate_variant_option_value_before_write
BEFORE INSERT OR UPDATE ON public.product_variant_values
FOR EACH ROW
EXECUTE FUNCTION public.validate_variant_option_value();

-- Migra o estoque antigo para uma variante padrao real.
INSERT INTO public.product_variants (
  product_id,
  sku,
  name,
  status,
  is_default,
  sort_order,
  stock_quantity
)
SELECT
  p.id,
  left(p.sku, 55) || '-DEFAULT',
  NULL,
  'active'::public.product_variant_status,
  true,
  0,
  p.stock
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_variants v
  WHERE v.product_id = p.id
)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_product_stock(target_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_sync_setting text;
BEGIN
  previous_sync_setting := COALESCE(
    current_setting('bigofertas.stock_sync', true),
    ''
  );
  PERFORM set_config('bigofertas.stock_sync', 'on', true);

  UPDATE public.products p
  SET stock = COALESCE((
    SELECT sum(v.stock_quantity)::integer
    FROM public.product_variants v
    WHERE v.product_id = target_product_id
      AND v.status = 'active'::public.product_variant_status
  ), 0)
  WHERE p.id = target_product_id;

  PERFORM set_config('bigofertas.stock_sync', previous_sync_setting, true);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('bigofertas.stock_sync', previous_sync_setting, true);
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_stock_from_variants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_product_stock(OLD.product_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_product_stock(NEW.product_id);

  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    PERFORM public.refresh_product_stock(OLD.product_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_product_stock_after_variant_write ON public.product_variants;
CREATE TRIGGER sync_product_stock_after_variant_write
AFTER INSERT OR UPDATE OF product_id, stock_quantity, status OR DELETE
ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_stock_from_variants();

CREATE OR REPLACE FUNCTION public.protect_product_stock_cache()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock
     AND COALESCE(current_setting('bigofertas.stock_sync', true), '') <> 'on' THEN
    RAISE EXCEPTION 'products.stock e calculado pelas variantes; altere product_variants.stock_quantity';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_product_stock_cache_before_update ON public.products;
CREATE TRIGGER protect_product_stock_cache_before_update
BEFORE UPDATE OF stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.protect_product_stock_cache();

-- Garante que o cache esteja correto ao final da migracao.
DO $$
DECLARE
  product_record record;
BEGIN
  FOR product_record IN SELECT id FROM public.products LOOP
    PERFORM public.refresh_product_stock(product_record.id);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.block_last_active_variant_removal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_status public.product_status;
  remaining_active_variants integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'::public.product_variant_status
     AND NEW.status = 'active'::public.product_variant_status
     AND OLD.product_id = NEW.product_id THEN
    RETURN NEW;
  END IF;

  SELECT p.status
  INTO parent_status
  FROM public.products p
  WHERE p.id = OLD.product_id;

  IF parent_status <> 'active'::public.product_status THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;

    RETURN NEW;
  END IF;

  SELECT count(*)::integer
  INTO remaining_active_variants
  FROM public.product_variants v
  WHERE v.product_id = OLD.product_id
    AND v.id <> OLD.id
    AND v.status = 'active'::public.product_variant_status;

  IF remaining_active_variants = 0 THEN
    RAISE EXCEPTION 'Produto ativo precisa manter ao menos uma variante ativa';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_last_active_variant_removal_before_write ON public.product_variants;
CREATE TRIGGER block_last_active_variant_removal_before_write
BEFORE DELETE OR UPDATE OF status, product_id ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.block_last_active_variant_removal();

CREATE OR REPLACE FUNCTION public.validate_product_activation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'active'::public.product_status
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NOT EXISTS (
       SELECT 1
       FROM public.product_variants v
       WHERE v.product_id = NEW.id
         AND v.status = 'active'::public.product_variant_status
     ) THEN
    RAISE EXCEPTION 'Produto so pode ser ativado quando possuir ao menos uma variante ativa';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_activation_before_write ON public.products;
CREATE TRIGGER validate_product_activation_before_write
BEFORE INSERT OR UPDATE OF status ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_activation();

-- ---------------------------------------------------------------------------
-- RLS e permissoes
-- ---------------------------------------------------------------------------

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Only admin can insert products" ON public.products;
DROP POLICY IF EXISTS "Only admin can update products" ON public.products;
DROP POLICY IF EXISTS "Only admin can delete products" ON public.products;
DROP POLICY IF EXISTS "products_public_read_active" ON public.products;
DROP POLICY IF EXISTS "products_owner_read_all" ON public.products;
DROP POLICY IF EXISTS "products_owner_insert" ON public.products;
DROP POLICY IF EXISTS "products_owner_update" ON public.products;
DROP POLICY IF EXISTS "products_owner_delete" ON public.products;

CREATE POLICY "products_public_read_active"
ON public.products
FOR SELECT
TO anon, authenticated
USING (status = 'active'::public.product_status);

CREATE POLICY "products_owner_read_all"
ON public.products
FOR SELECT
TO authenticated
USING (public.has_role('owner'::public.app_role));

CREATE POLICY "products_owner_insert"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.has_role('owner'::public.app_role));

CREATE POLICY "products_owner_update"
ON public.products
FOR UPDATE
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

CREATE POLICY "products_owner_delete"
ON public.products
FOR DELETE
TO authenticated
USING (public.has_role('owner'::public.app_role));

CREATE POLICY "categories_public_read_active"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (is_active);

CREATE POLICY "categories_owner_all"
ON public.categories
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

CREATE POLICY "product_categories_public_read_active"
ON public.product_categories
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_id
      AND p.status = 'active'::public.product_status
  )
  AND EXISTS (
    SELECT 1
    FROM public.categories c
    WHERE c.id = category_id
      AND c.is_active
  )
);

CREATE POLICY "product_categories_owner_all"
ON public.product_categories
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

CREATE POLICY "product_options_public_read_active"
ON public.product_options
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
      AND p.status = 'active'::public.product_status
  )
);

CREATE POLICY "product_options_owner_all"
ON public.product_options
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

CREATE POLICY "product_option_values_public_read_active"
ON public.product_option_values
FOR SELECT
TO anon, authenticated
USING (
  is_active
  AND EXISTS (
    SELECT 1
    FROM public.product_options o
    JOIN public.products p ON p.id = o.product_id
    WHERE o.id = option_id
      AND p.status = 'active'::public.product_status
  )
);

CREATE POLICY "product_option_values_owner_all"
ON public.product_option_values
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

CREATE POLICY "product_variants_public_read_active"
ON public.product_variants
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'::public.product_variant_status
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_id
      AND p.status = 'active'::public.product_status
  )
);

CREATE POLICY "product_variants_owner_all"
ON public.product_variants
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

CREATE POLICY "product_variant_values_public_read_active"
ON public.product_variant_values
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_variants v
    JOIN public.products p ON p.id = v.product_id
    WHERE v.id = variant_id
      AND v.status = 'active'::public.product_variant_status
      AND p.status = 'active'::public.product_status
  )
);

CREATE POLICY "product_variant_values_owner_all"
ON public.product_variant_values
FOR ALL
TO authenticated
USING (public.has_role('owner'::public.app_role))
WITH CHECK (public.has_role('owner'::public.app_role));

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT ON public.product_options TO anon;
GRANT SELECT ON public.product_option_values TO anon;
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT ON public.product_variant_values TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_values TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variant_values TO authenticated;

GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.product_categories TO service_role;
GRANT ALL ON public.product_options TO service_role;
GRANT ALL ON public.product_option_values TO service_role;
GRANT ALL ON public.product_variants TO service_role;
GRANT ALL ON public.product_variant_values TO service_role;

REVOKE ALL ON FUNCTION public.slugify(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slugify(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.refresh_product_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_product_stock(uuid) TO service_role;

COMMENT ON COLUMN public.products.image_url IS
  'Compatibilidade temporaria da Fase 02. A origem definitiva das imagens sera modelada na Fase 03 com Cloudflare R2.';

COMMENT ON COLUMN public.products.stock IS
  'Cache agregado das variantes ativas. Nao editar diretamente; a transacao de reserva/decremento sera endurecida na Fase 11.';

COMMENT ON COLUMN public.products.category IS
  'Cache textual legado. categories/product_categories sao a estrutura normalizada a partir da Fase 02.';

COMMIT;
