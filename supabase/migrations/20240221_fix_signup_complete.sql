-- Drop all existing triggers and functions that might interfere
DO $$ 
BEGIN
    -- Drop triggers first (including the new one we're trying to create)
    DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
    DROP TRIGGER IF EXISTS validate_user_creation_trigger ON auth.users;
    DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
    DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
    
    -- Then drop functions
    DROP FUNCTION IF EXISTS validate_user_creation();
    DROP FUNCTION IF EXISTS handle_auth_user();
    DROP FUNCTION IF EXISTS ensure_user_profile();
    DROP FUNCTION IF EXISTS public.handle_new_user();
    DROP FUNCTION IF EXISTS public.handle_email_confirmation();
    
    RAISE NOTICE 'Successfully dropped all existing triggers and functions';
EXCEPTION WHEN undefined_object THEN
    -- Ignore errors from non-existent objects
    RAISE NOTICE 'Some objects did not exist, continuing...';
END $$;

-- Create function to handle new user registration
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
    
    -- Handle merchant.local emails differently
    IF NEW.email LIKE '%@merchant.local' THEN
        -- Auto-confirm merchant.local emails
        NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
        
        -- Create profile immediately for merchant.local
        INSERT INTO public.user_profiles (id, role)
        VALUES (NEW.id, 'merchant')
        ON CONFLICT (id) DO UPDATE
        SET role = 'merchant';
        
        RAISE NOTICE 'Created profile immediately for merchant.local user: %', NEW.email;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN others THEN
    RAISE WARNING 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle email confirmation
CREATE OR REPLACE FUNCTION public.handle_email_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if email was just confirmed (email_confirmed_at changed from null to a timestamp)
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        -- Don't create profile for merchant.local (already done in handle_new_user)
        IF NEW.email NOT LIKE '%@merchant.local' THEN
            -- Create user profile after email confirmation
            INSERT INTO public.user_profiles (id, role)
            VALUES (NEW.id, 'merchant')
            ON CONFLICT (id) DO UPDATE
            SET role = 'merchant';
            
            RAISE NOTICE 'Created profile after email confirmation for: %', NEW.email;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN others THEN
    RAISE WARNING 'Error in handle_email_confirmation: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER handle_new_user_trigger
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER handle_email_confirmation_trigger
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_email_confirmation();

-- Ensure proper permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticator, anon, authenticated;
GRANT ALL ON public.user_profiles TO postgres, authenticator;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

-- Verify setup
DO $$
BEGIN
    RAISE NOTICE 'Checking configuration...';
    
    -- Check if triggers exist
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE t.tgname IN ('handle_new_user_trigger', 'handle_email_confirmation_trigger')
        AND n.nspname = 'auth'
        AND c.relname = 'users'
    ) THEN
        RAISE NOTICE 'Triggers are properly configured';
    ELSE
        RAISE WARNING 'One or more triggers are missing';
    END IF;
    
    -- Check if functions exist
    IF EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname IN ('handle_new_user', 'handle_email_confirmation')
        AND n.nspname = 'public'
    ) THEN
        RAISE NOTICE 'Functions are properly configured';
    ELSE
        RAISE WARNING 'One or more functions are missing';
    END IF;
    
    -- Check user_profiles table
    IF EXISTS (
        SELECT 1 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
    ) THEN
        RAISE NOTICE 'Table user_profiles exists';
    ELSE
        RAISE WARNING 'Table user_profiles is missing';
    END IF;
END $$; 