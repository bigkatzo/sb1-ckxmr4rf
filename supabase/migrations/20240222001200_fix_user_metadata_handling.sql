-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    _role user_role;
    _is_merchant_local boolean;
BEGIN
    -- Check if email is merchant.local
    _is_merchant_local := NEW.email LIKE '%@merchant.local';
    
    -- Set proper metadata
    IF _is_merchant_local THEN
        -- For merchant.local emails, set verified in app_metadata
        NEW.raw_app_meta_data := jsonb_build_object(
            'role', 'merchant',
            'provider', 'email',
            'providers', ARRAY['email'],
            'email_verified', true
        );
        NEW.raw_user_meta_data := jsonb_build_object(
            'role', 'merchant',
            'email', NEW.email,
            'email_verified', false,
            'phone_verified', false
        );
    ELSE
        -- For regular emails, update metadata properly
        NEW.raw_app_meta_data := jsonb_build_object(
            'provider', 'email',
            'providers', ARRAY['email']
        );
        NEW.raw_user_meta_data := jsonb_build_object(
            'role', 'merchant',
            'email', NEW.email,
            'email_verified', false,
            'phone_verified', false,
            'email_confirmed', false
        );
    END IF;

    -- Get role for user_profiles
    _role := COALESCE(
        (NEW.raw_app_meta_data->>'role')::user_role,
        (NEW.raw_user_meta_data->>'role')::user_role,
        'merchant'::user_role
    );

    -- Insert with error handling
    BEGIN
        INSERT INTO public.user_profiles (id, role, email)
        VALUES (
            NEW.id,
            _role,
            NEW.email
        );
        RAISE LOG 'Created user profile for % with role %', NEW.email, _role;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating user profile for %: %, SQLSTATE: %', NEW.email, SQLERRM, SQLSTATE;
    END;
    
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Verify setup
DO $$
BEGIN
    -- Check function
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'handle_new_user' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE 'Function public.handle_new_user is configured';
    ELSE
        RAISE WARNING 'Function public.handle_new_user is missing';
    END IF;

    -- Check trigger
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE 'Trigger on_auth_user_created is configured';
    ELSE
        RAISE WARNING 'Trigger on_auth_user_created is missing';
    END IF;
END $$; 