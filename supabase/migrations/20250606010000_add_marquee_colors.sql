-- Add background_color and text_color columns to app_messages table
ALTER TABLE app_messages 
  ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT NULL;

-- Drop the existing function first to avoid return type errors
DROP FUNCTION IF EXISTS get_active_app_messages();

-- Create the updated function with the new columns
CREATE OR REPLACE FUNCTION get_active_app_messages()
RETURNS TABLE (
  id UUID,
  type TEXT,
  content TEXT,
  marquee_speed TEXT,
  marquee_link TEXT,
  background_color TEXT,
  text_color TEXT,
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
    m.background_color,
    m.text_color,
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