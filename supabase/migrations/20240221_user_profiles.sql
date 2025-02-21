-- Set up user_profiles and trigger safely
DO $MAINBLOCK$ 
BEGIN
    -- Drop trigger and function only
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP FUNCTION IF EXISTS public.handle_new_user();
    
    -- Recreate user_role enum if missing
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

    -- Disable RLS for testing
    ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

    -- Create trigger function with robust logging
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $TRIGFUNC$
    BEGIN
        RAISE NOTICE 'Trigger started for user ID: %, Role: %', NEW.id, current_user;
        RAISE NOTICE 'Attempting insert into user_profiles';
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

    -- Grant permissions
    GRANT ALL ON public.user_profiles TO supabase_auth_admin;
    GRANT ALL ON public.user_profiles TO authenticator;
    GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

    -- Create trigger
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
END;
$MAINBLOCK$;