-- Create helper functions for role management
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role user_role
)
RETURNS void AS $$
BEGIN
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admins can manage user roles';
  END IF;

  INSERT INTO user_permissions (user_id, role, assigned_by)
  VALUES (p_user_id, p_role, auth.uid())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = p_role,
    assigned_by = auth.uid(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION assign_collection_to_intern(
  p_collection_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  IF NOT auth.is_merchant() THEN
    RAISE EXCEPTION 'Only merchants can assign collections';
  END IF;

  -- Verify user is an intern
  IF NOT EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = p_user_id
    AND role = 'intern'::user_role
  ) THEN
    RAISE EXCEPTION 'User is not an intern';
  END IF;

  INSERT INTO collection_assignments (
    collection_id,
    user_id,
    assigned_by
  )
  VALUES (
    p_collection_id,
    p_user_id,
    auth.uid()
  )
  ON CONFLICT (collection_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;