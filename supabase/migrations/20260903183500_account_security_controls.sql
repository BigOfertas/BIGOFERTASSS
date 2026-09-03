BEGIN;

-- Controle simples de segurança da conta para o cliente autenticado.
-- A ativacao do 2FA continua exigindo o codigo enviado por e-mail.
-- Esta funcao serve apenas para desativacao voluntaria pela propria conta.

CREATE OR REPLACE FUNCTION public.disable_my_email_2fa()
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

  UPDATE public.profiles AS p
  SET
    email_2fa_enabled = false,
    email_2fa_enabled_at = NULL,
    email_2fa_prompt_dismissed_at = now()
  WHERE p.id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.disable_my_email_2fa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disable_my_email_2fa() TO authenticated;

COMMENT ON FUNCTION public.disable_my_email_2fa() IS
  'Permite ao cliente autenticado desativar o 2FA por e-mail da propria conta.';

COMMIT;
