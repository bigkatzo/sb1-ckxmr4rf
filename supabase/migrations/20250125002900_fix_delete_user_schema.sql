-- Drop existing delete_user function
DROP FUNCTION IF EXISTS public.delete_user(uuid) CASCADE;

-- Create improved delete_user function with proper schema qualification
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

  -- First, delete any collection access entries
  DELETE FROM public.collection_access
  WHERE user_id = p_user_id;

  -- Delete any collections owned by the user
  DELETE FROM public.collections
  WHERE user_id = p_user_id;

  -- Delete user profile
  DELETE FROM public.user_profiles
  WHERE id = p_user_id;

  -- Update audit logs to set user_id and target_user_id to NULL where they reference this user
  UPDATE public.audit_logs 
  SET user_id = NULL,
      target_user_id = NULL
  WHERE user_id = p_user_id OR target_user_id = p_user_id;

  -- Finally delete the user from auth.users
  DELETE FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION delete_user(uuid) IS 'Deletes a user and handles their audit log references by setting them to NULL. Also deletes related collection access and collections. Only admins can delete users, and admin420 cannot be deleted.'; 