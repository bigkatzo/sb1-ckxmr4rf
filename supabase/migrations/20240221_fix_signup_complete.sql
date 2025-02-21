-- Drop all existing triggers and functions that might interfere
DO $$ 
BEGIN
    -- Drop triggers first
    DROP TRIGGER IF EXISTS validate_user_creation_trigger ON auth.users;
    DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
    DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    
    -- Then drop functions
    DROP FUNCTION IF EXISTS validate_user_creation();
    DROP FUNCTION IF EXISTS handle_auth_user();
    DROP FUNCTION IF EXISTS ensure_user_profile();
    DROP FUNCTION IF EXISTS public.handle_new_user();
    
EXCEPTION WHEN undefined_object THEN
    -- Ignore errors from non-existent objects
    NULL;
END $$;

-- Create a simple, reliable trigger function for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract username from email
    NEW.username := split_part(NEW.email, '@', 1);
    
    -- Set basic metadata
    NEW.raw_app_meta_data := jsonb_build_object(
        'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
        'providers', ARRAY['email'],
        'role', 'merchant'
    );
    
    NEW.raw_user_meta_data := jsonb_build_object(
        'username', NEW.username,
        'role', 'merchant'
    );
    
    -- Ensure role is set
    NEW.role := 'authenticated';
    
    -- Create user profile
    INSERT INTO public.user_profiles (id, role)
    VALUES (NEW.id, 'merchant')
    ON CONFLICT (id) DO UPDATE
    SET role = 'merchant';
    
    RETURN NEW;
EXCEPTION WHEN others THEN
    RAISE LOG 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger
CREATE TRIGGER handle_new_user_trigger
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Ensure proper permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticator, anon, authenticated;
GRANT ALL ON public.user_profiles TO postgres, authenticator;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

-- Verify setup
DO $$
BEGIN
    RAISE NOTICE 'Checking configuration...';
    
    -- Check if trigger exists
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'handle_new_user_trigger'
    ) THEN
        RAISE NOTICE 'Trigger handle_new_user_trigger is properly configured';
    ELSE
        RAISE WARNING 'Trigger handle_new_user_trigger is missing';
    END IF;
    
    -- Check if function exists
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'handle_new_user'
    ) THEN
        RAISE NOTICE 'Function handle_new_user is properly configured';
    ELSE
        RAISE WARNING 'Function handle_new_user is missing';
    END IF;
    
    -- Check user_profiles table
    IF EXISTS (
        SELECT 1 
        FROM pg_tables 
        WHERE tablename = 'user_profiles'
    ) THEN
        RAISE NOTICE 'Table user_profiles exists';
    ELSE
        RAISE WARNING 'Table user_profiles is missing';
    END IF;
END $$; 