-- Check admin420's profile and auth data
DO $$ 
DECLARE
  v_user_id uuid;
  v_has_profile boolean;
  v_profile_role text;
  v_auth_role text;
BEGIN
  -- Get admin420's user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'admin420@merchant.local user does not exist in auth.users';
    RETURN;
  END IF;

  -- Check profile existence and role
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = v_user_id
  ) INTO v_has_profile;

  IF v_has_profile THEN
    SELECT role INTO v_profile_role
    FROM user_profiles
    WHERE id = v_user_id;
  END IF;

  -- Get auth role
  SELECT role INTO v_auth_role
  FROM auth.users
  WHERE id = v_user_id;

  -- Output results
  RAISE NOTICE 'Admin420 Check Results:';
  RAISE NOTICE 'User ID: %', v_user_id;
  RAISE NOTICE 'Has Profile: %', v_has_profile;
  RAISE NOTICE 'Profile Role: %', v_profile_role;
  RAISE NOTICE 'Auth Role: %', v_auth_role;

  -- Fix if needed
  IF NOT v_has_profile OR v_profile_role != 'admin' THEN
    RAISE NOTICE 'Fixing admin420 profile...';
    
    INSERT INTO user_profiles (id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
    
    RAISE NOTICE 'Admin profile fixed.';
  END IF;
END $$; 