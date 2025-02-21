-- Drop all existing triggers and functions that might interfere
DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS handle_email_confirmation_trigger ON auth.users;
    DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
    DROP TRIGGER IF EXISTS handle_user_created_trigger ON auth.users;
    DROP TRIGGER IF EXISTS validate_user_creation_trigger ON auth.users;
    DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
    DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
    
    DROP FUNCTION IF EXISTS public.handle_email_confirmation();
    DROP FUNCTION IF EXISTS public.handle_user_created();
    DROP FUNCTION IF EXISTS validate_user_creation();
    DROP FUNCTION IF EXISTS handle_auth_user();
    DROP FUNCTION IF EXISTS ensure_user_profile();
    DROP FUNCTION IF EXISTS public.handle_new_user();
    
    RAISE NOTICE 'Successfully dropped all existing triggers and functions';
EXCEPTION WHEN undefined_object THEN
    RAISE NOTICE 'Some objects did not exist, continuing...';
END $$;

-- Ensure user_role enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');
        RAISE NOTICE 'Created user_role enum';
    END IF;
END $$;

-- Create or update user_profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
        CREATE TABLE public.user_profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            role user_role NOT NULL DEFAULT 'merchant',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created user_profiles table';
    ELSE
        -- Ensure role column is user_role type
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'user_profiles' 
            AND column_name = 'role' 
            AND data_type = 'user_role'
        ) THEN
            ALTER TABLE public.user_profiles ALTER COLUMN role TYPE user_role USING (role::user_role);
            RAISE NOTICE 'Converted user_profiles.role to user_role type';
        END IF;
    END IF;
END $$;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _role user_role := 'merchant';
BEGIN
    RAISE NOTICE 'handle_new_user triggered for email: %', NEW.email;
    
    IF NEW.email LIKE '%@merchant.local' THEN
        RAISE NOTICE 'Processing merchant.local email: %', NEW.email;
        NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
        NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
            'role', _role,
            'email', NEW.email,
            'email_verified', true,
            'phone_verified', false
        );
        NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
            'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
            'providers', ARRAY['email'],
            'role', _role,
            'email_verified', true
        );
    ELSE
        NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
            'role', _role,
            'email', NEW.email,
            'email_verified', false,
            'phone_verified', false
        );
        NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
            'provider', COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
            'providers', ARRAY['email'],
            'role', _role,
            'email_verified', false
        );
    END IF;
    
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
    _role user_role := 'merchant';
BEGIN
    RAISE NOTICE 'handle_user_created triggered for email: %', NEW.email;
    
    IF NEW.email LIKE '%@merchant.local' THEN
        RAISE NOTICE 'Creating profile for merchant.local user: %', NEW.email;
        INSERT INTO public.user_profiles (id, role)
        VALUES (NEW.id, _role)
        ON CONFLICT (id) DO UPDATE
        SET role = EXCLUDED.role;
        RAISE NOTICE 'Created profile for merchant.local user: % with role: %', NEW.email, _role;
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
    _role user_role := 'merchant';
BEGIN
    RAISE NOTICE 'handle_email_confirmation triggered for user: %', NEW.email;
    RAISE NOTICE 'Old confirmation status: %, New confirmation status: %', OLD.email_confirmed_at, NEW.email_confirmed_at;
    
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        RAISE NOTICE 'Email confirmation detected for: %', NEW.email;
        NEW.raw_user_meta_data := NEW.raw_user_meta_data || jsonb_build_object('email_verified', true);
        NEW.raw_app_meta_data := NEW.raw_app_meta_data || jsonb_build_object('email_verified', true);
        
        IF NEW.email NOT LIKE '%@merchant.local' THEN
            INSERT INTO public.user_profiles (id, role)
            VALUES (NEW.id, _role)
            ON CONFLICT (id) DO UPDATE
            SET role = EXCLUDED.role;
            RAISE NOTICE 'Created profile after email confirmation for: % with role: %', NEW.email, _role;
        ELSE
            RAISE NOTICE 'Skipping profile creation for merchant.local email (already exists): %', NEW.email;
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
GRANT USAGE ON SCHEMA public TO postgres, authenticator, authenticated;
GRANT ALL ON public.user_profiles TO postgres, authenticator;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

-- Verify setup
DO $$
BEGIN
    RAISE NOTICE 'Checking configuration...';
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