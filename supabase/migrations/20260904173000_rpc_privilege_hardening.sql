BEGIN;

-- Reaplica explicitamente as ACLs já definidas pelo projeto para evitar
-- execução direta por visitantes em funções internas ou administrativas.

-- Núcleo interno de pedidos: somente backend/service_role.
REVOKE ALL ON FUNCTION public.next_order_public_number()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_order_payment(uuid, text, text, text, numeric, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.next_order_public_number()
TO service_role;
GRANT EXECUTE ON FUNCTION public.create_order_core(uuid, uuid, jsonb, jsonb, jsonb, numeric, text)
TO service_role;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, text, text, text, numeric, text)
TO service_role;

-- Ações autenticadas: disponíveis ao cliente/owner logado; a própria função
-- mantém as verificações de identidade/papel já existentes.
REVOKE ALL ON FUNCTION public.owner_transition_order(uuid, public.order_status, text, text)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.request_my_order_refund(uuid, text, text)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.owner_resolve_refund_request(uuid, public.refund_request_status, text)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_list_orders(text, text, text, integer, integer)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.owner_transition_order(uuid, public.order_status, text, text)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_my_order_refund(uuid, text, text)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_resolve_refund_request(uuid, public.refund_request_status, text)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(text, text, text, integer, integer)
TO authenticated;

-- Fila transacional de e-mail: somente backend/service_role.
REVOKE ALL ON FUNCTION public.claim_notification_events(integer)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_notification_event(uuid, text)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fail_notification_event(uuid, text)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.claim_notification_events(integer)
TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_event(uuid, text)
TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_notification_event(uuid, text)
TO service_role;

COMMIT;
