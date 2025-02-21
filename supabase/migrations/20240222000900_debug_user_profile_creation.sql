-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create function to handle new user creation with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _role text;
BEGIN
    -- Log incoming data
    RAISE NOTICE 'Attempting to create profile for user ID: %, Email: %', NEW.id, NEW.email;
    RAISE NOTICE 'Raw app meta data: %', NEW.raw_app_meta_data;
    RAISE NOTICE 'Raw user meta data: %', NEW.raw_user_meta_data;

    -- Get role with logging
    _role := COALESCE(
        (NEW.raw_app_meta_data->>'role')::text,
        (NEW.raw_user_meta_data->>'role')::text,
        'merchant'  -- Default to merchant since this is a merchant registration
    );
    RAISE NOTICE 'Determined role: %', _role;

    BEGIN
        -- Create user profile with role and email
        INSERT INTO public.user_profiles (id, role, email)
        VALUES (
            NEW.id,
            _role,
            NEW.email
        );
        
        RAISE NOTICE 'Successfully created user profile for % with role %', NEW.email, _role;
    EXCEPTION WHEN OTHERS THEN
        -- Log the error details
        RAISE NOTICE 'Error creating user profile: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        -- Re-raise the error to ensure we know something went wrong
        RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Verify user_profiles table structure
DO $$
DECLARE
    column_info record;
BEGIN
    RAISE NOTICE 'Checking user_profiles table structure:';
    
    FOR column_info IN (
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
    ) LOOP
        RAISE NOTICE 'Column: %, Type: %, Nullable: %', 
            column_info.column_name, 
            column_info.data_type, 
            column_info.is_nullable;
    END LOOP;
END $$;

-- Verify RLS policies
DO $$
DECLARE
    policy_info record;
BEGIN
    RAISE NOTICE 'Checking RLS policies on user_profiles:';
    
    FOR policy_info IN (
        SELECT policyname, permissive, roles, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
    ) LOOP
        RAISE NOTICE 'Policy: %, Type: %, Roles: %, Command: %', 
            policy_info.policyname, 
            policy_info.permissive, 
            policy_info.roles, 
            policy_info.cmd;
    END LOOP;
END $$;

-- Verify trigger setup
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE 'on_auth_user_created trigger is configured';
    ELSE
        RAISE WARNING 'on_auth_user_created trigger is missing';
    END IF;

    -- Check if the function has the correct permissions
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'handle_new_user'
        AND p.prosecdef = true  -- Check if SECURITY DEFINER
    ) THEN
        RAISE NOTICE 'handle_new_user function has SECURITY DEFINER';
    ELSE
        RAISE WARNING 'handle_new_user function might have incorrect permissions';
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon;
GRANT ALL ON public.user_profiles TO postgres;
GRANT INSERT ON public.user_profiles TO postgres; 