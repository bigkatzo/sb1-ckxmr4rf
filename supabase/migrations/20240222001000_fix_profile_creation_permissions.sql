-- First, drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create policy to allow the trigger function to insert profiles
CREATE POLICY "Allow trigger to create profiles"
ON public.user_profiles
FOR INSERT
TO postgres
WITH CHECK (true);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    _role text;
BEGIN
    -- Get role with proper default
    _role := COALESCE(
        (NEW.raw_app_meta_data->>'role')::text,
        (NEW.raw_user_meta_data->>'role')::text,
        'merchant'  -- Default to merchant since this is a merchant registration
    );

    -- Insert with explicit transaction handling
    BEGIN
        INSERT INTO public.user_profiles (id, role, email)
        VALUES (
            NEW.id,
            _role,
            NEW.email
        );
        
        RAISE LOG 'Created user profile for % with role %', NEW.email, _role;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating user profile: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        RETURN NULL; -- Prevents the auth.users insert from being rolled back
    END;
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL ON public.user_profiles TO postgres;
GRANT INSERT ON public.user_profiles TO postgres;

-- Temporarily disable RLS for setup
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

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
                (au.raw_app_meta_data->>'role')::text,
                (au.raw_user_meta_data->>'role')::text,
                'merchant'
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

-- Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Verify setup
DO $$
BEGIN
    -- Check if the function exists and has the correct properties
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'handle_new_user'
        AND p.prosecdef = true
    ) THEN
        RAISE NOTICE 'handle_new_user function is properly configured with SECURITY DEFINER';
    ELSE
        RAISE WARNING 'handle_new_user function configuration issue detected';
    END IF;

    -- Check if the trigger exists
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE 'on_auth_user_created trigger is properly configured';
    ELSE
        RAISE WARNING 'on_auth_user_created trigger is missing';
    END IF;

    -- Check if the insert policy exists
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND policyname = 'Allow trigger to create profiles'
    ) THEN
        RAISE NOTICE 'Insert policy is properly configured';
    ELSE
        RAISE WARNING 'Insert policy is missing';
    END IF;
END $$; 