-- Create function to ensure user profile exists
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_app_meta_data->>'role')::user_role,
      'user'::user_role
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create trigger for user updates
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_app_meta_data->>'role' IS DISTINCT FROM NEW.raw_app_meta_data->>'role')
  EXECUTE FUNCTION handle_new_user();

-- Sync existing users
INSERT INTO user_profiles (id, role)
SELECT 
  id,
  COALESCE(
    (raw_app_meta_data->>'role')::user_role,
    'user'::user_role
  ) as role
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role; 