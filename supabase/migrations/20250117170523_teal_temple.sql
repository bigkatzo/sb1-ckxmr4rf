-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First drop all triggers
DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;

-- Then drop all functions in correct order
DROP FUNCTION IF EXISTS public.list_users() CASCADE;
DROP FUNCTION IF EXISTS public.delete_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.change_user_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.validate_user_credentials(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_user_with_username(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.verify_password(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.hash_password(text) CASCADE;
DROP FUNCTION IF EXISTS public.validate_username(text) CASCADE;

-- Create function to ensure user profile exists
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Only create profile if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN
    INSERT INTO public.user_profiles (id, role)
    VALUES (NEW.id, 'user'::user_role);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic profile creation
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_user_profile();

-- Create function to change user role
CREATE OR REPLACE FUNCTION public.change_user_role(
  p_user_id uuid,
  p_new_role text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Only admin can change user roles';
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Update role
  UPDATE public.user_profiles
  SET 
    role = p_new_role::user_role,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to list users with roles
CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE (
  id uuid,
  email varchar(255),
  role text,
  created_at timestamptz,
  has_collections boolean,
  has_access boolean
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email::varchar(255),
    COALESCE(p.role::text, 'user') as role,
    u.created_at,
    EXISTS (
      SELECT 1 FROM public.collections c WHERE c.user_id = u.id
    ) as has_collections,
    EXISTS (
      SELECT 1 FROM public.collection_access ca WHERE ca.user_id = u.id
    ) as has_access
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to delete user
CREATE OR REPLACE FUNCTION public.delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'::user_role
  ) THEN
    RAISE EXCEPTION 'Only admin can delete users';
  END IF;

  -- Delete user (will cascade to profile)
  DELETE FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_users() TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;

-- Ensure admin user exists
DO $$
BEGIN
  -- Create admin user in auth.users if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin420@merchant.local') THEN
    INSERT INTO auth.users (email, role)
    VALUES ('admin420@merchant.local', 'authenticated');
  END IF;

  -- Ensure admin profile exists with admin role
  INSERT INTO public.user_profiles (id, role)
  SELECT id, 'admin'::user_role
  FROM auth.users
  WHERE email = 'admin420@merchant.local'
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin'::user_role;
END $$;