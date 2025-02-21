-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Ensure user_profiles has an email column
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
        RAISE NOTICE 'Added email column to public.user_profiles';
    END IF;
END $$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticator, authenticated, anon;
GRANT ALL ON public.user_profiles TO postgres, authenticator; -- authenticator for Supabase triggers

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    _role user_role;
BEGIN
    -- Get role with proper default, cast to user_role
    _role := COALESCE(
        (NEW.raw_app_meta_data->>'role')::user_role,
        (NEW.raw_user_meta_data->>'role')::user_role,
        'merchant'::user_role
    );

    -- Insert with error handling
    BEGIN
        INSERT INTO public.user_profiles (id, role, email)
        VALUES (
            NEW.id,
            _role,
            NEW.email
        );
        RAISE LOG 'Created user profile for % with role %', NEW.email, _role;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating user profile for %: %, SQLSTATE: %', NEW.email, SQLERRM, SQLSTATE;
        -- Continue signup even if profile insert fails
    END;
    
    RETURN NEW; -- Always return NEW to ensure signup succeeds
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Verify setup
DO $$
BEGIN
    -- Check function
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'handle_new_user' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE 'Function public.handle_new_user is configured';
    ELSE
        RAISE WARNING 'Function public.handle_new_user is missing';
    END IF;

    -- Check trigger
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created' 
        AND tgrelid = 'auth.users'::regclass
    ) THEN
        RAISE NOTICE 'Trigger on_auth_user_created is configured';
    ELSE
        RAISE WARNING 'Trigger on_auth_user_created is missing';
    END IF;

    -- Check permissions
    IF EXISTS (
        SELECT 1 
        FROM information_schema.role_table_grants 
        WHERE table_name = 'user_profiles' 
        AND grantee = 'authenticator' 
        AND privilege_type = 'INSERT'
    ) THEN
        RAISE NOTICE 'Authenticator has INSERT permission on user_profiles';
    ELSE
        RAISE WARNING 'Authenticator may be missing INSERT permission on user_profiles';
    END IF;

    -- Check if user_role type exists and contains expected values
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE t.typname = 'user_role'
        AND n.nspname = 'public'
    ) THEN
        RAISE NOTICE 'user_role type exists';
    ELSE
        RAISE WARNING 'user_role type is missing';
    END IF;
END $$;

-- Verify and fix any missing profiles
DO $$
DECLARE
    missing_count integer;
BEGIN
    SELECT COUNT(*)
    INTO missing_count
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON up.id = au.id
    WHERE up.id IS NULL;

    IF missing_count > 0 THEN
        RAISE NOTICE 'Found % users without profiles. Creating missing profiles...', missing_count;
        
        INSERT INTO public.user_profiles (id, role, email)
        SELECT 
            au.id,
            COALESCE(
                (au.raw_app_meta_data->>'role')::user_role,
                (au.raw_user_meta_data->>'role')::user_role,
                'merchant'::user_role
            ),
            au.email
        FROM auth.users au
        LEFT JOIN public.user_profiles up ON up.id = au.id
        WHERE up.id IS NULL;
        
        RAISE NOTICE 'Created % missing profiles', missing_count;
    ELSE
        RAISE NOTICE 'No missing profiles found';
    END IF;
END $$; 