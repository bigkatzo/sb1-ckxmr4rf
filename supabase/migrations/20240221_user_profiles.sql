-- Drop and recreate everything with proper permissions
DO $$ 
BEGIN
    -- Drop existing objects for a clean slate
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    DROP FUNCTION IF EXISTS public.handle_new_user();
    
    -- Recreate the user_role enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');
    END IF;

    -- Ensure the table exists with correct structure
    DROP TABLE IF EXISTS public.user_profiles CASCADE;
    CREATE TABLE public.user_profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        role user_role NOT NULL DEFAULT 'merchant',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

    -- Create RLS policies for authenticated users
    CREATE POLICY "Users can view own profile"
        ON public.user_profiles FOR SELECT
        USING (auth.uid() = id);

    CREATE POLICY "Users can update own profile"
        ON public.user_profiles FOR UPDATE
        USING (auth.uid() = id);

    -- Admin policy to view all profiles
    CREATE POLICY "Admins can view all profiles"
        ON public.user_profiles FOR SELECT
        USING (auth.role() = 'authenticated' AND EXISTS (
            SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'
        ));

    -- Create trigger function with proper security
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
        INSERT INTO public.user_profiles (id, role)
        VALUES (NEW.id, 'merchant'::user_role);
        RETURN NEW;
    END;
    $$;

    -- Set function owner to postgres (Supabase's superuser)
    ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

    -- Grant minimal required permissions
    REVOKE ALL ON public.user_profiles FROM authenticated;
    GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
    GRANT ALL ON public.user_profiles TO service_role;

    -- Create trigger
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
END;
$$;