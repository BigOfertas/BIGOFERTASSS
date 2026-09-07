BEGIN;

-- Todo novo cadastro precisa informar um telefone brasileiro válido.
-- A validação no formulário melhora a experiência; este trigger garante a regra
-- também no banco para qualquer novo usuário criado pelo fluxo de cadastro.
CREATE OR REPLACE FUNCTION public.require_phone_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_phone text := regexp_replace(
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    '[^0-9]',
    '',
    'g'
  );
BEGIN
  IF NOT public.is_valid_brazilian_phone(normalized_phone) THEN
    RAISE EXCEPTION 'Telefone invalido ou DDD inexistente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_phone_on_signup ON auth.users;
CREATE TRIGGER require_phone_on_signup
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.require_phone_on_signup();

COMMIT;
