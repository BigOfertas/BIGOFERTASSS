BEGIN;

-- Regra comercial definitiva de desconto progressivo da BIGofertas.
-- O desconto e o frete gratis sao calculados no backend a partir da quantidade
-- total de pecas; o navegador nunca escolhe percentuais ou valores finais.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_percent smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_discount_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shipping_composition;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_discount_percent_allowed;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_discount_percent_allowed
  CHECK (discount_percent IN (0, 5, 10, 15, 20, 35));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shipping_discount_valid;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_discount_valid CHECK (
    shipping_discount_amount >= 0
    AND shipping_discount_amount <= shipping_base_amount + shipping_additional_amount
  );

ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_composition CHECK (
    shipping_amount = shipping_base_amount + shipping_additional_amount - shipping_discount_amount
  );

CREATE OR REPLACE FUNCTION public.bigofertas_progressive_discount_percent(p_units integer)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_units >= 45 THEN 35
    WHEN p_units >= 30 THEN 20
    WHEN p_units >= 15 THEN 15
    WHEN p_units >= 10 THEN 10
    WHEN p_units >= 5 THEN 5
    ELSE 0
  END::smallint;
$$;

REVOKE ALL ON FUNCTION public.bigofertas_progressive_discount_percent(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bigofertas_progressive_discount_percent(integer) TO service_role;

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
     OR NEW.discount_percent IS DISTINCT FROM OLD.discount_percent
     OR NEW.shipping_base_amount IS DISTINCT FROM OLD.shipping_base_amount
     OR NEW.shipping_additional_amount IS DISTINCT FROM OLD.shipping_additional_amount
     OR NEW.shipping_discount_amount IS DISTINCT FROM OLD.shipping_discount_amount
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
  total_units_value integer := 0;
  discount_percent_value smallint := 0;
  discount_value numeric(12, 2) := 0;
  shipping_base_value numeric(12, 2) := 0;
  shipping_additional_value numeric(12, 2) := 0;
  shipping_discount_value numeric(12, 2) := 0;
  shipping_total_value numeric(12, 2) := 0;
  requested_shipping_total numeric(12, 2) := 0;
  options_value jsonb;
  image_storage_key_value text;
  image_alt_text_value text;
  resolved_items jsonb := '[]'::jsonb;
  resolved_item jsonb;
  normalized_idempotency_key text := NULLIF(btrim(p_idempotency_key), '');
  created_order public.orders%ROWTYPE;
BEGIN
  -- p_discount_amount existe apenas por compatibilidade com a assinatura anterior.
  -- O valor informado pelo caller e deliberadamente ignorado.
  PERFORM p_discount_amount;

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
    total_units_value := total_units_value + quantity_value;

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

  discount_percent_value := public.bigofertas_progressive_discount_percent(total_units_value);
  discount_value := round(subtotal_value * discount_percent_value::numeric / 100, 2);

  IF p_shipping IS NOT NULL THEN
    IF jsonb_typeof(p_shipping) <> 'object' THEN
      RAISE EXCEPTION 'Snapshot de frete invalido';
    END IF;

    shipping_base_value := COALESCE(NULLIF(p_shipping->>'base_amount', '')::numeric, 0);
    shipping_additional_value := COALESCE(NULLIF(p_shipping->>'additional_amount', '')::numeric, 0);
    requested_shipping_total := COALESCE(
      NULLIF(p_shipping->>'amount', '')::numeric,
      shipping_base_value + shipping_additional_value
    );
  END IF;

  IF shipping_base_value < 0 OR shipping_additional_value < 0 THEN
    RAISE EXCEPTION 'Valores de frete invalidos';
  END IF;

  IF total_units_value >= 45 THEN
    shipping_discount_value := shipping_base_value + shipping_additional_value;
    shipping_total_value := 0;
  ELSE
    shipping_discount_value := 0;
    shipping_total_value := requested_shipping_total;

    IF shipping_total_value <> shipping_base_value + shipping_additional_value THEN
      RAISE EXCEPTION 'Valores de frete invalidos';
    END IF;
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
    discount_percent,
    shipping_base_amount,
    shipping_additional_amount,
    shipping_discount_amount,
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
    discount_percent_value,
    shipping_base_value,
    shipping_additional_value,
    shipping_discount_value,
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
    'Pedido criado com os dados, desconto progressivo e frete confirmados no checkout.'
  );

  RETURN created_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text) TO service_role;

COMMENT ON COLUMN public.orders.discount_percent IS
  'Percentual automatico aplicado por quantidade total de pecas: 0, 5, 10, 15, 20 ou 35.';
COMMENT ON COLUMN public.orders.shipping_discount_amount IS
  'Desconto aplicado sobre o frete. Na faixa de 45+ pecas equivale ao custo cotado + adicional, zerando o frete do cliente.';
COMMENT ON FUNCTION public.bigofertas_progressive_discount_percent(integer) IS
  'Regra comercial: 5 pecas=5%; 10=10%; 15=15%; 30=20%; 45=35% e frete gratis.';

COMMIT;
