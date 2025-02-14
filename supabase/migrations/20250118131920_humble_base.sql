-- Function to verify authentication and authorization
CREATE OR REPLACE FUNCTION verify_auth_system()
RETURNS TABLE (
  check_name text,
  status boolean,
  details text
) AS $$
DECLARE
  v_merchant_id uuid;
  v_merchant_username text := 'testmerchant' || floor(random() * 1000000)::text;
  v_collection_id uuid;
BEGIN
  -- Start verification
  BEGIN
    -- Test 1: Create a merchant user
    check_name := 'Create merchant user';
    v_merchant_id := create_user_with_username(v_merchant_username, 'TestPass123!', 'merchant');
    status := v_merchant_id IS NOT NULL;
    details := 'Merchant created with ID: ' || v_merchant_id;
    RETURN NEXT;

    -- Test 2: Verify merchant role
    check_name := 'Verify merchant role';
    status := EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = v_merchant_id 
      AND role = 'merchant'
    );
    details := 'Merchant role correctly assigned';
    RETURN NEXT;

    -- Test 3: Create test collection
    check_name := 'Create test collection';
    INSERT INTO collections (
      id,
      name,
      description,
      launch_date,
      user_id,
      visible
    ) VALUES (
      gen_random_uuid(),
      'Test Collection',
      'Test Description',
      now(),
      v_merchant_id,
      true
    ) RETURNING id INTO v_collection_id;
    status := v_collection_id IS NOT NULL;
    details := 'Collection created with ID: ' || v_collection_id;
    RETURN NEXT;

    -- Test 4: Verify collection access
    check_name := 'Verify collection access';
    status := auth.get_collection_access(v_collection_id) = 'manage';
    details := 'Collection access level correct';
    RETURN NEXT;

    -- Test 5: Verify login credentials
    check_name := 'Verify login credentials';
    status := EXISTS (
      SELECT 1 FROM validate_user_credentials(
        v_merchant_username || '@merchant.local',
        'TestPass123!'
      )
    );
    details := 'Login credentials verified';
    RETURN NEXT;

    -- Cleanup
    DELETE FROM collections WHERE id = v_collection_id;
    DELETE FROM auth.users WHERE id = v_merchant_id;
    
    -- Final cleanup check
    check_name := 'Verify cleanup';
    status := NOT EXISTS (
      SELECT 1 FROM auth.users WHERE id = v_merchant_id
    );
    details := 'Test data successfully cleaned up';
    RETURN NEXT;

  EXCEPTION WHEN others THEN
    -- Return error details if any test fails
    status := false;
    details := 'Error: ' || SQLERRM;
    RETURN NEXT;
    
    -- Attempt cleanup on error
    BEGIN
      DELETE FROM collections WHERE id = v_collection_id;
      DELETE FROM auth.users WHERE id = v_merchant_id;
    EXCEPTION WHEN others THEN
      -- Ignore cleanup errors
      NULL;
    END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run verification
SELECT * FROM verify_auth_system();

-- Drop verification function after use
DROP FUNCTION verify_auth_system();