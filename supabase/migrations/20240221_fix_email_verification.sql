-- Drop all existing triggers and functions that might interfere
DO $$ 
BEGIN
    -- Drop triggers first (including the new one we're trying to create)
    DROP TRIGGER IF EXISTS handle_email_confirmation_trigger ON auth.users;
    DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
    DROP TRIGGER IF EXISTS handle_user_created_trigger ON auth.users;
    DROP TRIGGER IF EXISTS validate_user_creation_trigger ON auth.users;
    DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
    DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
    
    -- Then drop functions
    DROP FUNCTION IF EXISTS public.handle_email_confirmation();
    DROP FUNCTION IF EXISTS public.handle_user_created();
    DROP FUNCTION IF EXISTS validate_user_creation();
    DROP FUNCTION IF EXISTS handle_auth_user();
    DROP FUNCTION IF EXISTS ensure_user_profile();
    DROP FUNCTION IF EXISTS public.handle_new_user();
    
    RAISE NOTICE 'Successfully dropped all existing triggers and functions';
EXCEPTION WHEN undefined_object THEN
    -- Ignore errors from non-existent objects
    RAISE NOTICE 'Some objects did not exist, continuing...';
END $$;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _role text := 'merchant';
BEGIN
    RAISE NOTICE 'handle_new_user triggered for email: %', NEW.email;
    
    -- Extract username from email
    NEW.username := split_part(NEW.email, '@', 1);
    
    -- Handle merchant.local emails differently
    IF NEW.email LIKE '%@merchant.local' THEN
        RAISE NOTICE 'Processing merchant.local email: %', NEW.email;
        
        -- Auto-confirm merchant.local emails
        NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
        
        -- Set metadata with email_verified true for merchant.local
        NEW.raw_user_meta_data := jsonb_build_object(
            'username', NEW.username,
            'role', _role,
            'email', NEW.email,
            'email_verified', true,
            'phone_verified', false
        );
        
        NEW.raw_app_meta_data := jsonb_build_object(
            'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
            'providers', ARRAY['email'],
            'role', _role,
            'email_verified', true
        );
    ELSE
        -- Regular email metadata
        NEW.raw_user_meta_data := jsonb_build_object(
            'username', NEW.username,
            'role', _role,
            'email', NEW.email,
            'email_verified', false,
            'phone_verified', false
        );
        
        NEW.raw_app_meta_data := jsonb_build_object(
            'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
            'providers', ARRAY['email'],
            'role', _role,
            'email_verified', false
        );
    END IF;
    
    -- Ensure role is set
    NEW.role := 'authenticated';
    
    RETURN NEW;
EXCEPTION WHEN others THEN
    RAISE WARNING 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to handle after user creation
CREATE OR REPLACE FUNCTION public.handle_user_created()
RETURNS TRIGGER AS $$
DECLARE
    _role text := 'merchant';
BEGIN
    RAISE NOTICE 'handle_user_created triggered for email: %', NEW.email;
    
    -- For merchant.local emails, create profile immediately
    IF NEW.email LIKE '%@merchant.local' THEN
        RAISE NOTICE 'Creating profile for merchant.local user: %', NEW.email;
        
        -- Create profile immediately for merchant.local
        BEGIN
            INSERT INTO public.user_profiles (id, role)
            VALUES (NEW.id, _role::text)
            ON CONFLICT (id) DO UPDATE
            SET role = EXCLUDED.role;
            
            RAISE NOTICE 'Created profile immediately for merchant.local user: % with role: %', NEW.email, _role;
        EXCEPTION WHEN others THEN
            RAISE WARNING 'Error creating profile for merchant.local user: % %', SQLERRM, SQLSTATE;
        END;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN others THEN
    RAISE WARNING 'Error in handle_user_created: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to handle email confirmation
CREATE OR REPLACE FUNCTION public.handle_email_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    _role text := 'merchant';
BEGIN
    RAISE NOTICE 'handle_email_confirmation triggered for user: %', NEW.email;
    RAISE NOTICE 'Old confirmation status: %, New confirmation status: %', OLD.email_confirmed_at, NEW.email_confirmed_at;
    
    -- Only proceed if email was just confirmed (email_confirmed_at changed from null to a timestamp)
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        RAISE NOTICE 'Email confirmation detected for: %', NEW.email;
        
        -- Update metadata to show email is verified
        NEW.raw_user_meta_data := NEW.raw_user_meta_data || 
            jsonb_build_object('email_verified', true);
        NEW.raw_app_meta_data := NEW.raw_app_meta_data || 
            jsonb_build_object('email_verified', true);
        
        -- Don't create profile for merchant.local (already done in handle_user_created)
        IF NEW.email NOT LIKE '%@merchant.local' THEN
            -- Create user profile after email confirmation
            BEGIN
                INSERT INTO public.user_profiles (id, role)
                VALUES (NEW.id, _role::text)
                ON CONFLICT (id) DO UPDATE
                SET role = EXCLUDED.role
                RETURNING id, role;
                
                RAISE NOTICE 'Created profile after email confirmation for: % with role: %', NEW.email, _role;
            EXCEPTION WHEN others THEN
                RAISE WARNING 'Error creating profile after email confirmation: % %', SQLERRM, SQLSTATE;
            END;
        ELSE
            RAISE NOTICE 'Skipping profile creation for merchant.local email (should already exist): %', NEW.email;
        END IF;
    ELSE
        RAISE NOTICE 'No email confirmation change detected for: %', NEW.email;
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN others THEN
    RAISE WARNING 'Error in handle_email_confirmation: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Make sure user_profiles table exists with correct structure
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
        CREATE TABLE public.user_profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'merchant',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        RAISE NOTICE 'Created user_profiles table';
    END IF;
END $$;

-- Create triggers
CREATE TRIGGER handle_new_user_trigger
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER handle_user_created_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_created();

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
        WHERE t.tgname IN ('handle_new_user_trigger', 'handle_user_created_trigger', 'handle_email_confirmation_trigger')
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
        WHERE p.proname IN ('handle_new_user', 'handle_user_created', 'handle_email_confirmation')
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