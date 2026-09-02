BEGIN;

-- Fase 10 — núcleo definitivo de pedidos da BIGofertas.
-- A loja produz sob encomenda. Nenhuma operação abaixo reserva, baixa,
-- consome ou repõe estoque.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'order_status'
  ) THEN
    CREATE TYPE public.order_status AS ENUM (
      'pending_payment',
      'paid',
      'in_production',
      'shipped',
      'delivered',
      'canceled',
      'refunded'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'order_payment_status'
  ) THEN
    CREATE TYPE public.order_payment_status AS ENUM (
      'pending',
      'paid',
      'failed',
      'canceled',
      'refunded'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'refund_request_status'
  ) THEN
    CREATE TYPE public.refund_request_status AS ENUM (
      'requested',
      'refunded',
      'canceled'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'order_actor_type'
  ) THEN
    CREATE TYPE public.order_actor_type AS ENUM (
      'system',
      'customer',
      'owner',
      'integration'
    );
  END IF;
END
$$;

CREATE SEQUENCE IF NOT EXISTS public.order_public_number_seq
  AS bigint
  MINVALUE 1
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_address_id uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  idempotency_key text,
  status public.order_status NOT NULL DEFAULT 'pending_payment'::public.order_status,
  payment_status public.order_payment_status NOT NULL DEFAULT 'pending'::public.order_payment_status,

  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,

  address_recipient_name text NOT NULL,
  address_postal_code text NOT NULL,
  address_street text NOT NULL,
  address_number text NOT NULL,
  address_complement text,
  address_neighborhood text NOT NULL,
  address_city text NOT NULL,
  address_state text NOT NULL,

  production_business_days smallint NOT NULL DEFAULT 5,

  subtotal_amount numeric(12, 2) NOT NULL,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  shipping_base_amount numeric(12, 2) NOT NULL DEFAULT 0,
  shipping_additional_amount numeric(12, 2) NOT NULL DEFAULT 0,
  shipping_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',

  shipping_provider text,
  shipping_service text,
  shipping_quote_reference text,
  shipping_transit_business_days smallint,
  shipping_quoted_at timestamptz,
  shipping_tracking_code text,

  payment_provider text,
  payment_reference text,
  payment_method text,
  paid_amount numeric(12, 2),

  paid_at timestamptz,
  production_started_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT orders_public_number_format
    CHECK (public_number ~ '^BIG-[0-9]{4}-[0-9]{6,}$'),
  CONSTRAINT orders_idempotency_key_valid
    CHECK (idempotency_key IS NULL OR length(idempotency_key) BETWEEN 8 AND 120),
  CONSTRAINT orders_customer_name_valid
    CHECK (length(btrim(customer_name)) BETWEEN 2 AND 120),
  CONSTRAINT orders_customer_email_valid
    CHECK (length(btrim(customer_email)) BETWEEN 3 AND 320),
  CONSTRAINT orders_customer_phone_valid
    CHECK (customer_phone ~ '^[0-9]{10,11}$'),
  CONSTRAINT orders_address_postal_code_valid
    CHECK (address_postal_code ~ '^[0-9]{8}$'),
  CONSTRAINT orders_address_state_valid
    CHECK (address_state ~ '^[A-Z]{2}$'),
  CONSTRAINT orders_production_term_fixed
    CHECK (production_business_days = 5),
  CONSTRAINT orders_amounts_nonnegative CHECK (
    subtotal_amount >= 0
    AND discount_amount >= 0
    AND shipping_base_amount >= 0
    AND shipping_additional_amount >= 0
    AND shipping_amount >= 0
    AND total_amount >= 0
    AND (paid_amount IS NULL OR paid_amount >= 0)
  ),
  CONSTRAINT orders_discount_not_above_subtotal
    CHECK (discount_amount <= subtotal_amount),
  CONSTRAINT orders_shipping_composition
    CHECK (shipping_amount = shipping_base_amount + shipping_additional_amount),
  CONSTRAINT orders_total_composition
    CHECK (total_amount = subtotal_amount - discount_amount + shipping_amount),
  CONSTRAINT orders_currency_brl CHECK (currency = 'BRL'),
  CONSTRAINT orders_shipping_transit_valid
    CHECK (
      shipping_transit_business_days IS NULL
      OR shipping_transit_business_days BETWEEN 0 AND 120
    ),
  CONSTRAINT orders_user_idempotency_unique UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS orders_user_created_idx
  ON public.orders (user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON public.orders (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS orders_customer_search_idx
  ON public.orders (lower(customer_email), created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_slug text,
  product_sku text NOT NULL,
  variant_name text,
  variant_sku text NOT NULL,
  selected_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_storage_key text,
  image_url text,
  image_alt_text text,
  quantity integer NOT NULL,
  unit_price numeric(12, 2) NOT NULL,
  line_total numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT order_items_product_name_valid
    CHECK (length(btrim(product_name)) > 0),
  CONSTRAINT order_items_product_sku_valid
    CHECK (length(btrim(product_sku)) > 0),
  CONSTRAINT order_items_variant_sku_valid
    CHECK (length(btrim(variant_sku)) > 0),
  CONSTRAINT order_items_options_array
    CHECK (jsonb_typeof(selected_options) = 'array'),
  CONSTRAINT order_items_quantity_valid
    CHECK (quantity BETWEEN 1 AND 99),
  CONSTRAINT order_items_prices_nonnegative
    CHECK (unit_price >= 0 AND line_total >= 0),
  CONSTRAINT order_items_total_composition
    CHECK (line_total = unit_price * quantity)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx
  ON public.order_items (order_id, created_at, id);

CREATE TABLE IF NOT EXISTS public.order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type public.order_actor_type NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT order_timeline_event_type_valid CHECK (
    event_type IN (
      'order_created',
      'payment_confirmed',
      'production_started',
      'order_shipped',
      'order_delivered',
      'order_canceled',
      'refund_requested',
      'refund_confirmed',
      'refund_canceled'
    )
  ),
  CONSTRAINT order_timeline_message_valid
    CHECK (message IS NULL OR length(message) <= 500)
);

CREATE INDEX IF NOT EXISTS order_timeline_order_created_idx
  ON public.order_timeline (order_id, created_at, id);

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  message text,
  status public.refund_request_status NOT NULL DEFAULT 'requested'::public.refund_request_status,
  order_status_at_request public.order_status NOT NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT refund_requests_reason_valid CHECK (
    reason IN ('arrependimento', 'tamanho', 'produto', 'entrega', 'outro')
  ),
  CONSTRAINT refund_requests_message_valid
    CHECK (message IS NULL OR length(message) BETWEEN 3 AND 1000),
  CONSTRAINT refund_requests_other_requires_message
    CHECK (reason <> 'outro' OR message IS NOT NULL),
  CONSTRAINT refund_requests_resolution_consistent CHECK (
    (status = 'requested'::public.refund_request_status AND resolved_at IS NULL AND resolved_by IS NULL)
    OR
    (status <> 'requested'::public.refund_request_status AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS refund_requests_status_created_idx
  ON public.refund_requests (status, created_at DESC, id DESC);

-- Outbox mínimo para integrações reais de e-mail futuras. O payload não contém
-- CPF, telefone nem endereço e não é legível pelo navegador.
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,

  CONSTRAINT notification_events_name_valid CHECK (
    event_name IN (
      'account.confirmed',
      'order.paid',
      'order.refunded',
      'order.delivered'
    )
  ),
  CONSTRAINT notification_events_payload_object
    CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT notification_events_idempotency_valid
    CHECK (length(idempotency_key) BETWEEN 8 AND 180)
);

CREATE INDEX IF NOT EXISTS notification_events_pending_idx
  ON public.notification_events (occurred_at, id)
  WHERE processed_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_order_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_orders_updated_at ON public.orders;
CREATE TRIGGER touch_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.touch_order_updated_at();

DROP TRIGGER IF EXISTS touch_refund_requests_updated_at ON public.refund_requests;
CREATE TRIGGER touch_refund_requests_updated_at
BEFORE UPDATE ON public.refund_requests
FOR EACH ROW
EXECUTE FUNCTION public.touch_order_updated_at();

CREATE OR REPLACE FUNCTION public.protect_order_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.public_number IS DISTINCT FROM OLD.public_number
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
     OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
     OR NEW.address_recipient_name IS DISTINCT FROM OLD.address_recipient_name
     OR NEW.address_postal_code IS DISTINCT FROM OLD.address_postal_code
     OR NEW.address_street IS DISTINCT FROM OLD.address_street
     OR NEW.address_number IS DISTINCT FROM OLD.address_number
     OR NEW.address_complement IS DISTINCT FROM OLD.address_complement
     OR NEW.address_neighborhood IS DISTINCT FROM OLD.address_neighborhood
     OR NEW.address_city IS DISTINCT FROM OLD.address_city
     OR NEW.address_state IS DISTINCT FROM OLD.address_state
     OR NEW.production_business_days IS DISTINCT FROM OLD.production_business_days
     OR NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.shipping_base_amount IS DISTINCT FROM OLD.shipping_base_amount
     OR NEW.shipping_additional_amount IS DISTINCT FROM OLD.shipping_additional_amount
     OR NEW.shipping_amount IS DISTINCT FROM OLD.shipping_amount
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.shipping_provider IS DISTINCT FROM OLD.shipping_provider
     OR NEW.shipping_service IS DISTINCT FROM OLD.shipping_service
     OR NEW.shipping_quote_reference IS DISTINCT FROM OLD.shipping_quote_reference
     OR NEW.shipping_transit_business_days IS DISTINCT FROM OLD.shipping_transit_business_days
     OR NEW.shipping_quoted_at IS DISTINCT FROM OLD.shipping_quoted_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Snapshots e valores historicos do pedido nao podem ser alterados';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_order_snapshot_before_update ON public.orders;
CREATE TRIGGER protect_order_snapshot_before_update
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_order_snapshot();

CREATE OR REPLACE FUNCTION public.block_order_item_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Itens historicos do pedido nao podem ser excluidos';
  END IF;

  IF NEW.order_id IS DISTINCT FROM OLD.order_id
     OR (NEW.product_id IS DISTINCT FROM OLD.product_id AND NEW.product_id IS NOT NULL)
     OR (NEW.variant_id IS DISTINCT FROM OLD.variant_id AND NEW.variant_id IS NOT NULL)
     OR NEW.product_name IS DISTINCT FROM OLD.product_name
     OR NEW.product_slug IS DISTINCT FROM OLD.product_slug
     OR NEW.product_sku IS DISTINCT FROM OLD.product_sku
     OR NEW.variant_name IS DISTINCT FROM OLD.variant_name
     OR NEW.variant_sku IS DISTINCT FROM OLD.variant_sku
     OR NEW.selected_options IS DISTINCT FROM OLD.selected_options
     OR NEW.image_storage_key IS DISTINCT FROM OLD.image_storage_key
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.image_alt_text IS DISTINCT FROM OLD.image_alt_text
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.unit_price IS DISTINCT FROM OLD.unit_price
     OR NEW.line_total IS DISTINCT FROM OLD.line_total
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Snapshots historicos dos itens nao podem ser alterados';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_order_item_update_or_delete ON public.order_items;
CREATE TRIGGER block_order_item_update_or_delete
BEFORE UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.block_order_item_mutation();

CREATE OR REPLACE FUNCTION public.next_order_public_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    'BIG-'
    || to_char(CURRENT_DATE, 'YYYY')
    || '-'
    || lpad(nextval('public.order_public_number_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.create_order_core(
  p_user_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_shipping jsonb DEFAULT NULL,
  p_payment jsonb DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_record record;
  address_record record;
  product_record record;
  variant_record record;
  item jsonb;
  product_id_value uuid;
  variant_id_value uuid;
  quantity_value integer;
  unit_price_value numeric(12, 2);
  line_total_value numeric(12, 2);
  subtotal_value numeric(12, 2) := 0;
  shipping_base_value numeric(12, 2) := 0;
  shipping_additional_value numeric(12, 2) := 0;
  shipping_total_value numeric(12, 2) := 0;
  discount_value numeric(12, 2) := COALESCE(p_discount_amount, 0);
  options_value jsonb;
  image_storage_key_value text;
  image_alt_text_value text;
  resolved_items jsonb := '[]'::jsonb;
  resolved_item jsonb;
  normalized_idempotency_key text := NULLIF(btrim(p_idempotency_key), '');
  created_order public.orders%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_address_id IS NULL THEN
    RAISE EXCEPTION 'Usuario e endereco sao obrigatorios';
  END IF;

  IF normalized_idempotency_key IS NOT NULL
     AND length(normalized_idempotency_key) NOT BETWEEN 8 AND 120 THEN
    RAISE EXCEPTION 'Chave de idempotencia invalida';
  END IF;

  IF normalized_idempotency_key IS NOT NULL THEN
    SELECT o.*
    INTO created_order
    FROM public.orders AS o
    WHERE o.user_id = p_user_id
      AND o.idempotency_key = normalized_idempotency_key;

    IF FOUND THEN
      RETURN created_order;
    END IF;
  END IF;

  SELECT p.full_name, p.email, p.phone
  INTO profile_record
  FROM public.profiles AS p
  WHERE p.id = p_user_id;

  IF profile_record IS NULL
     OR length(btrim(COALESCE(profile_record.full_name, ''))) < 2
     OR length(btrim(COALESCE(profile_record.email, ''))) < 3
     OR COALESCE(profile_record.phone, '') !~ '^[0-9]{10,11}$' THEN
    RAISE EXCEPTION 'A conta precisa ter nome, email e telefone validos';
  END IF;

  SELECT a.*
  INTO address_record
  FROM public.customer_addresses AS a
  WHERE a.id = p_address_id
    AND a.user_id = p_user_id;

  IF address_record IS NULL THEN
    RAISE EXCEPTION 'Endereco de entrega invalido';
  END IF;

  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'O pedido precisa ter entre 1 e 100 itens';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF COALESCE(item->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR COALESCE(item->>'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR COALESCE(item->>'quantity', '') !~ '^[1-9][0-9]?$' THEN
      RAISE EXCEPTION 'Item do pedido invalido';
    END IF;

    product_id_value := (item->>'product_id')::uuid;
    variant_id_value := (item->>'variant_id')::uuid;
    quantity_value := (item->>'quantity')::integer;

    SELECT
      p.id,
      p.name,
      p.slug,
      p.sku,
      p.price,
      p.promotional_price,
      p.image_url
    INTO product_record
    FROM public.products AS p
    WHERE p.id = product_id_value
      AND p.status = 'active'::public.product_status;

    SELECT
      v.id,
      v.product_id,
      v.name,
      v.sku,
      v.price_override,
      v.promotional_price_override
    INTO variant_record
    FROM public.product_variants AS v
    WHERE v.id = variant_id_value
      AND v.product_id = product_id_value
      AND v.status = 'active'::public.product_variant_status;

    IF product_record IS NULL OR variant_record IS NULL THEN
      RAISE EXCEPTION 'Produto ou variante indisponivel';
    END IF;

    unit_price_value := COALESCE(
      variant_record.promotional_price_override,
      CASE
        WHEN variant_record.price_override IS NULL
        THEN product_record.promotional_price
        ELSE NULL
      END,
      variant_record.price_override,
      product_record.price
    );
    line_total_value := unit_price_value * quantity_value;
    subtotal_value := subtotal_value + line_total_value;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'option_id', option_record.id,
          'option_name', option_record.name,
          'option_kind', option_record.kind,
          'value_id', value_record.id,
          'value_label', value_record.value
        )
        ORDER BY option_record.sort_order, option_record.name
      ),
      '[]'::jsonb
    )
    INTO options_value
    FROM public.product_variant_values AS relation
    JOIN public.product_options AS option_record
      ON option_record.id = relation.option_id
    JOIN public.product_option_values AS value_record
      ON value_record.id = relation.option_value_id
    WHERE relation.variant_id = variant_id_value;

    SELECT image_record.storage_key, image_record.alt_text
    INTO image_storage_key_value, image_alt_text_value
    FROM public.product_images AS image_record
    WHERE image_record.product_id = product_id_value
      AND image_record.status = 'ready'::public.product_image_status
      AND (image_record.variant_id = variant_id_value OR image_record.variant_id IS NULL)
    ORDER BY
      CASE WHEN image_record.variant_id = variant_id_value THEN 0 ELSE 1 END,
      image_record.is_primary DESC,
      image_record.sort_order,
      image_record.created_at
    LIMIT 1;

    resolved_items := resolved_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', product_id_value,
        'variant_id', variant_id_value,
        'product_name', product_record.name,
        'product_slug', product_record.slug,
        'product_sku', product_record.sku,
        'variant_name', variant_record.name,
        'variant_sku', variant_record.sku,
        'selected_options', options_value,
        'image_storage_key', image_storage_key_value,
        'image_url', product_record.image_url,
        'image_alt_text', COALESCE(image_alt_text_value, product_record.name),
        'quantity', quantity_value,
        'unit_price', unit_price_value,
        'line_total', line_total_value
      )
    );

    image_storage_key_value := NULL;
    image_alt_text_value := NULL;
  END LOOP;

  IF discount_value < 0 OR discount_value > subtotal_value THEN
    RAISE EXCEPTION 'Desconto invalido';
  END IF;

  IF p_shipping IS NOT NULL THEN
    IF jsonb_typeof(p_shipping) <> 'object' THEN
      RAISE EXCEPTION 'Snapshot de frete invalido';
    END IF;

    shipping_base_value := COALESCE(NULLIF(p_shipping->>'base_amount', '')::numeric, 0);
    shipping_additional_value := COALESCE(NULLIF(p_shipping->>'additional_amount', '')::numeric, 0);
    shipping_total_value := COALESCE(
      NULLIF(p_shipping->>'amount', '')::numeric,
      shipping_base_value + shipping_additional_value
    );
  END IF;

  IF shipping_base_value < 0
     OR shipping_additional_value < 0
     OR shipping_total_value <> shipping_base_value + shipping_additional_value THEN
    RAISE EXCEPTION 'Valores de frete invalidos';
  END IF;

  INSERT INTO public.orders (
    public_number,
    user_id,
    source_address_id,
    idempotency_key,
    customer_name,
    customer_email,
    customer_phone,
    address_recipient_name,
    address_postal_code,
    address_street,
    address_number,
    address_complement,
    address_neighborhood,
    address_city,
    address_state,
    subtotal_amount,
    discount_amount,
    shipping_base_amount,
    shipping_additional_amount,
    shipping_amount,
    total_amount,
    shipping_provider,
    shipping_service,
    shipping_quote_reference,
    shipping_transit_business_days,
    shipping_quoted_at,
    payment_provider,
    payment_reference,
    payment_method
  )
  VALUES (
    public.next_order_public_number(),
    p_user_id,
    p_address_id,
    normalized_idempotency_key,
    btrim(profile_record.full_name),
    btrim(profile_record.email),
    profile_record.phone,
    address_record.recipient_name,
    address_record.postal_code,
    address_record.street,
    address_record.number,
    address_record.complement,
    address_record.neighborhood,
    address_record.city,
    address_record.state,
    subtotal_value,
    discount_value,
    shipping_base_value,
    shipping_additional_value,
    shipping_total_value,
    subtotal_value - discount_value + shipping_total_value,
    NULLIF(btrim(p_shipping->>'provider'), ''),
    NULLIF(btrim(p_shipping->>'service'), ''),
    NULLIF(btrim(p_shipping->>'quote_reference'), ''),
    NULLIF(p_shipping->>'transit_business_days', '')::smallint,
    NULLIF(p_shipping->>'quoted_at', '')::timestamptz,
    NULLIF(btrim(p_payment->>'provider'), ''),
    NULLIF(btrim(p_payment->>'reference'), ''),
    NULLIF(btrim(p_payment->>'method'), '')
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING * INTO created_order;

  IF created_order.id IS NULL THEN
    SELECT o.*
    INTO created_order
    FROM public.orders AS o
    WHERE o.user_id = p_user_id
      AND o.idempotency_key = normalized_idempotency_key;

    RETURN created_order;
  END IF;

  FOR resolved_item IN SELECT value FROM jsonb_array_elements(resolved_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      product_slug,
      product_sku,
      variant_name,
      variant_sku,
      selected_options,
      image_storage_key,
      image_url,
      image_alt_text,
      quantity,
      unit_price,
      line_total
    )
    VALUES (
      created_order.id,
      (resolved_item->>'product_id')::uuid,
      (resolved_item->>'variant_id')::uuid,
      resolved_item->>'product_name',
      resolved_item->>'product_slug',
      resolved_item->>'product_sku',
      NULLIF(resolved_item->>'variant_name', ''),
      resolved_item->>'variant_sku',
      resolved_item->'selected_options',
      NULLIF(resolved_item->>'image_storage_key', ''),
      NULLIF(resolved_item->>'image_url', ''),
      NULLIF(resolved_item->>'image_alt_text', ''),
      (resolved_item->>'quantity')::integer,
      (resolved_item->>'unit_price')::numeric,
      (resolved_item->>'line_total')::numeric
    );
  END LOOP;

  INSERT INTO public.order_timeline (
    order_id,
    event_type,
    actor_type,
    message
  )
  VALUES (
    created_order.id,
    'order_created',
    'system'::public.order_actor_type,
    'Pedido criado com os dados e valores confirmados no checkout.'
  );

  RETURN created_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_id uuid,
  p_provider text,
  p_reference text,
  p_method text,
  p_paid_amount numeric,
  p_idempotency_key text
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_order public.orders%ROWTYPE;
  event_key text;
BEGIN
  event_key := 'payment:' || btrim(COALESCE(p_provider, '')) || ':' || btrim(COALESCE(p_idempotency_key, ''));

  IF length(btrim(COALESCE(p_provider, ''))) < 2
     OR length(btrim(COALESCE(p_reference, ''))) < 2
     OR length(btrim(COALESCE(p_idempotency_key, ''))) < 8 THEN
    RAISE EXCEPTION 'Confirmacao de pagamento invalida';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notification_events AS event_record
    WHERE event_record.idempotency_key = event_key
  ) THEN
    SELECT o.* INTO target_order
    FROM public.orders AS o
    WHERE o.id = p_order_id;
    RETURN target_order;
  END IF;

  SELECT o.*
  INTO target_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF target_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido nao encontrado';
  END IF;

  IF target_order.status <> 'pending_payment'::public.order_status
     OR target_order.payment_status <> 'pending'::public.order_payment_status THEN
    RAISE EXCEPTION 'Pedido nao esta aguardando pagamento';
  END IF;

  IF p_paid_amount IS NULL OR p_paid_amount <> target_order.total_amount THEN
    RAISE EXCEPTION 'Valor pago diverge do total do pedido';
  END IF;

  UPDATE public.orders AS o
  SET
    status = 'paid'::public.order_status,
    payment_status = 'paid'::public.order_payment_status,
    payment_provider = btrim(p_provider),
    payment_reference = btrim(p_reference),
    payment_method = NULLIF(btrim(p_method), ''),
    paid_amount = p_paid_amount,
    paid_at = now()
  WHERE o.id = target_order.id
  RETURNING * INTO target_order;

  INSERT INTO public.order_timeline (
    order_id,
    event_type,
    actor_type,
    message
  )
  VALUES (
    target_order.id,
    'payment_confirmed',
    'integration'::public.order_actor_type,
    'Pagamento confirmado. O pedido está pronto para entrar em produção.'
  );

  INSERT INTO public.notification_events (
    user_id,
    order_id,
    event_name,
    payload,
    idempotency_key
  )
  VALUES (
    target_order.user_id,
    target_order.id,
    'order.paid',
    jsonb_build_object(
      'order_id', target_order.id,
      'public_number', target_order.public_number
    ),
    event_key
  );

  RETURN target_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_transition_order(
  p_order_id uuid,
  p_new_status public.order_status,
  p_note text DEFAULT NULL,
  p_tracking_code text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_order public.orders%ROWTYPE;
  timeline_event text;
  timeline_message text;
BEGIN
  IF NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao proprietario';
  END IF;

  SELECT o.*
  INTO target_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF target_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido nao encontrado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.refund_requests AS request_record
    WHERE request_record.order_id = target_order.id
      AND request_record.status = 'requested'::public.refund_request_status
  ) THEN
    RAISE EXCEPTION 'Resolva a solicitacao de reembolso antes de alterar o pedido';
  END IF;

  IF target_order.status = 'pending_payment'::public.order_status
     AND p_new_status = 'canceled'::public.order_status THEN
    timeline_event := 'order_canceled';
    timeline_message := 'Pedido cancelado antes da confirmação do pagamento.';
  ELSIF target_order.status = 'paid'::public.order_status
     AND p_new_status = 'in_production'::public.order_status THEN
    timeline_event := 'production_started';
    timeline_message := 'Produção iniciada. O prazo é de até 5 dias úteis antes do envio.';
  ELSIF target_order.status = 'in_production'::public.order_status
     AND p_new_status = 'shipped'::public.order_status THEN
    timeline_event := 'order_shipped';
    timeline_message := 'Pedido enviado.';
  ELSIF target_order.status = 'shipped'::public.order_status
     AND p_new_status = 'delivered'::public.order_status THEN
    timeline_event := 'order_delivered';
    timeline_message := 'Pedido entregue.';
  ELSE
    RAISE EXCEPTION 'Transicao de status nao permitida';
  END IF;

  UPDATE public.orders AS o
  SET
    status = p_new_status,
    payment_status = CASE
      WHEN p_new_status = 'canceled'::public.order_status
      THEN 'canceled'::public.order_payment_status
      ELSE o.payment_status
    END,
    production_started_at = CASE
      WHEN p_new_status = 'in_production'::public.order_status THEN now()
      ELSE o.production_started_at
    END,
    shipped_at = CASE
      WHEN p_new_status = 'shipped'::public.order_status THEN now()
      ELSE o.shipped_at
    END,
    delivered_at = CASE
      WHEN p_new_status = 'delivered'::public.order_status THEN now()
      ELSE o.delivered_at
    END,
    canceled_at = CASE
      WHEN p_new_status = 'canceled'::public.order_status THEN now()
      ELSE o.canceled_at
    END,
    shipping_tracking_code = CASE
      WHEN p_new_status = 'shipped'::public.order_status
      THEN NULLIF(btrim(p_tracking_code), '')
      ELSE o.shipping_tracking_code
    END
  WHERE o.id = target_order.id
  RETURNING * INTO target_order;

  INSERT INTO public.order_timeline (
    order_id,
    event_type,
    actor_type,
    actor_user_id,
    message
  )
  VALUES (
    target_order.id,
    timeline_event,
    'owner'::public.order_actor_type,
    auth.uid(),
    COALESCE(NULLIF(btrim(p_note), ''), timeline_message)
  );

  IF p_new_status = 'delivered'::public.order_status THEN
    INSERT INTO public.notification_events (
      user_id,
      order_id,
      event_name,
      payload,
      idempotency_key
    )
    VALUES (
      target_order.user_id,
      target_order.id,
      'order.delivered',
      jsonb_build_object(
        'order_id', target_order.id,
        'public_number', target_order.public_number
      ),
      'order.delivered:' || target_order.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN target_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_my_order_refund(
  p_order_id uuid,
  p_reason text,
  p_message text DEFAULT NULL
)
RETURNS public.refund_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_order public.orders%ROWTYPE;
  created_request public.refund_requests%ROWTYPE;
  normalized_reason text := lower(btrim(COALESCE(p_reason, '')));
  normalized_message text := NULLIF(btrim(p_message), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  IF normalized_reason NOT IN ('arrependimento', 'tamanho', 'produto', 'entrega', 'outro') THEN
    RAISE EXCEPTION 'Motivo de reembolso invalido';
  END IF;

  IF normalized_message IS NOT NULL AND length(normalized_message) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'A mensagem deve ter entre 3 e 1000 caracteres';
  END IF;

  IF normalized_reason = 'outro' AND normalized_message IS NULL THEN
    RAISE EXCEPTION 'Descreva o motivo da solicitacao';
  END IF;

  SELECT o.*
  INTO target_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.user_id = auth.uid()
  FOR UPDATE;

  IF target_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido nao encontrado';
  END IF;

  IF target_order.status NOT IN (
    'paid'::public.order_status,
    'in_production'::public.order_status,
    'shipped'::public.order_status,
    'delivered'::public.order_status
  ) THEN
    RAISE EXCEPTION 'Este pedido nao permite solicitar reembolso';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.refund_requests AS request_record
    WHERE request_record.order_id = target_order.id
  ) THEN
    RAISE EXCEPTION 'Este pedido ja possui uma solicitacao de reembolso';
  END IF;

  INSERT INTO public.refund_requests (
    order_id,
    user_id,
    reason,
    message,
    order_status_at_request
  )
  VALUES (
    target_order.id,
    auth.uid(),
    normalized_reason,
    normalized_message,
    target_order.status
  )
  RETURNING * INTO created_request;

  INSERT INTO public.order_timeline (
    order_id,
    event_type,
    actor_type,
    actor_user_id,
    message
  )
  VALUES (
    target_order.id,
    'refund_requested',
    'customer'::public.order_actor_type,
    auth.uid(),
    'Reembolso solicitado. O proprietário entrará em contato diretamente.'
  );

  RETURN created_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_resolve_refund_request(
  p_request_id uuid,
  p_resolution public.refund_request_status,
  p_note text DEFAULT NULL
)
RETURNS public.refund_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_request public.refund_requests%ROWTYPE;
  target_order public.orders%ROWTYPE;
  timeline_event text;
  timeline_message text;
BEGIN
  IF NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao proprietario';
  END IF;

  IF p_resolution NOT IN (
    'refunded'::public.refund_request_status,
    'canceled'::public.refund_request_status
  ) THEN
    RAISE EXCEPTION 'Resolucao de reembolso invalida';
  END IF;

  SELECT request_record.*
  INTO target_request
  FROM public.refund_requests AS request_record
  WHERE request_record.id = p_request_id
  FOR UPDATE;

  IF target_request.id IS NULL THEN
    RAISE EXCEPTION 'Solicitacao de reembolso nao encontrada';
  END IF;

  IF target_request.status <> 'requested'::public.refund_request_status THEN
    RAISE EXCEPTION 'Esta solicitacao ja foi resolvida';
  END IF;

  UPDATE public.refund_requests AS request_record
  SET
    status = p_resolution,
    resolved_by = auth.uid(),
    resolved_at = now()
  WHERE request_record.id = target_request.id
  RETURNING * INTO target_request;

  IF p_resolution = 'refunded'::public.refund_request_status THEN
    UPDATE public.orders AS o
    SET
      status = 'refunded'::public.order_status,
      payment_status = 'refunded'::public.order_payment_status,
      refunded_at = now()
    WHERE o.id = target_request.order_id
    RETURNING * INTO target_order;

    timeline_event := 'refund_confirmed';
    timeline_message := 'Reembolso resolvido e registrado pelo proprietário.';
  ELSE
    SELECT o.* INTO target_order
    FROM public.orders AS o
    WHERE o.id = target_request.order_id;

    timeline_event := 'refund_canceled';
    timeline_message := 'Solicitação de reembolso cancelada após contato com o cliente.';
  END IF;

  INSERT INTO public.order_timeline (
    order_id,
    event_type,
    actor_type,
    actor_user_id,
    message
  )
  VALUES (
    target_request.order_id,
    timeline_event,
    'owner'::public.order_actor_type,
    auth.uid(),
    COALESCE(NULLIF(btrim(p_note), ''), timeline_message)
  );

  IF p_resolution = 'refunded'::public.refund_request_status THEN
    INSERT INTO public.notification_events (
      user_id,
      order_id,
      event_name,
      payload,
      idempotency_key
    )
    VALUES (
      target_order.user_id,
      target_order.id,
      'order.refunded',
      jsonb_build_object(
        'order_id', target_order.id,
        'public_number', target_order.public_number
      ),
      'order.refunded:' || target_order.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN target_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_orders(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_sort text DEFAULT 'newest',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  public_number text,
  status text,
  payment_status text,
  customer_name text,
  customer_email text,
  customer_phone text,
  total_amount numeric,
  currency text,
  item_count bigint,
  refund_request_id uuid,
  refund_status text,
  refund_reason text,
  refund_created_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_search text := NULLIF(btrim(p_search), '');
  normalized_status text := lower(COALESCE(NULLIF(btrim(p_status), ''), 'all'));
  normalized_sort text := lower(COALESCE(NULLIF(btrim(p_sort), ''), 'newest'));
  safe_page integer := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 50);
BEGIN
  IF NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao proprietario';
  END IF;

  IF normalized_sort NOT IN ('newest', 'oldest', 'total_desc', 'total_asc') THEN
    normalized_sort := 'newest';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.public_number,
    o.status::text,
    o.payment_status::text,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.total_amount,
    o.currency,
    (SELECT COALESCE(sum(oi.quantity), 0)::bigint FROM public.order_items AS oi WHERE oi.order_id = o.id),
    request_record.id,
    request_record.status::text,
    request_record.reason,
    request_record.created_at,
    o.created_at,
    count(*) OVER ()
  FROM public.orders AS o
  LEFT JOIN public.refund_requests AS request_record
    ON request_record.order_id = o.id
  WHERE (
    normalized_search IS NULL
    OR o.public_number ILIKE '%' || normalized_search || '%'
    OR o.customer_name ILIKE '%' || normalized_search || '%'
    OR o.customer_email ILIKE '%' || normalized_search || '%'
    OR (
      regexp_replace(normalized_search, '[^0-9]', '', 'g') <> ''
      AND o.customer_phone ILIKE '%' || regexp_replace(normalized_search, '[^0-9]', '', 'g') || '%'
    )
  )
  AND (
    normalized_status = 'all'
    OR (normalized_status = 'refund_requested' AND request_record.status = 'requested'::public.refund_request_status)
    OR (normalized_status = 'refund_canceled' AND request_record.status = 'canceled'::public.refund_request_status)
    OR o.status::text = normalized_status
  )
  ORDER BY
    CASE WHEN normalized_sort = 'oldest' THEN o.created_at END ASC,
    CASE WHEN normalized_sort = 'total_desc' THEN o.total_amount END DESC,
    CASE WHEN normalized_sort = 'total_asc' THEN o.total_amount END ASC,
    CASE WHEN normalized_sort = 'newest' THEN o.created_at END DESC,
    o.id DESC
  LIMIT safe_page_size
  OFFSET (safe_page - 1) * safe_page_size;
END;
$$;

-- O carrinho passa a validar disponibilidade comercial por produto/variante
-- ativos. stock_quantity permanece como legado estrutural, sem bloquear compra.
CREATE OR REPLACE FUNCTION public.validate_cart_items(p_items jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH requested AS (
  SELECT
    item_position,
    item->>'line_id' AS line_id,
    CASE
      WHEN COALESCE(item->>'product_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (item->>'product_id')::uuid
      ELSE NULL
    END AS product_id,
    CASE
      WHEN COALESCE(item->>'variant_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (item->>'variant_id')::uuid
      ELSE NULL
    END AS requested_variant_id
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS input(item, item_position)
  LIMIT 100
), resolved AS (
  SELECT
    r.item_position,
    r.line_id,
    p.id AS product_id,
    p.slug AS product_slug,
    p.name AS product_name,
    v.id AS variant_id,
    v.sku AS variant_sku,
    v.name AS variant_name,
    CASE
      WHEN v.id IS NULL OR p.id IS NULL THEN NULL
      ELSE COALESCE(
        v.promotional_price_override,
        CASE WHEN v.price_override IS NULL THEN p.promotional_price ELSE NULL END,
        v.price_override,
        p.price
      )
    END AS unit_price,
    CASE
      WHEN r.product_id IS NULL OR p.id IS NULL THEN 'unavailable'
      WHEN r.requested_variant_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.product_options AS option_record
          WHERE option_record.product_id = p.id
            AND option_record.is_required = true
        ) THEN 'needs_review'
      WHEN v.id IS NULL THEN 'unavailable'
      ELSE 'available'
    END AS cart_status
  FROM requested AS r
  LEFT JOIN public.products AS p
    ON p.id = r.product_id
   AND p.status = 'active'::public.product_status
  LEFT JOIN LATERAL (
    SELECT candidate.*
    FROM public.product_variants AS candidate
    WHERE candidate.product_id = p.id
      AND candidate.status = 'active'::public.product_variant_status
      AND (r.requested_variant_id IS NULL OR candidate.id = r.requested_variant_id)
    ORDER BY
      CASE
        WHEN r.requested_variant_id IS NOT NULL AND candidate.id = r.requested_variant_id THEN 0
        WHEN candidate.is_default THEN 1
        ELSE 2
      END,
      candidate.sort_order,
      candidate.created_at
    LIMIT 1
  ) AS v ON true
)
SELECT COALESCE(
  jsonb_agg(
    jsonb_build_object(
      'line_id', COALESCE(line_id, ''),
      'product_id', product_id,
      'product_slug', product_slug,
      'product_name', product_name,
      'variant_id', variant_id,
      'variant_sku', variant_sku,
      'variant_name', variant_name,
      'unit_price', unit_price,
      'available_stock', NULL,
      'made_to_order', true,
      'status', cart_status
    )
    ORDER BY item_position
  ),
  '[]'::jsonb
)
FROM resolved;
$$;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_own_or_owner"
ON public.orders
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role('owner'::public.app_role)
);

CREATE POLICY "order_items_select_own_or_owner"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders AS order_record
    WHERE order_record.id = order_id
      AND (
        order_record.user_id = auth.uid()
        OR public.has_role('owner'::public.app_role)
      )
  )
);

CREATE POLICY "order_timeline_select_own_or_owner"
ON public.order_timeline
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders AS order_record
    WHERE order_record.id = order_id
      AND (
        order_record.user_id = auth.uid()
        OR public.has_role('owner'::public.app_role)
      )
  )
);

CREATE POLICY "refund_requests_select_own_or_owner"
ON public.refund_requests
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role('owner'::public.app_role)
);

REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.order_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.order_timeline FROM anon, authenticated;
REVOKE ALL ON TABLE public.refund_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.notification_events FROM anon, authenticated;

GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;
GRANT SELECT ON TABLE public.order_timeline TO authenticated;
GRANT SELECT ON TABLE public.refund_requests TO authenticated;

GRANT ALL ON TABLE public.orders TO service_role;
GRANT ALL ON TABLE public.order_items TO service_role;
GRANT ALL ON TABLE public.order_timeline TO service_role;
GRANT ALL ON TABLE public.refund_requests TO service_role;
GRANT ALL ON TABLE public.notification_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_public_number_seq TO service_role;

REVOKE ALL ON FUNCTION public.touch_order_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_order_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_order_item_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_order_public_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_order_payment(uuid, text, text, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_transition_order(uuid, public.order_status, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_my_order_refund(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_resolve_refund_request(uuid, public.refund_request_status, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_orders(text, text, text, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.next_order_public_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, text, text, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_transition_order(uuid, public.order_status, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_my_order_refund(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_resolve_refund_request(uuid, public.refund_request_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(text, text, text, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_cart_items(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cart_items(jsonb) TO anon, authenticated, service_role;

COMMENT ON TABLE public.orders IS
  'Pedidos historicos da loja, com snapshots imutaveis e producao sob encomenda.';
COMMENT ON TABLE public.order_items IS
  'Itens imutaveis do pedido; nomes, SKUs, opcoes, imagens e precos sao snapshots.';
COMMENT ON TABLE public.refund_requests IS
  'Solicitacao simples: cliente solicita e o proprietario resolve diretamente, sem automacao financeira.';
COMMENT ON TABLE public.notification_events IS
  'Outbox idempotente minimo para integracoes reais de email futuras.';
COMMENT ON COLUMN public.orders.production_business_days IS
  'Prazo comercial fixo de producao antes do envio; nao inclui transporte.';
COMMENT ON COLUMN public.orders.shipping_transit_business_days IS
  'Snapshot futuro do prazo real informado pela transportadora; permanece nulo sem cotacao real.';
COMMENT ON COLUMN public.products.stock IS
  'Legado estrutural. Nao representa disponibilidade comercial: a BIGofertas produz sob encomenda.';
COMMENT ON COLUMN public.product_variants.stock_quantity IS
  'Legado estrutural preservado sem remocao destrutiva. Nao bloqueia carrinho nem pedidos.';
COMMENT ON FUNCTION public.validate_cart_items(jsonb) IS
  'Valida produtos, variantes e precos ativos para producao sob encomenda, sem ler ou alterar estoque.';

COMMIT;
