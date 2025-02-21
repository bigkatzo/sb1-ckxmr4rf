-- Drop existing view if it exists
DROP VIEW IF EXISTS public.user_emails;

-- Create a view that only exposes emails
CREATE VIEW public.user_emails AS
SELECT email FROM public.user_profiles;

-- Grant necessary permissions
GRANT SELECT ON public.user_emails TO anon, authenticated;

-- Enable RLS on the view
ALTER VIEW public.user_emails SECURITY DEFINER;

-- Create policy for email availability check
CREATE POLICY "Anyone can check email availability"
ON public.user_emails
FOR SELECT
TO anon, authenticated
USING (true);

-- Verify setup
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Check if view exists
    IF EXISTS (
        SELECT 1
        FROM pg_views
        WHERE schemaname = 'public'
        AND viewname = 'user_emails'
    ) THEN
        RAISE NOTICE 'View user_emails is configured';
    ELSE
        RAISE WARNING 'View user_emails is missing';
    END IF;

    -- Verify permissions
    IF EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_name = 'user_emails' 
        AND grantee = 'anon'
        AND privilege_type = 'SELECT'
    ) THEN
        RAISE NOTICE 'Anon role has SELECT permission on user_emails';
    ELSE
        RAISE WARNING 'Anon role is missing SELECT permission on user_emails';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_name = 'user_emails' 
        AND grantee = 'authenticated'
        AND privilege_type = 'SELECT'
    ) THEN
        RAISE NOTICE 'Authenticated role has SELECT permission on user_emails';
    ELSE
        RAISE WARNING 'Authenticated role is missing SELECT permission on user_emails';
    END IF;
END $$; 