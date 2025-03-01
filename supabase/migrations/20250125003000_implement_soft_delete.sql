-- Add is_deleted column to auth.users if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN is_deleted boolean DEFAULT false;
    CREATE INDEX idx_users_is_deleted ON auth.users(is_deleted) WHERE is_deleted = true;
  END IF;
END $$;

-- Drop existing delete_user function
DROP FUNCTION IF EXISTS public.delete_user(uuid) CASCADE;

-- Create improved delete_user function with soft delete
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

  -- Check if user exists and is not already deleted
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id AND NOT is_deleted
  ) THEN
    RAISE EXCEPTION 'User not found or already deleted';
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

  -- Soft delete the user by marking them as deleted
  UPDATE auth.users
  SET 
    is_deleted = true,
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('deleted_at', extract(epoch from now())),
    updated_at = now()
  WHERE id = p_user_id;

  -- Also disable their account
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('disabled', true)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Create function to list users that excludes deleted users
CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz,
  collections_count bigint,
  access_count bigint
) AS $$
BEGIN
  -- Verify caller is admin using auth.is_admin()
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    COALESCE(p.role, 'user')::text as role,
    u.created_at,
    COUNT(DISTINCT c.id) as collections_count,
    COUNT(DISTINCT ca.collection_id) as access_count
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  LEFT JOIN collection_access ca ON ca.user_id = u.id
  WHERE u.email != 'admin420@merchant.local'  -- Exclude admin420
    AND (NOT u.is_deleted)  -- Exclude deleted users
  GROUP BY u.id, u.email, p.role, u.created_at
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;

-- Add documentation
COMMENT ON FUNCTION delete_user(uuid) IS 'Soft deletes a user by marking them as deleted and cleaning up their collections and access. Only admins can delete users, and admin420 cannot be deleted.';
COMMENT ON FUNCTION list_users() IS 'Lists all non-deleted users with their roles and related counts. Only admins can list users, and admin420 is excluded from results.'; 