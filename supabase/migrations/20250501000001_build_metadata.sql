-- Create build_metadata table for storing information needed during build process
CREATE TABLE IF NOT EXISTS build_metadata (
  id TEXT PRIMARY KEY,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for build_metadata
-- Only admin users can view and modify build metadata
ALTER TABLE build_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin to manage build metadata"
  ON build_metadata
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create a function to read build metadata during build process
CREATE OR REPLACE FUNCTION get_build_metadata(p_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_metadata JSONB;
BEGIN
  SELECT data INTO v_metadata
  FROM build_metadata
  WHERE id = p_id;
  
  RETURN v_metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 