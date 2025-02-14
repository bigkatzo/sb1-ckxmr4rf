-- Create improved database connection check function
CREATE OR REPLACE FUNCTION check_database_connection()
RETURNS boolean AS $$
BEGIN
  -- Try a simple query to verify connection
  PERFORM now();
  RETURN true;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle connection retries
CREATE OR REPLACE FUNCTION with_connection_retry(
  max_retries int DEFAULT 3,
  delay_ms int DEFAULT 1000
)
RETURNS boolean AS $$
DECLARE
  attempts int := 0;
  success boolean := false;
BEGIN
  WHILE attempts < max_retries AND NOT success LOOP
    BEGIN
      success := check_database_connection();
      IF success THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN others THEN
      -- Log error and continue
      RAISE NOTICE 'Connection attempt % failed: %', attempts + 1, SQLERRM;
    END;
    
    attempts := attempts + 1;
    IF NOT success AND attempts < max_retries THEN
      -- Add exponential backoff with jitter
      PERFORM pg_sleep((delay_ms * power(2, attempts - 1) + floor(random() * 1000)::int) / 1000.0);
    END IF;
  END LOOP;

  RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;
GRANT EXECUTE ON FUNCTION with_connection_retry(int, int) TO authenticated;