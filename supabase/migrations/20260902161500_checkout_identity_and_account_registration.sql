BEGIN;

-- BIGofertas — evolução incremental da identidade do cliente para o checkout em 4 etapas.
-- O cadastro inicial continua simples (nome, e-mail e senha). Dados fiscais e de contato
-- são exigidos apenas na etapa 1 do checkout.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_type text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS secondary_phone text;

CREATE OR REPLACE FUNCTION public.is_valid_brazilian_cnpj(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  digits text := regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g');
  weights_first integer[] := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2];
  weights_second integer[] := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2];
  total integer := 0;
  remainder integer;
  expected integer;
  i integer;
BEGIN
  IF digits !~ '^[0-9]{14}$' OR digits ~ '^([0-9])\1{13}$' THEN
    RETURN false;
  END IF;

  FOR i IN 1..12 LOOP
    total := total + substring(digits from i for 1)::integer * weights_first[i];
  END LOOP;

  remainder := total % 11;
  expected := CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END;
  IF expected <> substring(digits from 13 for 1)::integer THEN
    RETURN false;
  END IF;

  total := 0;
  FOR i IN 1..13 LOOP
    total := total + substring(digits from i for 1)::integer * weights_second[i];
  END LOOP;

  remainder := total % 11;
  expected := CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END;
  RETURN expected = substring(digits from 14 for 1)::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_brazilian_cnpj(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_brazilian_cnpj(text) TO authenticated;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_person_type_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_person_type_valid
  CHECK (person_type IS NULL OR person_type IN ('individual', 'business'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_cnpj_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cnpj_valid
  CHECK (cnpj IS NULL OR public.is_valid_brazilian_cnpj(cnpj));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_secondary_phone_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_secondary_phone_valid
  CHECK (secondary_phone IS NULL OR public.is_valid_brazilian_phone(secondary_phone));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_company_name_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_name_valid
  CHECK (company_name IS NULL OR length(btrim(company_name)) BETWEEN 2 AND 160);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_trade_name_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_trade_name_valid
  CHECK (trade_name IS NULL OR length(btrim(trade_name)) BETWEEN 2 AND 160);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cnpj_unique
  ON public.profiles (cnpj)
  WHERE cnpj IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_my_checkout_identity()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  person_type text,
  phone text,
  secondary_phone text,
  cpf text,
  cnpj text,
  company_name text,
  trade_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.person_type,
    p.phone,
    p.secondary_phone,
    p.cpf,
    p.cnpj,
    p.company_name,
    p.trade_name
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_my_checkout_identity(
  p_person_type text,
  p_full_name text,
  p_phone text,
  p_secondary_phone text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_cnpj text DEFAULT NULL,
  p_company_name text DEFAULT NULL,
  p_trade_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  person_type text,
  phone text,
  secondary_phone text,
  cpf text,
  cnpj text,
  company_name text,
  trade_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_type text := lower(btrim(COALESCE(p_person_type, '')));
  normalized_name text := btrim(COALESCE(p_full_name, ''));
  normalized_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  normalized_secondary text := NULLIF(regexp_replace(COALESCE(p_secondary_phone, ''), '[^0-9]', '', 'g'), '');
  normalized_cpf text := NULLIF(regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g'), '');
  normalized_cnpj text := NULLIF(regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g'), '');
  normalized_company_name text := NULLIF(btrim(COALESCE(p_company_name, '')), '');
  normalized_trade_name text := NULLIF(btrim(COALESCE(p_trade_name, '')), '');
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  IF normalized_type NOT IN ('individual', 'business') THEN
    RAISE EXCEPTION 'Escolha pessoa fisica ou pessoa juridica';
  END IF;

  IF length(normalized_name) < 2 OR length(normalized_name) > 120 THEN
    RAISE EXCEPTION 'Informe seu nome completo';
  END IF;

  IF NOT public.is_valid_brazilian_phone(normalized_phone) THEN
    RAISE EXCEPTION 'Telefone principal invalido ou DDD inexistente';
  END IF;

  IF normalized_secondary IS NOT NULL THEN
    IF NOT public.is_valid_brazilian_phone(normalized_secondary) THEN
      RAISE EXCEPTION 'Telefone secundario invalido ou DDD inexistente';
    END IF;
    IF normalized_secondary = normalized_phone THEN
      RAISE EXCEPTION 'O telefone secundario deve ser diferente do principal';
    END IF;
  END IF;

  IF normalized_type = 'individual' THEN
    IF normalized_cpf IS NULL OR NOT public.is_valid_brazilian_cpf(normalized_cpf) THEN
      RAISE EXCEPTION 'CPF invalido';
    END IF;
    normalized_cnpj := NULL;
    normalized_company_name := NULL;
    normalized_trade_name := NULL;
  ELSE
    IF normalized_cnpj IS NULL OR NOT public.is_valid_brazilian_cnpj(normalized_cnpj) THEN
      RAISE EXCEPTION 'CNPJ invalido';
    END IF;
    IF normalized_company_name IS NULL OR length(normalized_company_name) < 2 THEN
      RAISE EXCEPTION 'Informe a razao social';
    END IF;
    normalized_cpf := NULL;
  END IF;

  UPDATE public.profiles AS p
  SET
    person_type = normalized_type,
    full_name = normalized_name,
    phone = normalized_phone,
    secondary_phone = normalized_secondary,
    cpf = normalized_cpf,
    cnpj = normalized_cnpj,
    company_name = normalized_company_name,
    trade_name = normalized_trade_name
  WHERE p.id = current_user_id;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.person_type,
    p.phone,
    p.secondary_phone,
    p.cpf,
    p.cnpj,
    p.company_name,
    p.trade_name
  FROM public.profiles AS p
  WHERE p.id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_checkout_identity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_checkout_identity(text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_checkout_identity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_checkout_identity(text, text, text, text, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.get_my_checkout_identity() IS
  'Retorna os dados de identificacao usados na etapa 1 do checkout autenticado.';
COMMENT ON FUNCTION public.update_my_checkout_identity(text, text, text, text, text, text, text, text) IS
  'Salva e valida identidade PF/PJ e telefones da etapa 1 do checkout.';

COMMIT;
