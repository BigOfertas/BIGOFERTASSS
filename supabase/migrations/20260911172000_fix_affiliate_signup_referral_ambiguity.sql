BEGIN;

-- Corrige o cadastro feito por link de afiliado. A função anterior usava uma
-- variável PL/pgSQL chamada `referral_code`, igual à coluna
-- `affiliates.referral_code`. No caminho de cadastro com indicação, a expressão
-- `a.referral_code = referral_code` ficava ambígua (SQLSTATE 42702) e fazia o
-- INSERT em auth.users ser revertido por completo.
--
-- Mantém as regras comerciais e a estrutura existentes; muda somente o nome da
-- variável local e explicita as referências usadas no vínculo da indicação.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_phone text := NULLIF(
    regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g'),
    ''
  );
  normalized_cpf text := NULLIF(
    regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g'),
    ''
  );
  normalized_referral_code text := upper(
    btrim(COALESCE(NEW.raw_user_meta_data ->> 'affiliate_referral_code', ''))
  );
  matched_affiliate_id uuid;
BEGIN
  IF normalized_phone IS NOT NULL
     AND NOT public.is_valid_brazilian_phone(normalized_phone) THEN
    normalized_phone := NULL;
  END IF;

  IF normalized_cpf IS NOT NULL
     AND NOT public.is_valid_brazilian_cpf(normalized_cpf) THEN
    normalized_cpf := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, cpf)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    normalized_phone,
    normalized_cpf
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer'::public.app_role);

  IF normalized_referral_code <> '' THEN
    SELECT a.id
    INTO matched_affiliate_id
    FROM public.affiliates AS a
    JOIN public.affiliate_program_settings AS s ON s.singleton = true
    WHERE s.enabled
      AND a.status = 'active'
      AND a.user_id IS NOT NULL
      AND a.referral_code = normalized_referral_code
      AND a.user_id <> NEW.id
    LIMIT 1;

    IF matched_affiliate_id IS NOT NULL THEN
      INSERT INTO public.affiliate_referrals (
        referred_user_id,
        affiliate_id,
        referral_code_snapshot
      )
      VALUES (
        NEW.id,
        matched_affiliate_id,
        normalized_referral_code
      )
      ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Cria perfil/role do cliente e registra indicação de afiliado sem ambiguidade entre variável PL/pgSQL e coluna referral_code.';

COMMIT;
