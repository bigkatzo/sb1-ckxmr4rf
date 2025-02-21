-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS sync_user_profile_email_trigger ON user_profiles;
DROP TRIGGER IF EXISTS sync_auth_user_email_trigger ON auth.users;
DROP FUNCTION IF EXISTS sync_user_profile_email();
DROP FUNCTION IF EXISTS sync_auth_user_email();

-- Create function to sync email from auth.users to user_profiles on insert
CREATE OR REPLACE FUNCTION sync_user_profile_email()
RETURNS TRIGGER AS $$
BEGIN
    -- Get email from auth.users
    NEW.email := (
        SELECT email 
        FROM auth.users 
        WHERE id = NEW.id
    );
    
    -- If no email found, raise an error
    IF NEW.email IS NULL THEN
        RAISE EXCEPTION 'No corresponding email found in auth.users for user ID %', NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to sync email from auth.users to user_profiles on email update
CREATE OR REPLACE FUNCTION sync_auth_user_email()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if email has changed
    IF OLD.email = NEW.email THEN
        RETURN NEW;
    END IF;

    -- Update email in user_profiles
    UPDATE public.user_profiles
    SET email = NEW.email
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation
CREATE TRIGGER sync_user_profile_email_trigger
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_profile_email();

-- Create trigger for auth.users email updates
CREATE TRIGGER sync_auth_user_email_trigger
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_auth_user_email();

-- Verify existing data consistency
DO $$
DECLARE
    inconsistent_count INTEGER;
BEGIN
    -- Check for mismatched emails
    SELECT COUNT(*)
    INTO inconsistent_count
    FROM public.user_profiles up
    JOIN auth.users au ON au.id = up.id
    WHERE up.email != au.email
    OR up.email IS NULL;

    -- If inconsistencies found, fix them
    IF inconsistent_count > 0 THEN
        RAISE NOTICE 'Found % inconsistent email(s). Fixing...', inconsistent_count;
        
        UPDATE public.user_profiles up
        SET email = au.email
        FROM auth.users au
        WHERE au.id = up.id
        AND (up.email != au.email OR up.email IS NULL);
        
        RAISE NOTICE 'Fixed % email(s)', inconsistent_count;
    ELSE
        RAISE NOTICE 'No email inconsistencies found';
    END IF;
END $$;

-- Verify trigger setup
DO $$
BEGIN
    -- Verify sync_user_profile_email_trigger
    IF EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'sync_user_profile_email_trigger'
    ) THEN
        RAISE NOTICE 'sync_user_profile_email_trigger is configured';
    ELSE
        RAISE WARNING 'sync_user_profile_email_trigger is missing';
    END IF;

    -- Verify sync_auth_user_email_trigger
    IF EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'sync_auth_user_email_trigger'
    ) THEN
        RAISE NOTICE 'sync_auth_user_email_trigger is configured';
    ELSE
        RAISE WARNING 'sync_auth_user_email_trigger is missing';
    END IF;
END $$; 