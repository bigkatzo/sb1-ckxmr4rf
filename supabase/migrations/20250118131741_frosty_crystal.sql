-- Function to verify user system integrity
CREATE OR REPLACE FUNCTION verify_user_system()
RETURNS TABLE (
  check_name text,
  status boolean,
  details text
) AS $$
DECLARE
  v_test_user_id uuid;
  v_role text;
  v_username text := 'testuser' || floor(random() * 1000000)::text;
BEGIN
  -- Start verification
  BEGIN
    -- Test 1: Create a merchant user
    check_name := 'Create merchant user';
    v_test_user_id := create_user_with_username(v_username, 'TestPass123!', 'merchant');
    status := v_test_user_id IS NOT NULL;
    details := 'User created successfully with ID: ' || v_test_user_id;
    RETURN NEXT;

    -- Test 2: Verify user exists in auth.users
    check_name := 'Verify user in auth.users';
    status := EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = v_test_user_id 
      AND email = v_username || '@merchant.local'
    );
    details := 'User exists in auth.users table';
    RETURN NEXT;

    -- Test 3: Verify user profile exists
    check_name := 'Verify user profile';
    SELECT role INTO v_role 
    FROM user_profiles 
    WHERE id = v_test_user_id;
    status := v_role = 'merchant';
    details := 'User profile exists with role: ' || v_role;
    RETURN NEXT;

    -- Test 4: Verify metadata
    check_name := 'Verify user metadata';
    status := EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = v_test_user_id
      AND raw_app_meta_data->>'role' = 'merchant'
      AND raw_user_meta_data->>'role' = 'merchant'
    );
    details := 'User metadata contains correct role';
    RETURN NEXT;

    -- Cleanup test user
    DELETE FROM auth.users WHERE id = v_test_user_id;
    
    -- Final check to ensure cleanup worked
    check_name := 'Verify cleanup';
    status := NOT EXISTS (
      SELECT 1 FROM auth.users WHERE id = v_test_user_id
    );
    details := 'Test user successfully cleaned up';
    RETURN NEXT;

  EXCEPTION WHEN others THEN
    -- Return error details if any test fails
    status := false;
    details := 'Error: ' || SQLERRM;
    RETURN NEXT;
    
    -- Attempt cleanup on error
    BEGIN
      DELETE FROM auth.users WHERE id = v_test_user_id;
    EXCEPTION WHEN others THEN
      -- Ignore cleanup errors
      NULL;
    END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run verification
SELECT * FROM verify_user_system();

-- Drop verification function after use
DROP FUNCTION verify_user_system();