-- BIGofertas
-- FASE 08 — endurecimento da troca de endereco principal
-- Mantem a restricao de um unico endereco principal por usuario sem depender
-- da ordem interna de atualizacao de um unico UPDATE.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_default_my_customer_address(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_addresses AS a
    WHERE a.id = p_id
      AND a.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Endereco inexistente';
  END IF;

  -- Primeiro remove o principal anterior. Em seguida marca apenas o alvo.
  -- Isso evita colisao temporaria no indice parcial unico por usuario.
  UPDATE public.customer_addresses AS a
  SET is_default = false
  WHERE a.user_id = current_user_id
    AND a.is_default
    AND a.id <> p_id;

  UPDATE public.customer_addresses AS a
  SET is_default = true
  WHERE a.id = p_id
    AND a.user_id = current_user_id
    AND NOT a.is_default;
END;
$$;

REVOKE ALL
ON FUNCTION public.set_default_my_customer_address(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.set_default_my_customer_address(uuid)
TO authenticated;

COMMIT;
