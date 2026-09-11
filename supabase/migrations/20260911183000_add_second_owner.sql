BEGIN;

-- DropBox — cadastra a segunda conta administrativa autorizada pelo owner.
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('lo2341097@gmail.com')
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'A segunda conta owner ainda nao existe no Auth';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'owner'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = target_user_id
      AND role = 'owner'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Falha ao promover a segunda conta para owner';
  END IF;
END;
$$;

COMMIT;
