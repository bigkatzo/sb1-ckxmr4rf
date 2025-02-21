-- Drop and recreate everything with proper permissions
DO $MAINBLOCK$ 
BEGIN
    -- Drop existing objects
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP FUNCTION IF EXISTS public.handle_new_user();
    
    -- Recreate user_role enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');
    END IF;

    -- Recreate table with minimal required columns
    DROP TABLE IF EXISTS public.user_profiles CASCADE;
    CREATE TABLE public.user_profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        role user_role NOT NULL DEFAULT 'merchant',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Temporarily disable RLS for testing
    ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

    -- Create trigger function with detailed logging
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $TRIGFUNC$
    BEGIN
        RAISE LOG 'Trigger started for user ID: %, Role: %', NEW.id, current_user;
        INSERT INTO public.user_profiles (id, role)
        VALUES (NEW.id, 'merchant'::user_role);
        RAISE LOG 'Insert successful for user ID: %', NEW.id;
        RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user: % (State: %)', SQLERRM, SQLSTATE;
        RETURN NEW; -- Continue even if profile creation fails
    END;
    $TRIGFUNC$;

    -- Grant minimal permissions
    REVOKE ALL ON public.user_profiles FROM postgres;
    REVOKE ALL ON public.user_profiles FROM service_role;
    GRANT ALL ON public.user_profiles TO supabase_auth_admin; -- For auth trigger execution
    GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

    -- Create trigger
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
END;
$MAINBLOCK$;