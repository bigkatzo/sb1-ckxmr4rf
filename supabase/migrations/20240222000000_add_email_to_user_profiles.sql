-- Drop existing RLS policies first
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- Add email column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN email TEXT UNIQUE;

-- Create index for faster email lookups
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_unique_idx ON user_profiles (email);

-- Update existing profiles with emails from auth.users
UPDATE user_profiles
SET email = au.email
FROM auth.users au
WHERE user_profiles.id = au.id;

-- Make email column NOT NULL after updating existing data
ALTER TABLE user_profiles
ALTER COLUMN email SET NOT NULL;

-- Create a trigger to automatically set email when creating new profiles
CREATE OR REPLACE FUNCTION sync_user_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Get email from auth.users
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  
  -- If no email found, raise an error
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'No corresponding email found in auth.users';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_user_profile_email_trigger ON user_profiles;

CREATE TRIGGER sync_user_profile_email_trigger
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_user_profile_email();

-- Update RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Regular user policies
CREATE POLICY "Users can view their own profile"
ON user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON user_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin policies
CREATE POLICY "Admins can view all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

CREATE POLICY "Admins can update all profiles"
ON user_profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

-- Grant necessary permissions
GRANT SELECT, UPDATE (role, email) ON user_profiles TO authenticated;

-- Verify data integrity
DO $$
DECLARE
  missing_emails INTEGER;
BEGIN
  -- Check for any user_profiles without emails
  SELECT COUNT(*)
  INTO missing_emails
  FROM user_profiles
  WHERE email IS NULL;

  -- If any profiles are missing emails, raise an error
  IF missing_emails > 0 THEN
    RAISE EXCEPTION 'Data integrity check failed: % user profiles are missing emails', missing_emails;
  END IF;
END;
$$;

-- Create optimized email availability check function
CREATE OR REPLACE FUNCTION public.check_email_availability(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Use the unique index for efficient lookup
    RETURN NOT EXISTS (
        SELECT 1 
        FROM public.user_profiles 
        WHERE email = p_email
        LIMIT 1  -- Optimize for early exit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.check_email_availability(TEXT) TO authenticated, anon;

-- Verify function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'check_email_availability'
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE EXCEPTION 'Function check_email_availability not created properly';
    END IF;
END $$;

-- Create trigger for updating timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_user_profiles_timestamp ON public.user_profiles;

-- Create trigger
CREATE TRIGGER update_user_profiles_timestamp
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify trigger exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'update_user_profiles_timestamp'
    ) THEN
        RAISE EXCEPTION 'Trigger update_user_profiles_timestamp not created properly';
    END IF;
END $$; 