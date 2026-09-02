-- BIGofertas
-- FASE 08 — identidade obrigatoria do cliente
-- Nome, telefone brasileiro com DDD existente e CPF valido.
-- Complemento de endereco permanece opcional; demais campos essenciais continuam obrigatorios.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text;

CREATE OR REPLACE FUNCTION public.is_valid_brazilian_ddd(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT substring(regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g') from 1 for 2)
    = ANY (ARRAY[
      '11','12','13','14','15','16','17','18','19',
      '21','22','24','27','28',
      '31','32','33','34','35','37','38',
      '41','42','43','44','45','46','47','48','49',
      '51','53','54','55',
      '61','62','63','64','65','66','67','68','69',
      '71','73','74','75','77','79',
      '81','82','83','84','85','86','87','88','89',
      '91','92','93','94','95','96','97','98','99'
    ]::text[]);
$$;

CREATE OR REPLACE FUNCTION public.is_valid_brazilian_phone(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    length(regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g')) IN (10, 11)
    AND public.is_valid_brazilian_ddd(value);
$$;

CREATE OR REPLACE FUNCTION public.is_valid_brazilian_cpf(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  digits text := regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g');
  total integer := 0;
  expected integer;
  i integer;
BEGIN
  IF digits !~ '^[0-9]{11}$' OR digits ~ '^([0-9])\1{10}$' THEN
    RETURN false;
  END IF;

  FOR i IN 1..9 LOOP
    total := total + substring(digits from i for 1)::integer * (11 - i);
  END LOOP;

  expected := 11 - (total % 11);
  IF expected >= 10 THEN
    expected := 0;
  END IF;

  IF expected <> substring(digits from 10 for 1)::integer THEN
    RETURN false;
  END IF;

  total := 0;
  FOR i IN 1..10 LOOP
    total := total + substring(digits from i for 1)::integer * (12 - i);
  END LOOP;

  expected := 11 - (total % 11);
  IF expected >= 10 THEN
    expected := 0;
  END IF;

  RETURN expected = substring(digits from 11 for 1)::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_brazilian_ddd(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_brazilian_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_brazilian_cpf(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_brazilian_ddd(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_brazilian_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_brazilian_cpf(text) TO authenticated;

-- Dados antigos de teste que nao atendam a regra brasileira voltam a incompletos.
UPDATE public.profiles
SET phone = NULL
WHERE phone IS NOT NULL
  AND NOT public.is_valid_brazilian_phone(phone);

UPDATE public.profiles
SET cpf = NULL
WHERE cpf IS NOT NULL
  AND NOT public.is_valid_brazilian_cpf(cpf);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_format;
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_brazil_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_brazil_valid
  CHECK (phone IS NULL OR public.is_valid_brazilian_phone(phone));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cpf_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cpf_valid
  CHECK (cpf IS NULL OR public.is_valid_brazilian_cpf(cpf));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL;

-- Novos cadastros recebem os dados obrigatorios enviados pelo frontend.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_phone text := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g'), '');
  normalized_cpf text := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g'), '');
BEGIN
  IF normalized_phone IS NOT NULL AND NOT public.is_valid_brazilian_phone(normalized_phone) THEN
    normalized_phone := NULL;
  END IF;

  IF normalized_cpf IS NOT NULL AND NOT public.is_valid_brazilian_cpf(normalized_cpf) THEN
    normalized_cpf := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    cpf
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    normalized_phone,
    normalized_cpf
  );

  INSERT INTO public.user_roles (
    user_id,
    role
  )
  VALUES (
    NEW.id,
    'customer'::public.app_role
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_customer_identity()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  cpf text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.email, p.full_name, p.phone, p.cpf
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_my_customer_identity(
  p_full_name text,
  p_phone text,
  p_cpf text
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  cpf text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_name text := btrim(COALESCE(p_full_name, ''));
  normalized_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  normalized_cpf text := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  IF length(normalized_name) < 2 OR length(normalized_name) > 120 THEN
    RAISE EXCEPTION 'Informe seu nome completo';
  END IF;

  IF NOT public.is_valid_brazilian_phone(normalized_phone) THEN
    RAISE EXCEPTION 'Telefone invalido ou DDD inexistente';
  END IF;

  IF NOT public.is_valid_brazilian_cpf(normalized_cpf) THEN
    RAISE EXCEPTION 'CPF invalido';
  END IF;

  UPDATE public.profiles AS p
  SET
    full_name = normalized_name,
    phone = normalized_phone,
    cpf = normalized_cpf
  WHERE p.id = current_user_id;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.phone, p.cpf
  FROM public.profiles AS p
  WHERE p.id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_customer_identity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_customer_identity(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_customer_identity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_customer_identity(text, text, text) TO authenticated;

COMMIT;
