-- Set up proper permissions for API and auth service
DO $MAINBLOCK$ 
BEGIN
    -- Ensure user_role enum exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');
    END IF;

    -- Create table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.user_profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        role user_role NOT NULL DEFAULT 'merchant',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Disable RLS temporarily
    ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

    -- Drop existing permissions
    REVOKE ALL ON public.user_profiles FROM anon, authenticated, service_role, postgres, authenticator, supabase_auth_admin;
    
    -- Grant permissions in correct order
    -- 1. Schema usage
    GRANT USAGE ON SCHEMA public TO service_role, postgres, authenticator, supabase_auth_admin, anon, authenticated;
    
    -- 2. Table permissions
    GRANT ALL ON public.user_profiles TO service_role;
    GRANT ALL ON public.user_profiles TO supabase_auth_admin;
    GRANT ALL ON public.user_profiles TO authenticator;
    GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
    
    -- 3. Create simple trigger function with logging
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $TRIGFUNC$
    BEGIN
        RAISE NOTICE 'Trigger started for user ID: %, Role: %', NEW.id, current_user;
        INSERT INTO public.user_profiles (id, role)
        VALUES (NEW.id, 'merchant'::user_role)
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Insert completed for user ID: %', NEW.id;
        RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error in handle_new_user: % (State: %)', SQLERRM, SQLSTATE;
        RETURN NEW;
    END;
    $TRIGFUNC$;

    -- 4. Create trigger
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();

    -- Log configuration
    RAISE NOTICE 'Permissions and trigger configured';
END;
$MAINBLOCK$;

-- Verify permissions
DO $$
BEGIN
    RAISE NOTICE 'Checking permissions on user_profiles...';
    
    -- Check trigger existence
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger t 
        JOIN pg_class c ON t.tgrelid = c.oid 
        WHERE t.tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE 'Trigger exists and is properly configured';
    END IF;
END $$;