BEGIN;

-- Fase 10 — hardening de integridade do núcleo de pedidos.
-- Mantém o modelo simples da BIGofertas e fecha duas garantias importantes:
-- 1) toda criação real de pedido precisa de chave de idempotência;
-- 2) um mesmo evento de pagamento não pode ser associado silenciosamente
--    a pedidos diferentes nem confirmado duas vezes em uma corrida concorrente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE idempotency_key IS NULL
  ) THEN
    RAISE EXCEPTION
      'Existem pedidos sem idempotency_key; revise-os antes de aplicar o hardening da Fase 10';
  END IF;
END
$$;

ALTER TABLE public.orders
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_provider_reference_unique
  ON public.orders (lower(payment_provider), payment_reference)
  WHERE payment_provider IS NOT NULL
    AND payment_reference IS NOT NULL;

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
  existing_event_order_id uuid;
  normalized_provider text := btrim(COALESCE(p_provider, ''));
  normalized_reference text := btrim(COALESCE(p_reference, ''));
  normalized_idempotency_key text := btrim(COALESCE(p_idempotency_key, ''));
BEGIN
  IF p_order_id IS NULL
     OR length(normalized_provider) < 2
     OR length(normalized_reference) < 2
     OR length(normalized_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'Confirmacao de pagamento invalida';
  END IF;

  event_key := 'payment:' || normalized_provider || ':' || normalized_idempotency_key;

  -- O lock vem antes da consulta ao evento para tornar retries concorrentes
  -- realmente idempotentes: a segunda execução espera a primeira terminar e
  -- então enxerga o evento que já foi persistido.
  SELECT o.*
  INTO target_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF target_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido nao encontrado';
  END IF;

  SELECT event_record.order_id
  INTO existing_event_order_id
  FROM public.notification_events AS event_record
  WHERE event_record.idempotency_key = event_key;

  IF FOUND THEN
    IF existing_event_order_id IS DISTINCT FROM p_order_id THEN
      RAISE EXCEPTION 'Evento de pagamento ja associado a outro pedido';
    END IF;

    IF target_order.paid_at IS NULL
       OR target_order.payment_provider IS DISTINCT FROM normalized_provider
       OR target_order.payment_reference IS DISTINCT FROM normalized_reference
       OR target_order.paid_amount IS DISTINCT FROM p_paid_amount THEN
      RAISE EXCEPTION 'Retry de pagamento diverge da confirmacao ja registrada';
    END IF;

    RETURN target_order;
  END IF;

  IF target_order.status <> 'pending_payment'::public.order_status
     OR target_order.payment_status <> 'pending'::public.order_payment_status THEN
    RAISE EXCEPTION 'Pedido nao esta aguardando pagamento';
  END IF;

  IF p_paid_amount IS NULL OR p_paid_amount <> target_order.total_amount THEN
    RAISE EXCEPTION 'Valor pago diverge do total do pedido';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders AS other_order
    WHERE other_order.id <> target_order.id
      AND lower(other_order.payment_provider) = lower(normalized_provider)
      AND other_order.payment_reference = normalized_reference
  ) THEN
    RAISE EXCEPTION 'Referencia de pagamento ja associada a outro pedido';
  END IF;

  UPDATE public.orders AS o
  SET
    status = 'paid'::public.order_status,
    payment_status = 'paid'::public.order_payment_status,
    payment_provider = normalized_provider,
    payment_reference = normalized_reference,
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

REVOKE ALL ON FUNCTION public.record_order_payment(uuid, text, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, text, text, text, numeric, text) TO service_role;

COMMENT ON INDEX public.orders_payment_provider_reference_unique IS
  'Impede que a mesma referencia real de pagamento de um provedor seja ligada a mais de um pedido.';

COMMENT ON FUNCTION public.record_order_payment(uuid, text, text, text, numeric, text) IS
  'Confirma pagamento futuro de forma idempotente e impede reaproveitamento de evento ou referencia entre pedidos.';

COMMIT;
