-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create user profile with role and email
    INSERT INTO public.user_profiles (id, role, email)
    VALUES (
        NEW.id,
        COALESCE(
            (NEW.raw_app_meta_data->>'role')::text,
            (NEW.raw_user_meta_data->>'role')::text,
            'user'
        ),
        NEW.email
    );
    
    -- Log successful creation
    RAISE NOTICE 'Created user profile for %', NEW.email;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Verify setup
DO $$
BEGIN
    -- Verify function exists
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'handle_new_user'
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE 'handle_new_user function is configured';
    ELSE
        RAISE WARNING 'handle_new_user function is missing';
    END IF;

    -- Verify trigger exists
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE 'on_auth_user_created trigger is configured';
    ELSE
        RAISE WARNING 'on_auth_user_created trigger is missing';
    END IF;

    -- Verify all required columns exist
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name IN ('id', 'role', 'email')
    ) THEN
        RAISE NOTICE 'All required columns exist in user_profiles table';
    ELSE
        RAISE WARNING 'Missing required columns in user_profiles table';
    END IF;
END $$; 