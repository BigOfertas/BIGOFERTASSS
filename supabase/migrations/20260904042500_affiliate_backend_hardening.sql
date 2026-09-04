BEGIN;

-- A liberacao global de comissoes vencidas e uma rotina interna. Clientes
-- autenticados acessam somente os wrappers de propria conta, que chamam esta
-- funcao como SECURITY DEFINER com o affiliate_id correto.
REVOKE EXECUTE
ON FUNCTION public.release_due_affiliate_commissions(uuid)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.release_due_affiliate_commissions(uuid)
TO service_role;

COMMENT ON FUNCTION public.release_due_affiliate_commissions(uuid) IS
  'Rotina interna que libera comissoes vencidas. Execucao direta restrita ao service_role; a conta usa os RPCs proprios.';

COMMIT;
