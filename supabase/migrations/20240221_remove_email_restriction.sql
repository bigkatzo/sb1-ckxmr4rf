-- Drop existing trigger first
DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;

-- Create updated function without email domain restriction
CREATE OR REPLACE FUNCTION handle_auth_user()
RETURNS trigger AS $$
BEGIN
  -- Extract username from email
  NEW.username := split_part(NEW.email, '@', 1);

  -- Set default metadata if not present
  IF NEW.raw_app_meta_data IS NULL OR NEW.raw_app_meta_data = '{}'::jsonb THEN
    NEW.raw_app_meta_data := jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', NEW.username,
      'role', CASE 
        WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
        ELSE 'merchant'
      END
    );
  END IF;

  IF NEW.raw_user_meta_data IS NULL OR NEW.raw_user_meta_data = '{}'::jsonb THEN
    NEW.raw_user_meta_data := jsonb_build_object(
      'username', NEW.username,
      'role', CASE 
        WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
        ELSE 'merchant'
      END
    );
  END IF;

  -- Set role to authenticated
  NEW.role := 'authenticated';

  -- Create or update profile
  BEGIN
    INSERT INTO user_profiles (id, role)
    VALUES (
      NEW.id,
      CASE 
        WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
        ELSE 'merchant'
      END
    )
    ON CONFLICT (id) DO UPDATE
    SET role = CASE 
      WHEN EXCLUDED.id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
      ELSE 'merchant'
    END;
  EXCEPTION WHEN others THEN
    -- Log error but don't fail the trigger
    RAISE WARNING 'Failed to create/update user profile: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user management
CREATE TRIGGER handle_auth_user_trigger
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user();

-- Log configuration
DO $$
BEGIN
    RAISE NOTICE 'Email domain restriction removed, all users will be created as merchants by default';
END $$; 