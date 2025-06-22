-- Add notification preferences system
BEGIN;

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- In-app notification preferences
  order_created_app BOOLEAN DEFAULT TRUE,
  category_created_app BOOLEAN DEFAULT TRUE,
  product_created_app BOOLEAN DEFAULT TRUE,
  user_access_granted_app BOOLEAN DEFAULT TRUE,
  user_created_app BOOLEAN DEFAULT TRUE,
  collection_created_app BOOLEAN DEFAULT TRUE,
  
  -- Email notification preferences
  order_created_email BOOLEAN DEFAULT TRUE,
  category_created_email BOOLEAN DEFAULT TRUE,
  product_created_email BOOLEAN DEFAULT TRUE,
  user_access_granted_email BOOLEAN DEFAULT TRUE,
  user_created_email BOOLEAN DEFAULT TRUE,
  collection_created_email BOOLEAN DEFAULT TRUE,
  
  -- Master switches
  all_app_notifications BOOLEAN DEFAULT TRUE,
  all_email_notifications BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint on user_id
ALTER TABLE notification_preferences ADD CONSTRAINT unique_user_preferences UNIQUE (user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see and edit their own preferences
CREATE POLICY "Users can view their own notification preferences"
ON notification_preferences
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notification preferences"
ON notification_preferences
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own notification preferences"
ON notification_preferences
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Function to get or create user preferences
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS notification_preferences AS $$
DECLARE
  v_preferences notification_preferences;
BEGIN
  -- Try to get existing preferences
  SELECT * INTO v_preferences
  FROM notification_preferences
  WHERE user_id = p_user_id;
  
  -- If not found, create default preferences
  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_preferences;
  END IF;
  
  RETURN v_preferences;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user preferences  
CREATE OR REPLACE FUNCTION update_user_notification_preferences(
  p_user_id UUID,
  p_order_created_app BOOLEAN DEFAULT NULL,
  p_category_created_app BOOLEAN DEFAULT NULL,
  p_product_created_app BOOLEAN DEFAULT NULL,
  p_user_access_granted_app BOOLEAN DEFAULT NULL,
  p_user_created_app BOOLEAN DEFAULT NULL,
  p_collection_created_app BOOLEAN DEFAULT NULL,
  p_order_created_email BOOLEAN DEFAULT NULL,
  p_category_created_email BOOLEAN DEFAULT NULL,
  p_product_created_email BOOLEAN DEFAULT NULL,
  p_user_access_granted_email BOOLEAN DEFAULT NULL,
  p_user_created_email BOOLEAN DEFAULT NULL,
  p_collection_created_email BOOLEAN DEFAULT NULL,
  p_all_app_notifications BOOLEAN DEFAULT NULL,
  p_all_email_notifications BOOLEAN DEFAULT NULL
)
RETURNS notification_preferences AS $$
DECLARE
  v_preferences notification_preferences;
BEGIN
  -- Ensure preferences exist
  PERFORM get_user_notification_preferences(p_user_id);
  
  -- Update preferences
  UPDATE notification_preferences
  SET 
    order_created_app = COALESCE(p_order_created_app, order_created_app),
    category_created_app = COALESCE(p_category_created_app, category_created_app),
    product_created_app = COALESCE(p_product_created_app, product_created_app),
    user_access_granted_app = COALESCE(p_user_access_granted_app, user_access_granted_app),
    user_created_app = COALESCE(p_user_created_app, user_created_app),
    collection_created_app = COALESCE(p_collection_created_app, collection_created_app),
    
    order_created_email = COALESCE(p_order_created_email, order_created_email),
    category_created_email = COALESCE(p_category_created_email, category_created_email),
    product_created_email = COALESCE(p_product_created_email, product_created_email),
    user_access_granted_email = COALESCE(p_user_access_granted_email, user_access_granted_email),
    user_created_email = COALESCE(p_user_created_email, user_created_email),
    collection_created_email = COALESCE(p_collection_created_email, collection_created_email),
    
    all_app_notifications = COALESCE(p_all_app_notifications, all_app_notifications),
    all_email_notifications = COALESCE(p_all_email_notifications, all_email_notifications),
    
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING * INTO v_preferences;
  
  RETURN v_preferences;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user should receive a notification
CREATE OR REPLACE FUNCTION should_send_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_channel TEXT -- 'app' or 'email'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_preferences notification_preferences;
  v_should_send BOOLEAN := TRUE;
  v_column_name TEXT;
BEGIN
  -- Get user preferences
  v_preferences := get_user_notification_preferences(p_user_id);
  
  -- Check master switch first
  IF p_channel = 'app' AND NOT v_preferences.all_app_notifications THEN
    RETURN FALSE;
  END IF;
  
  IF p_channel = 'email' AND NOT v_preferences.all_email_notifications THEN
    RETURN FALSE;
  END IF;
  
  -- Build column name
  v_column_name := p_notification_type || '_' || p_channel;
  
  -- Check specific preference
  CASE v_column_name
    WHEN 'order_created_app' THEN v_should_send := v_preferences.order_created_app;
    WHEN 'order_created_email' THEN v_should_send := v_preferences.order_created_email;
    WHEN 'category_created_app' THEN v_should_send := v_preferences.category_created_app;
    WHEN 'category_created_email' THEN v_should_send := v_preferences.category_created_email;
    WHEN 'product_created_app' THEN v_should_send := v_preferences.product_created_app;
    WHEN 'product_created_email' THEN v_should_send := v_preferences.product_created_email;
    WHEN 'user_access_granted_app' THEN v_should_send := v_preferences.user_access_granted_app;
    WHEN 'user_access_granted_email' THEN v_should_send := v_preferences.user_access_granted_email;
    WHEN 'user_created_app' THEN v_should_send := v_preferences.user_created_app;
    WHEN 'user_created_email' THEN v_should_send := v_preferences.user_created_email;
    WHEN 'collection_created_app' THEN v_should_send := v_preferences.collection_created_app;
    WHEN 'collection_created_email' THEN v_should_send := v_preferences.collection_created_email;
    ELSE v_should_send := TRUE; -- Default to true for unknown types
  END CASE;
  
  RETURN v_should_send;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the notification creation function to respect preferences
CREATE OR REPLACE FUNCTION create_notification_with_preferences(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_collection_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_user_email TEXT;
  v_should_send_app BOOLEAN;
  v_should_send_email BOOLEAN;
BEGIN
  -- Check if user wants app notifications
  v_should_send_app := should_send_notification(p_user_id, p_type, 'app');
  
  -- Check if user wants email notifications
  v_should_send_email := should_send_notification(p_user_id, p_type, 'email');
  
  -- Create app notification if user wants it
  IF v_should_send_app THEN
    SELECT create_notification(
      p_user_id,
      p_type,
      p_title,
      p_message,
      p_data,
      p_collection_id,
      p_category_id,
      p_product_id,
      p_order_id,
      p_target_user_id
    ) INTO v_notification_id;
  END IF;
  
  -- Send email notification if user wants it
  IF v_should_send_email THEN
    -- Get user email
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = p_user_id;
    
    -- Send email notification if user has email
    IF v_user_email IS NOT NULL AND v_user_email != '' THEN
      -- Use HTTP request to call edge function for email sending
      -- This is handled asynchronously to avoid blocking the notification creation
      PERFORM pg_notify('send_email', jsonb_build_object(
        'to', v_user_email,
        'type', p_type,
        'data', p_data
      )::text);
      
      -- Mark email as sent if we created a notification
      IF v_notification_id IS NOT NULL THEN
        UPDATE notifications
        SET email_sent = TRUE
        WHERE id = v_notification_id;
      END IF;
    END IF;
  END IF;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notification_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_notification_preferences(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION should_send_notification(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID) TO authenticated;

COMMIT; 