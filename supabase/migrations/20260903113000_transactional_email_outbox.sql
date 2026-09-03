BEGIN;

-- Outbox transacional da BIGofertas. Mantém os eventos no banco e deixa o
-- envio para o backend Node/Hostinger (Cloudflare atual é apenas staging).
ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_name_valid;

ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_name_valid CHECK (
    event_name IN (
      'account.confirmed',
      'order.paid',
      'order.in_production',
      'order.shipped',
      'order.delivered',
      'order.refunded',
      'refund.requested',
      'affiliate.created',
      'affiliate.commission.created',
      'affiliate.commission.available',
      'affiliate.withdrawal.requested',
      'affiliate.withdrawal.paid',
      'affiliate.withdrawal.rejected'
    )
  );

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS dead_letter_at timestamptz;

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_attempt_count_valid;
ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_attempt_count_valid
  CHECK (attempt_count BETWEEN 0 AND 50);

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_last_error_valid;
ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_last_error_valid
  CHECK (last_error IS NULL OR length(last_error) <= 1000);

CREATE INDEX IF NOT EXISTS notification_events_retry_idx
  ON public.notification_events (next_attempt_at, occurred_at, id)
  WHERE processed_at IS NULL AND dead_letter_at IS NULL;

CREATE OR REPLACE FUNCTION public.claim_notification_events(
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.notification_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT event_record.id
    FROM public.notification_events AS event_record
    WHERE event_record.processed_at IS NULL
      AND event_record.dead_letter_at IS NULL
      AND (
        event_record.next_attempt_at IS NULL
        OR event_record.next_attempt_at <= now()
      )
      AND (
        event_record.processing_started_at IS NULL
        OR event_record.processing_started_at < now() - interval '5 minutes'
      )
      AND event_record.event_name IN (
        'order.paid',
        'order.in_production',
        'order.shipped',
        'order.delivered',
        'refund.requested',
        'affiliate.created',
        'affiliate.commission.created',
        'affiliate.commission.available',
        'affiliate.withdrawal.requested',
        'affiliate.withdrawal.paid',
        'affiliate.withdrawal.rejected'
      )
    ORDER BY event_record.occurred_at, event_record.id
    FOR UPDATE SKIP LOCKED
    LIMIT safe_limit
  ), claimed AS (
    UPDATE public.notification_events AS event_record
    SET
      processing_started_at = now(),
      last_attempt_at = now(),
      attempt_count = event_record.attempt_count + 1
    FROM candidates
    WHERE event_record.id = candidates.id
    RETURNING event_record.*
  )
  SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_notification_event(
  p_event_id uuid,
  p_provider_message_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.notification_events AS event_record
  SET
    processed_at = COALESCE(event_record.processed_at, now()),
    provider_message_id = COALESCE(
      event_record.provider_message_id,
      NULLIF(btrim(p_provider_message_id), '')
    ),
    processing_started_at = NULL,
    next_attempt_at = NULL,
    last_error = NULL
  WHERE event_record.id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_notification_event(
  p_event_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_attempts integer;
BEGIN
  SELECT event_record.attempt_count
  INTO current_attempts
  FROM public.notification_events AS event_record
  WHERE event_record.id = p_event_id
  FOR UPDATE;

  IF current_attempts IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.notification_events AS event_record
  SET
    processing_started_at = NULL,
    last_error = left(COALESCE(NULLIF(btrim(p_error), ''), 'Falha de envio'), 1000),
    dead_letter_at = CASE
      WHEN current_attempts >= 8 THEN now()
      ELSE event_record.dead_letter_at
    END,
    next_attempt_at = CASE
      WHEN current_attempts >= 8 THEN NULL
      WHEN current_attempts <= 1 THEN now() + interval '1 minute'
      WHEN current_attempts = 2 THEN now() + interval '5 minutes'
      WHEN current_attempts = 3 THEN now() + interval '15 minutes'
      WHEN current_attempts = 4 THEN now() + interval '1 hour'
      ELSE now() + interval '6 hours'
    END
  WHERE event_record.id = p_event_id
    AND event_record.processed_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_events(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_notification_event(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_notification_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notification_events(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_event(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_notification_event(uuid, text) TO service_role;

-- Eventos que ainda não existiam na Fase 10. O evento de pagamento já é
-- criado por record_order_payment. Entrega também já existia, e o ON CONFLICT
-- abaixo garante que qualquer atualização automática futura continue idempotente.
CREATE OR REPLACE FUNCTION public.enqueue_order_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'in_production'::public.order_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notification_events (
      user_id,
      order_id,
      event_name,
      payload,
      idempotency_key
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'order.in_production',
      jsonb_build_object(
        'order_id', NEW.id,
        'public_number', NEW.public_number
      ),
      'order.in_production:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  IF NEW.status = 'shipped'::public.order_status
     AND NEW.shipping_tracking_code IS NOT NULL
     AND btrim(NEW.shipping_tracking_code) <> ''
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.shipping_tracking_code IS DISTINCT FROM NEW.shipping_tracking_code
     ) THEN
    INSERT INTO public.notification_events (
      user_id,
      order_id,
      event_name,
      payload,
      idempotency_key
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'order.shipped',
      jsonb_build_object(
        'order_id', NEW.id,
        'public_number', NEW.public_number
      ),
      'order.shipped:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  IF NEW.status = 'delivered'::public.order_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notification_events (
      user_id,
      order_id,
      event_name,
      payload,
      idempotency_key
    )
    VALUES (
      NEW.user_id,
      NEW.id,
      'order.delivered',
      jsonb_build_object(
        'order_id', NEW.id,
        'public_number', NEW.public_number
      ),
      'order.delivered:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_order_status_notification_after_update
  ON public.orders;
CREATE TRIGGER enqueue_order_status_notification_after_update
AFTER UPDATE OF status, shipping_tracking_code ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_order_status_notification();

CREATE OR REPLACE FUNCTION public.enqueue_refund_requested_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_events (
    user_id,
    order_id,
    event_name,
    payload,
    idempotency_key
  )
  VALUES (
    NEW.user_id,
    NEW.order_id,
    'refund.requested',
    jsonb_build_object(
      'refund_request_id', NEW.id,
      'order_id', NEW.order_id
    ),
    'refund.requested:' || NEW.id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_refund_requested_notification_after_insert
  ON public.refund_requests;
CREATE TRIGGER enqueue_refund_requested_notification_after_insert
AFTER INSERT ON public.refund_requests
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_refund_requested_notification();

COMMENT ON FUNCTION public.claim_notification_events(integer) IS
  'Reserva eventos de email para um único processador com SKIP LOCKED e controle de tentativas.';
COMMENT ON FUNCTION public.complete_notification_event(uuid, text) IS
  'Marca evento transacional como entregue ao Resend e guarda o identificador do provedor.';
COMMENT ON FUNCTION public.fail_notification_event(uuid, text) IS
  'Agenda retry com backoff e envia para dead letter após oito tentativas.';

COMMIT;
