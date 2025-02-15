-- Update the user's metadata to include admin role
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'provider', COALESCE(raw_app_meta_data->>'provider', 'email'),
    'providers', ARRAY['email'],
    'role', 'admin'
  ),
  raw_user_meta_data = jsonb_build_object(
    'role', 'admin'
  )
WHERE id = auth.uid();

-- Ensure user profile exists with admin role
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE id = auth.uid()
ON CONFLICT (id) DO UPDATE
SET role = 'admin'; 