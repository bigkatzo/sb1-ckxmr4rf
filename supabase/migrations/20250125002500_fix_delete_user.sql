-- Drop existing delete_user function
DROP FUNCTION IF EXISTS public.delete_user(uuid) CASCADE;

-- Create improved delete_user function that handles audit logs
CREATE OR REPLACE FUNCTION public.delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin using auth.is_admin()
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete users';
  END IF;

  -- Don't allow deleting admin420
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot delete admin user';
  END IF;

  -- Start a transaction to ensure all operations are atomic
  BEGIN
    -- First, update audit logs to set user_id and target_user_id to NULL where they reference this user
    UPDATE audit_logs 
    SET user_id = NULL
    WHERE user_id = p_user_id;

    UPDATE audit_logs 
    SET target_user_id = NULL
    WHERE target_user_id = p_user_id;

    -- Then delete the user from auth.users (will cascade to user_profiles)
    DELETE FROM auth.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'User not found';
    END IF;

    -- Commit the transaction
    COMMIT;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback the transaction on any error
      ROLLBACK;
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION delete_user(uuid) IS 'Deletes a user and handles their audit log references by setting them to NULL. Only admins can delete users, and admin420 cannot be deleted.'; 