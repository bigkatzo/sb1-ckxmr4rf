-- Drop existing view and policies since we're moving to a function-based approach
DROP VIEW IF EXISTS public.user_emails;
DROP POLICY IF EXISTS "Anyone can check email availability" ON user_profiles;

-- Ensure email column exists and is properly configured
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD COLUMN email TEXT UNIQUE;
        
        -- Update existing profiles with emails from auth.users if needed
        UPDATE user_profiles
        SET email = au.email
        FROM auth.users au
        WHERE user_profiles.id = au.id
        AND user_profiles.email IS NULL;
        
        RAISE NOTICE 'Added and populated email column in public.user_profiles';
    END IF;
END $$;

-- Create function to check email availability
CREATE OR REPLACE FUNCTION public.check_email_availability(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 
        FROM public.user_profiles 
        WHERE email = p_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_availability(TEXT) TO anon, authenticated;

-- Verify setup
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'check_email_availability' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE 'Function check_email_availability is configured';
    ELSE
        RAISE WARNING 'Function check_email_availability is missing';
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.routine_privileges 
        WHERE routine_name = 'check_email_availability' 
        AND grantee = 'anon'
    ) THEN
        RAISE NOTICE 'Anon role has EXECUTE permission on check_email_availability';
    ELSE
        RAISE WARNING 'Anon role is missing EXECUTE permission';
    END IF;
END $$; 