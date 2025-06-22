-- Create notifications system for merchant dashboard
BEGIN;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order_created', 'category_created', 'product_created', 'user_access_granted', 'user_created', 'collection_created')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- For linking to relevant entities
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_collection_id ON notifications(collection_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create function to get users who should receive notifications for a collection
CREATE OR REPLACE FUNCTION get_collection_notification_recipients(p_collection_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, access_type TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    u.id as user_id,
    u.email,
    COALESCE(ca.access_type, 'owner') as access_type
  FROM auth.users u
  LEFT JOIN collection_access ca ON ca.user_id = u.id AND ca.collection_id = p_collection_id
  LEFT JOIN collections c ON c.id = p_collection_id AND c.user_id = u.id
  WHERE (
    -- Collection owner
    c.user_id = u.id
    OR
    -- Users with any access to the collection
    ca.collection_id = p_collection_id
    OR
    -- Admins get notifications for everything
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = u.id AND up.role = 'admin'
    )
  )
  AND u.email IS NOT NULL
  AND u.email != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create notification
CREATE OR REPLACE FUNCTION create_notification(
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
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    collection_id,
    category_id,
    product_id,
    order_id,
    target_user_id
  )
  VALUES (
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
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = TRUE, updated_at = NOW()
  WHERE user_id = auth.uid() AND read = FALSE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM notifications
  WHERE user_id = auth.uid() AND read = FALSE;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for order notifications
CREATE OR REPLACE FUNCTION notify_order_created()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  -- Get product and collection info
  SELECT p.name, c.name
  INTO v_product_name, v_collection_name
  FROM products p
  JOIN collections c ON c.id = p.collection_id
  WHERE p.id = NEW.product_id;
  
  -- Create notifications for all relevant users
  FOR v_recipient IN
    SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
  LOOP
    PERFORM create_notification(
      v_recipient.user_id,
      'order_created',
      'New Order Received',
      format('New order for "%s" in collection "%s"', v_product_name, v_collection_name),
      jsonb_build_object(
        'order_number', NEW.order_number,
        'product_name', v_product_name,
        'collection_name', v_collection_name,
        'amount_sol', NEW.amount_sol
      ),
      NEW.collection_id,
      NULL,
      NEW.product_id,
      NEW.id,
      NULL
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for category notifications
CREATE OR REPLACE FUNCTION notify_category_created()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  -- Get collection info
  SELECT name INTO v_collection_name
  FROM collections
  WHERE id = NEW.collection_id;
  
  -- Create notifications for all relevant users
  FOR v_recipient IN
    SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
  LOOP
    PERFORM create_notification(
      v_recipient.user_id,
      'category_created',
      'New Category Created',
      format('New category "%s" created in collection "%s"', NEW.name, v_collection_name),
      jsonb_build_object(
        'category_name', NEW.name,
        'collection_name', v_collection_name,
        'category_type', NEW.type
      ),
      NEW.collection_id,
      NEW.id,
      NULL,
      NULL,
      NULL
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for product notifications
CREATE OR REPLACE FUNCTION notify_product_created()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_category_name TEXT;
  v_recipient RECORD;
BEGIN
  -- Get collection and category info
  SELECT c.name, cat.name
  INTO v_collection_name, v_category_name
  FROM collections c
  LEFT JOIN categories cat ON cat.id = NEW.category_id
  WHERE c.id = NEW.collection_id;
  
  -- Create notifications for all relevant users
  FOR v_recipient IN
    SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
  LOOP
    PERFORM create_notification(
      v_recipient.user_id,
      'product_created',
      'New Product Created',
      format('New product "%s" created in collection "%s"', NEW.name, v_collection_name),
      jsonb_build_object(
        'product_name', NEW.name,
        'collection_name', v_collection_name,
        'category_name', v_category_name,
        'price', NEW.price
      ),
      NEW.collection_id,
      NEW.category_id,
      NEW.id,
      NULL,
      NULL
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for collection access notifications
CREATE OR REPLACE FUNCTION notify_user_access_granted()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_granted_user_email TEXT;
  v_recipient RECORD;
BEGIN
  -- Get collection and user info
  SELECT c.name, u.email
  INTO v_collection_name, v_granted_user_email
  FROM collections c, auth.users u
  WHERE c.id = NEW.collection_id AND u.id = NEW.user_id;
  
  -- Create notifications for all relevant users (except the user who got access)
  FOR v_recipient IN
    SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    WHERE user_id != NEW.user_id
  LOOP
    PERFORM create_notification(
      v_recipient.user_id,
      'user_access_granted',
      'User Access Granted',
      format('User "%s" was granted "%s" access to collection "%s"', v_granted_user_email, NEW.access_type, v_collection_name),
      jsonb_build_object(
        'granted_user_email', v_granted_user_email,
        'collection_name', v_collection_name,
        'access_type', NEW.access_type
      ),
      NEW.collection_id,
      NULL,
      NULL,
      NULL,
      NEW.user_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for new user notifications (admin only)
CREATE OR REPLACE FUNCTION notify_user_created()
RETURNS TRIGGER AS $$
DECLARE
  v_admin RECORD;
BEGIN
  -- Create notifications for all admins
  FOR v_admin IN
    SELECT u.id as user_id, u.email
    FROM auth.users u
    JOIN user_profiles up ON up.id = u.id
    WHERE up.role = 'admin'
  LOOP
    PERFORM create_notification(
      v_admin.user_id,
      'user_created',
      'New User Registered',
      format('New user "%s" has registered', NEW.email),
      jsonb_build_object(
        'new_user_email', NEW.email,
        'created_at', NEW.created_at
      ),
      NULL,
      NULL,
      NULL,
      NULL,
      NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for new collection notifications (admin only)
CREATE OR REPLACE FUNCTION notify_collection_created()
RETURNS TRIGGER AS $$
DECLARE
  v_admin RECORD;
  v_creator_email TEXT;
BEGIN
  -- Get creator email
  SELECT email INTO v_creator_email
  FROM auth.users
  WHERE id = NEW.user_id;
  
  -- Create notifications for all admins
  FOR v_admin IN
    SELECT u.id as user_id, u.email
    FROM auth.users u
    JOIN user_profiles up ON up.id = u.id
    WHERE up.role = 'admin'
  LOOP
    PERFORM create_notification(
      v_admin.user_id,
      'collection_created',
      'New Collection Created',
      format('New collection "%s" created by "%s"', NEW.name, v_creator_email),
      jsonb_build_object(
        'collection_name', NEW.name,
        'creator_email', v_creator_email,
        'collection_slug', NEW.slug
      ),
      NEW.id,
      NULL,
      NULL,
      NULL,
      NEW.user_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER orders_notification_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_created();

CREATE TRIGGER categories_notification_trigger
  AFTER INSERT ON categories
  FOR EACH ROW
  EXECUTE FUNCTION notify_category_created();

CREATE TRIGGER products_notification_trigger
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION notify_product_created();

CREATE TRIGGER collection_access_notification_trigger
  AFTER INSERT ON collection_access
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_access_granted();

CREATE TRIGGER users_notification_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_created();

CREATE TRIGGER collections_notification_trigger
  AFTER INSERT ON collections
  FOR EACH ROW
  EXECUTE FUNCTION notify_collection_created();

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_notification_recipients(UUID) TO authenticated;

COMMIT; 