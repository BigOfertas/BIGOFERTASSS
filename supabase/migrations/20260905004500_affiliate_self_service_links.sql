BEGIN;

-- O afiliado passa a controlar o proprio vinculo. O codigo e criado apenas
-- quando o usuario decide participar e permanece o mesmo em reativacoes.

ALTER TABLE public.affiliates
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.affiliates
  DROP CONSTRAINT IF EXISTS affiliates_user_id_fkey;

ALTER TABLE public.affiliates
  ADD CONSTRAINT affiliates_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.activate_my_affiliate()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  settings_row public.affiliate_program_settings%ROWTYPE;
  affiliate_row public.affiliates%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para ativar o programa de afiliados';
  END IF;

  SELECT *
  INTO settings_row
  FROM public.affiliate_program_settings
  WHERE singleton = true;

  IF settings_row.enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'O programa de afiliados esta temporariamente indisponivel';
  END IF;

  SELECT *
  INTO affiliate_row
  FROM public.affiliates
  WHERE user_id = current_user_id
  FOR UPDATE;

  IF affiliate_row.id IS NULL THEN
    INSERT INTO public.affiliates (
      user_id,
      referral_code,
      status,
      activated_at,
      deactivated_at
    )
    VALUES (
      current_user_id,
      public.generate_affiliate_referral_code(),
      'active',
      now(),
      NULL
    )
    RETURNING * INTO affiliate_row;
  ELSIF affiliate_row.status <> 'active' THEN
    UPDATE public.affiliates
    SET
      status = 'active',
      deactivated_at = NULL,
      updated_at = now()
    WHERE id = affiliate_row.id
    RETURNING * INTO affiliate_row;
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'referralCode', affiliate_row.referral_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_my_affiliate()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  affiliate_row public.affiliates%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para desativar o programa de afiliados';
  END IF;

  UPDATE public.affiliates
  SET
    status = 'disabled',
    deactivated_at = COALESCE(deactivated_at, now()),
    updated_at = now()
  WHERE user_id = current_user_id
  RETURNING * INTO affiliate_row;

  IF affiliate_row.id IS NULL THEN
    RAISE EXCEPTION 'Sua conta ainda nao possui perfil de afiliado';
  END IF;

  RETURN jsonb_build_object(
    'active', false,
    'referralCode', affiliate_row.referral_code
  );
END;
$$;

-- Antes de excluir a conta, invalida o link. O registro do afiliado permanece
-- sem user_id para preservar historico de indicacoes, comissoes e saques.
CREATE OR REPLACE FUNCTION public.disable_affiliate_before_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.affiliates
  SET
    status = 'disabled',
    deactivated_at = COALESCE(deactivated_at, now()),
    updated_at = now()
  WHERE user_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS disable_affiliate_before_user_delete ON auth.users;
CREATE TRIGGER disable_affiliate_before_user_delete
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.disable_affiliate_before_user_delete();

REVOKE ALL ON FUNCTION public.activate_my_affiliate() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deactivate_my_affiliate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_my_affiliate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_my_affiliate() TO authenticated;

COMMIT;
