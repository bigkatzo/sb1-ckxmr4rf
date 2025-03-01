-- First create a special system user for deleted user references
DO $$ 
BEGIN
  -- Create the system user if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'system@merchant.local'
  ) THEN
    INSERT INTO auth.users (
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      role,
      created_at,
      updated_at
    ) VALUES (
      'system@merchant.local',
      crypt('system', gen_salt('bf')),
      now(),
      '{"provider": "system", "providers": ["system"]}',
      '{"system": true}',
      'authenticated',
      now(),
      now()
    );

    -- Create system user profile
    INSERT INTO public.user_profiles (
      id,
      role,
      created_at,
      updated_at
    )
    SELECT 
      id,
      'system',
      now(),
      now()
    FROM auth.users 
    WHERE email = 'system@merchant.local';
  END IF;
END $$;

-- Drop existing delete_user function
DROP FUNCTION IF EXISTS public.delete_user(uuid) CASCADE;

-- Create improved delete_user function with proper audit log handling
CREATE OR REPLACE FUNCTION public.delete_user(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_system_user_id uuid;
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

  -- Get system user id
  SELECT id INTO v_system_user_id
  FROM auth.users
  WHERE email = 'system@merchant.local';

  IF v_system_user_id IS NULL THEN
    RAISE EXCEPTION 'System user not found';
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

  -- Update audit logs to reference system user instead of the deleted user
  UPDATE public.audit_logs 
  SET user_id = v_system_user_id
  WHERE user_id = p_user_id;

  UPDATE public.audit_logs 
  SET target_user_id = v_system_user_id
  WHERE target_user_id = p_user_id;

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
COMMENT ON FUNCTION delete_user(uuid) IS 'Deletes a user and reassigns their audit log entries to a system user. Also deletes related collection access and collections. Only admins can delete users, and admin420 cannot be deleted.'; 