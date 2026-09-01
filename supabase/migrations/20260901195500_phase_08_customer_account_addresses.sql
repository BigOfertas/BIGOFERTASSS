-- BIGofertas
-- FASE 08 — Area do cliente e enderecos
-- Escopo: perfil do cliente, agenda de enderecos, endereco principal e RPCs seguras.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_phone_format'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_phone_format
      CHECK (phone IS NULL OR phone ~ '^[0-9]{10,15}$');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Principal',
  recipient_name text NOT NULL,
  postal_code text NOT NULL,
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  neighborhood text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_addresses_label_valid
    CHECK (length(btrim(label)) BETWEEN 1 AND 40),
  CONSTRAINT customer_addresses_recipient_name_valid
    CHECK (length(btrim(recipient_name)) BETWEEN 2 AND 120),
  CONSTRAINT customer_addresses_postal_code_format
    CHECK (postal_code ~ '^[0-9]{8}$'),
  CONSTRAINT customer_addresses_street_not_blank
    CHECK (length(btrim(street)) > 0),
  CONSTRAINT customer_addresses_number_not_blank
    CHECK (length(btrim(number)) > 0),
  CONSTRAINT customer_addresses_neighborhood_not_blank
    CHECK (length(btrim(neighborhood)) > 0),
  CONSTRAINT customer_addresses_city_not_blank
    CHECK (length(btrim(city)) > 0),
  CONSTRAINT customer_addresses_state_format
    CHECK (state ~ '^[A-Z]{2}$')
);

CREATE INDEX IF NOT EXISTS customer_addresses_user_created_idx
  ON public.customer_addresses (user_id, created_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_per_user
  ON public.customer_addresses (user_id)
  WHERE is_default;

CREATE OR REPLACE FUNCTION public.touch_customer_address_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_customer_address_updated_at
ON public.customer_addresses;

CREATE TRIGGER touch_customer_address_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.touch_customer_address_updated_at();

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_addresses_select_own"
ON public.customer_addresses;

CREATE POLICY "customer_addresses_select_own"
ON public.customer_addresses
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.customer_addresses FROM anon;
REVOKE ALL ON TABLE public.customer_addresses FROM authenticated;
GRANT SELECT ON TABLE public.customer_addresses TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_account_profile()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.email, p.full_name, p.phone
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_my_account_profile(
  p_full_name text,
  p_phone text
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_phone text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  normalized_phone := NULLIF(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), '');

  IF normalized_phone IS NOT NULL
     AND normalized_phone !~ '^[0-9]{10,15}$' THEN
    RAISE EXCEPTION 'Telefone invalido';
  END IF;

  UPDATE public.profiles AS p
  SET
    full_name = NULLIF(btrim(COALESCE(p_full_name, '')), ''),
    phone = normalized_phone
  WHERE p.id = current_user_id;

  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.phone
  FROM public.profiles AS p
  WHERE p.id = current_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_customer_addresses()
RETURNS TABLE (
  id uuid,
  label text,
  recipient_name text,
  postal_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  is_default boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    a.id,
    a.label,
    a.recipient_name,
    a.postal_code,
    a.street,
    a.number,
    a.complement,
    a.neighborhood,
    a.city,
    a.state,
    a.is_default,
    a.created_at,
    a.updated_at
  FROM public.customer_addresses AS a
  WHERE a.user_id = auth.uid()
  ORDER BY a.is_default DESC, a.created_at ASC, a.id ASC;
$$;

CREATE OR REPLACE FUNCTION public.save_my_customer_address(
  p_id uuid,
  p_label text,
  p_recipient_name text,
  p_postal_code text,
  p_street text,
  p_number text,
  p_complement text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_is_default boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_id uuid;
  current_is_default boolean := false;
  resolved_is_default boolean := false;
  normalized_postal_code text;
  normalized_state text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  normalized_postal_code := regexp_replace(COALESCE(p_postal_code, ''), '[^0-9]', '', 'g');
  normalized_state := upper(btrim(COALESCE(p_state, '')));

  IF normalized_postal_code !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'CEP invalido';
  END IF;

  IF normalized_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'UF invalida';
  END IF;

  IF p_id IS NULL THEN
    resolved_is_default := COALESCE(p_is_default, false)
      OR NOT EXISTS (
        SELECT 1
        FROM public.customer_addresses AS a
        WHERE a.user_id = current_user_id
      );

    IF resolved_is_default THEN
      UPDATE public.customer_addresses AS a
      SET is_default = false
      WHERE a.user_id = current_user_id
        AND a.is_default;
    END IF;

    INSERT INTO public.customer_addresses (
      user_id,
      label,
      recipient_name,
      postal_code,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      is_default
    )
    VALUES (
      current_user_id,
      COALESCE(NULLIF(btrim(p_label), ''), 'Principal'),
      btrim(p_recipient_name),
      normalized_postal_code,
      btrim(p_street),
      btrim(p_number),
      NULLIF(btrim(COALESCE(p_complement, '')), ''),
      btrim(p_neighborhood),
      btrim(p_city),
      normalized_state,
      resolved_is_default
    )
    RETURNING id INTO target_id;

    RETURN target_id;
  END IF;

  SELECT a.is_default
  INTO current_is_default
  FROM public.customer_addresses AS a
  WHERE a.id = p_id
    AND a.user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Endereco inexistente';
  END IF;

  resolved_is_default := current_is_default OR COALESCE(p_is_default, false);

  IF COALESCE(p_is_default, false) THEN
    UPDATE public.customer_addresses AS a
    SET is_default = false
    WHERE a.user_id = current_user_id
      AND a.id <> p_id
      AND a.is_default;
  END IF;

  UPDATE public.customer_addresses AS a
  SET
    label = COALESCE(NULLIF(btrim(p_label), ''), 'Principal'),
    recipient_name = btrim(p_recipient_name),
    postal_code = normalized_postal_code,
    street = btrim(p_street),
    number = btrim(p_number),
    complement = NULLIF(btrim(COALESCE(p_complement, '')), ''),
    neighborhood = btrim(p_neighborhood),
    city = btrim(p_city),
    state = normalized_state,
    is_default = resolved_is_default
  WHERE a.id = p_id
    AND a.user_id = current_user_id;

  RETURN p_id;
END;
$$;

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

  UPDATE public.customer_addresses AS a
  SET is_default = (a.id = p_id)
  WHERE a.user_id = current_user_id
    AND a.is_default IS DISTINCT FROM (a.id = p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_customer_address(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  deleted_was_default boolean;
  next_default_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  DELETE FROM public.customer_addresses AS a
  WHERE a.id = p_id
    AND a.user_id = current_user_id
  RETURNING a.is_default INTO deleted_was_default;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Endereco inexistente';
  END IF;

  IF deleted_was_default THEN
    SELECT a.id
    INTO next_default_id
    FROM public.customer_addresses AS a
    WHERE a.user_id = current_user_id
    ORDER BY a.created_at ASC, a.id ASC
    LIMIT 1;

    IF next_default_id IS NOT NULL THEN
      UPDATE public.customer_addresses AS a
      SET is_default = true
      WHERE a.id = next_default_id;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_account_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_account_profile(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_customer_addresses() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_my_customer_address(uuid, text, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_default_my_customer_address(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_customer_address(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_account_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_account_profile(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_customer_addresses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_customer_address(uuid, text, text, text, text, text, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_my_customer_address(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_customer_address(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.touch_customer_address_updated_at() FROM PUBLIC;

COMMIT;
