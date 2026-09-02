BEGIN;

-- BIGofertas — 2FA opcional por código enviado por e-mail.
-- A preferência fica no perfil; os desafios são estritamente de backend.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_2fa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_2fa_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_2fa_prompt_dismissed_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_2fa_state_consistent;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_2fa_state_consistent
  CHECK (
    (email_2fa_enabled = false AND email_2fa_enabled_at IS NULL)
    OR
    (email_2fa_enabled = true AND email_2fa_enabled_at IS NOT NULL)
  );

CREATE TABLE IF NOT EXISTS public.email_2fa_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  purpose text NOT NULL,
  code_digest text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempt_count smallint NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT email_2fa_challenges_purpose_valid
    CHECK (purpose IN ('enroll', 'login')),
  CONSTRAINT email_2fa_challenges_email_valid
    CHECK (position('@' in email) > 1 AND length(email) <= 320),
  CONSTRAINT email_2fa_challenges_digest_valid
    CHECK (length(code_digest) BETWEEN 32 AND 256),
  CONSTRAINT email_2fa_challenges_attempts_valid
    CHECK (attempt_count BETWEEN 0 AND 5),
  CONSTRAINT email_2fa_challenges_expiry_valid
    CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS email_2fa_challenges_user_created_idx
  ON public.email_2fa_challenges (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_2fa_challenges_active_idx
  ON public.email_2fa_challenges (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.email_2fa_challenges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_2fa_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_2fa_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_security_status()
RETURNS TABLE (
  email_2fa_enabled boolean,
  email_2fa_enabled_at timestamptz,
  email_2fa_prompt_dismissed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.email_2fa_enabled,
    p.email_2fa_enabled_at,
    p.email_2fa_prompt_dismissed_at
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.dismiss_my_email_2fa_prompt()
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
  SET email_2fa_prompt_dismissed_at = COALESCE(p.email_2fa_prompt_dismissed_at, now())
  WHERE p.id = current_user_id
    AND p.email_2fa_enabled = false;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_security_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dismiss_my_email_2fa_prompt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_security_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_my_email_2fa_prompt() TO authenticated;

COMMENT ON TABLE public.email_2fa_challenges IS
  'Desafios efêmeros de 2FA por e-mail. Código nunca é armazenado em texto puro e a tabela não é acessível pelo navegador.';
COMMENT ON FUNCTION public.get_my_security_status() IS
  'Retorna somente a preferência de segurança do cliente autenticado.';

COMMIT;
