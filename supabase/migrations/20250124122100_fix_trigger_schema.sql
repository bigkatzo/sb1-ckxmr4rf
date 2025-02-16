-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS ensure_user_fields ON auth.users;
DROP TRIGGER IF EXISTS force_user_fields ON auth.users;
DROP FUNCTION IF EXISTS fix_user_fields();
DROP FUNCTION IF EXISTS auth.force_user_fields();

-- Create the trigger function in the auth schema
CREATE OR REPLACE FUNCTION auth.ensure_user_fields()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Always set these fields
  NEW.aud := 'authenticated';
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.providers := ARRAY['email'];
  
  -- Fix metadata if needed
  NEW.raw_app_meta_data := jsonb_build_object(
    'provider', 'email',
    'providers', ARRAY['email'],
    'role', COALESCE(NEW.raw_app_meta_data->>'role', 'user')
  );

  -- Fix user metadata if needed
  NEW.raw_user_meta_data := jsonb_build_object(
    'email_verified', true
  );

  -- Log for debugging
  RAISE LOG 'TRIGGER ensure_user_fields executing:';
  RAISE LOG 'Before - aud: %, providers: %, raw_app_meta_data: %', 
    OLD.aud, OLD.providers, OLD.raw_app_meta_data;
  RAISE LOG 'After - aud: %, providers: %, raw_app_meta_data: %', 
    NEW.aud, NEW.providers, NEW.raw_app_meta_data;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger in the auth schema
CREATE TRIGGER ensure_user_fields
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.ensure_user_fields();

-- Verify trigger exists and is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'ensure_user_fields'
    AND tgrelid = 'auth.users'::regclass
  ) THEN
    RAISE EXCEPTION 'Trigger was not created properly';
  END IF;
END $$;

-- Fix any existing users
UPDATE auth.users
SET 
  aud = 'authenticated',
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now()),
  providers = ARRAY['email'],
  raw_app_meta_data = jsonb_build_object(
    'provider', 'email',
    'providers', ARRAY['email'],
    'role', COALESCE(raw_app_meta_data->>'role', 'user')
  ),
  raw_user_meta_data = jsonb_build_object(
    'email_verified', true
  )
WHERE aud IS NULL 
   OR created_at IS NULL 
   OR updated_at IS NULL 
   OR providers = '{}'::text[] 
   OR raw_app_meta_data->>'provider' != 'email'; 