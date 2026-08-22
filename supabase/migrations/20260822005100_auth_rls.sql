-- BIGofertas
-- FASE 1.8B
-- RLS minima para cliente e administrador da loja

CREATE OR REPLACE FUNCTION public.has_role(
  required_role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = required_role
  );
$$;

REVOKE ALL
ON FUNCTION public.has_role(public.app_role)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.has_role(public.app_role)
TO authenticated;


ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "profiles_select_own"
ON public.profiles;

DROP POLICY IF EXISTS "profiles_select_owner"
ON public.profiles;

DROP POLICY IF EXISTS "profiles_update_own"
ON public.profiles;

DROP POLICY IF EXISTS "user_roles_select_own"
ON public.user_roles;

DROP POLICY IF EXISTS "user_roles_select_owner"
ON public.user_roles;


CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);

CREATE POLICY "profiles_select_owner"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role('owner'::public.app_role)
);

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
);


CREATE POLICY "user_roles_select_own"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

CREATE POLICY "user_roles_select_owner"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role('owner'::public.app_role)
);


REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM anon;

REVOKE ALL ON TABLE public.profiles FROM authenticated;
REVOKE ALL ON TABLE public.user_roles FROM authenticated;

GRANT SELECT
ON TABLE public.profiles
TO authenticated;

GRANT UPDATE (full_name, avatar_url)
ON TABLE public.profiles
TO authenticated;

GRANT SELECT
ON TABLE public.user_roles
TO authenticated;


REVOKE ALL
ON FUNCTION public.handle_new_user()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.sync_user_email()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.update_profiles_updated_at()
FROM PUBLIC;