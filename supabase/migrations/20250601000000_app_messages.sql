-- Create app_messages table
CREATE TABLE IF NOT EXISTS app_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('marquee', 'popup')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  content TEXT NOT NULL,
  
  -- Specific fields for marquees
  marquee_speed TEXT DEFAULT 'medium' CHECK (
    marquee_speed IS NULL OR 
    marquee_speed IN ('slow', 'medium', 'fast')
  ),
  marquee_link TEXT,
  
  -- Specific fields for popups
  header_image_url TEXT,
  cta_text TEXT,
  cta_link TEXT,
  
  -- Common fields
  display_start TIMESTAMP WITH TIME ZONE,
  display_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies for app_messages
ALTER TABLE app_messages ENABLE ROW LEVEL SECURITY;

-- Allow admin users to manage all messages
CREATE POLICY "Allow admins to manage app messages"
  ON app_messages
  FOR ALL
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Allow all users to read active messages
CREATE POLICY "Allow all users to read active messages"
  ON app_messages
  FOR SELECT
  TO public
  USING (
    is_active = true AND
    (display_start IS NULL OR display_start <= NOW()) AND
    (display_end IS NULL OR display_end >= NOW())
  );

-- Function to get active messages
CREATE OR REPLACE FUNCTION get_active_app_messages()
RETURNS TABLE (
  id UUID,
  type TEXT,
  content TEXT,
  marquee_speed TEXT,
  marquee_link TEXT,
  header_image_url TEXT,
  cta_text TEXT,
  cta_link TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.type,
    m.content,
    m.marquee_speed,
    m.marquee_link,
    m.header_image_url,
    m.cta_text,
    m.cta_link
  FROM 
    app_messages m
  WHERE 
    m.is_active = true AND
    (m.display_start IS NULL OR m.display_start <= NOW()) AND
    (m.display_end IS NULL OR m.display_end >= NOW())
  ORDER BY
    m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 