-- Start transaction
BEGIN;

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS collection_access_audit ON collection_access;

-- Update the audit logging function to handle missing request headers
CREATE OR REPLACE FUNCTION log_collection_access_change()
RETURNS trigger AS $$
BEGIN
  INSERT INTO audit_logs (
    action_type,
    entity_type,
    entity_id,
    user_id,
    target_user_id,
    old_value,
    new_value,
    ip_address,
    user_agent
  ) VALUES (
    CASE
      WHEN TG_OP = 'INSERT' THEN 'grant_access'
      WHEN TG_OP = 'UPDATE' THEN 'update_access'
      WHEN TG_OP = 'DELETE' THEN 'revoke_access'
    END,
    'collection',
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.collection_id
      ELSE NEW.collection_id
    END,
    auth.uid(),
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.user_id
      ELSE NEW.user_id
    END,
    CASE
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('access_type', OLD.access_type)
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('access_type', OLD.access_type)
      ELSE NULL
    END,
    CASE
      WHEN TG_OP = 'DELETE' THEN NULL
      ELSE jsonb_build_object('access_type', NEW.access_type)
    END,
    NULLIF(COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      current_setting('request.jwt.claims', true)::json->>'ip_address'
    ), ''),
    NULLIF(current_setting('request.headers', true)::json->>'user-agent', '')
  );
  
  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER collection_access_audit
  AFTER INSERT OR UPDATE OR DELETE ON collection_access
  FOR EACH ROW
  EXECUTE FUNCTION log_collection_access_change();

COMMIT; 