-- Create audit_logs table
CREATE TABLE audit_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid REFERENCES auth.users(id),
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Add indexes for better query performance
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for audit logs
CREATE POLICY "Audit logs are viewable by admins only"
  ON audit_logs
  FOR ALL
  TO authenticated
  USING (
    (SELECT is_admin())
  );

-- Create function to log collection access changes
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
    current_setting('request.headers')::json->>'x-forwarded-for',
    current_setting('request.headers')::json->>'user-agent'
  );
  
  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for collection_access changes
CREATE TRIGGER collection_access_audit
  AFTER INSERT OR UPDATE OR DELETE ON collection_access
  FOR EACH ROW
  EXECUTE FUNCTION log_collection_access_change();

-- Grant access to authenticated users
GRANT SELECT ON audit_logs TO authenticated;

-- Add documentation
COMMENT ON TABLE audit_logs IS 'Audit logs for tracking important changes in the system';
COMMENT ON FUNCTION log_collection_access_change() IS 'Function to automatically log collection access changes'; 