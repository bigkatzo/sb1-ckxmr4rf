-- Create a secure schema for users
create schema if not exists auth;

-- Check if table exists first
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
        -- Create user_profiles table if it doesn't exist
        CREATE TABLE public.user_profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            role user_role NOT NULL DEFAULT 'merchant',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "Users can view own profile"
            ON public.user_profiles
            FOR SELECT
            USING (auth.uid() = id);

        CREATE POLICY "Users can update own profile"
            ON public.user_profiles
            FOR UPDATE
            USING (auth.uid() = id);

        -- Create trigger function for profile creation
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            INSERT INTO public.user_profiles (id, role)
            VALUES (NEW.id, 'merchant')
            ON CONFLICT (id) DO NOTHING;
            RETURN NEW;
        END;
        $$;

        -- Create trigger (only if it doesn't exist)
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user();
    END IF;
END
$$; 