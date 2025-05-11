-- Add function to check email availability
-- This handles email checks in a way that's reliable and doesn't error out

-- Create the function if it doesn't exist
DO $$
BEGIN
  -- First check if the function exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE proname = 'check_email_availability' 
    AND nspname = 'public'
  ) THEN
    -- Create the function
    EXECUTE $FUNC$
    CREATE FUNCTION public.check_email_availability(p_email TEXT)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $BODY$
    DECLARE
      user_exists BOOLEAN;
    BEGIN
      -- Check auth.users first
      SELECT EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE email = p_email
      ) INTO user_exists;

      -- If user exists in auth.users, email is not available
      IF user_exists THEN
        RETURN FALSE;
      END IF;

      -- Check user_profiles as fallback
      SELECT EXISTS (
        SELECT 1 
        FROM public.user_profiles 
        WHERE email = p_email
      ) INTO user_exists;

      -- Return availability status (true = available, false = taken)
      RETURN NOT user_exists;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don't expose details to client
        RAISE LOG 'Error in check_email_availability: %', SQLERRM;
        -- Default to TRUE (available) on error to avoid blocking signup
        -- Auth system will still enforce uniqueness
        RETURN TRUE;
    END;
    $BODY$;
    $FUNC$;

    -- Grant execute permission
    GRANT EXECUTE ON FUNCTION public.check_email_availability TO authenticated, anon;
    
    RAISE NOTICE 'Created function check_email_availability';
  ELSE
    RAISE NOTICE 'Function check_email_availability already exists, skipping creation';
  END IF;
END$$; 