-- Add deleted_at column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

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

  -- First, delete any collection access entries
  DELETE FROM public.collection_access
  WHERE user_id = p_user_id;

  -- Delete any collections owned by the user
  DELETE FROM public.collections
  WHERE user_id = p_user_id;

  -- Soft delete the user profile
  UPDATE public.user_profiles
  SET 
    deleted_at = now(),
    role = 'deleted'  -- Optional: mark role as deleted
  WHERE id = p_user_id;

  -- Deactivate the auth.users account
  UPDATE auth.users
  SET 
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('deleted_at', extract(epoch from now())),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('deleted_at', extract(epoch from now())),
    email = id || '@deleted.merchant.local',  -- Prevent email reuse
    encrypted_password = NULL,  -- Prevent login
    email_confirmed_at = NULL,
    disabled = true
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Update list_users to exclude deleted users by default
CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz,
  collections_count bigint,
  access_count bigint,
  deleted_at timestamptz
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
    COUNT(DISTINCT ca.collection_id) as access_count,
    p.deleted_at
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  LEFT JOIN collection_access ca ON ca.user_id = u.id
  WHERE u.email != 'admin420@merchant.local'  -- Exclude admin420
  GROUP BY u.id, u.email, p.role, u.created_at, p.deleted_at
  ORDER BY 
    COALESCE(p.deleted_at, 'infinity'::timestamptz), -- Show active users first
    u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;

-- Add documentation
COMMENT ON FUNCTION delete_user(uuid) IS 'Soft deletes a user by marking them as deleted and deactivating their account. Deletes their collections and access but preserves audit history. Only admins can delete users, and admin420 cannot be deleted.';
COMMENT ON FUNCTION list_users() IS 'Lists all users including deleted ones (admin only). Results are ordered with active users first, then deleted users.'; 