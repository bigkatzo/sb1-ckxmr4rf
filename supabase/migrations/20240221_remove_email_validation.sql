-- Drop the trigger that enforces email domain restriction
DROP TRIGGER IF EXISTS validate_user_creation_trigger ON auth.users;
DROP FUNCTION IF EXISTS validate_user_creation();

-- Create a new validation function without email restriction
CREATE OR REPLACE FUNCTION validate_user_creation()
RETURNS trigger AS $$
BEGIN
  -- Set confirmed email by default for merchant.local emails only
  IF NEW.email LIKE '%@merchant.local' THEN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  END IF;
  
  -- Set default metadata
  NEW.raw_app_meta_data := jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', split_part(NEW.email, '@', 1)
  );
  
  NEW.raw_user_meta_data := jsonb_build_object(
    'username', split_part(NEW.email, '@', 1)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user validation without email restriction
CREATE TRIGGER validate_user_creation_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_creation();

-- Log configuration
DO $$
BEGIN
    RAISE NOTICE 'Email validation trigger updated - domain restriction removed';
END $$; 