-- Enhanced notification system for merchant dashboard
-- CRITICAL: All functions must handle errors gracefully and never block core operations
BEGIN;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    -- Categories
    'category_created', 'category_edited', 'category_deleted',
    -- Products  
    'product_created', 'product_edited', 'product_deleted',
    -- Collections
    'collection_created', 'collection_edited', 'collection_deleted',
    -- User Access
    'user_access_granted', 'user_access_removed',
    -- Users
    'user_created',
    -- Orders
    'order_created', 'order_status_changed', 'tracking_added', 'tracking_removed',
    -- Reviews
    'review_added', 'review_updated'
  )),
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
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id UUID -- Will add foreign key constraint later if product_reviews table exists
);

-- Add foreign key constraint for review_id conditionally
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_reviews') THEN
    -- Check if constraint already exists before adding it
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_notifications_review_id' 
      AND table_name = 'notifications'
    ) THEN
      ALTER TABLE notifications 
      ADD CONSTRAINT fk_notifications_review_id 
      FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_collection_id ON notifications(collection_id);
CREATE INDEX IF NOT EXISTS idx_notifications_review_id ON notifications(review_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

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

-- RLS Policy: System can create notifications (for anonymous orders/reviews)
CREATE POLICY "System can create notifications"
ON notifications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create function to get users who should receive notifications for a collection
-- FIXED: Use proper column types to match database schema
CREATE OR REPLACE FUNCTION get_collection_notification_recipients(p_collection_id UUID)
RETURNS TABLE (user_id UUID, email VARCHAR(255), access_type VARCHAR(50)) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    u.id as user_id,
    u.email::VARCHAR(255),
    COALESCE(ca.access_type::VARCHAR(50), 'owner'::VARCHAR(50)) as access_type
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
EXCEPTION
  WHEN OTHERS THEN
    -- CRITICAL: Never let notification queries fail
    RAISE NOTICE 'Error in get_collection_notification_recipients: %', SQLERRM;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create notification
-- CRITICAL: Consistent signature with all parameters including review_id
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
  p_target_user_id UUID DEFAULT NULL,
  p_review_id UUID DEFAULT NULL
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
    target_user_id,
    review_id
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
    p_target_user_id,
    p_review_id
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

-- ===============================================
-- CREATE TRIGGER FUNCTIONS WITH SAFETY
-- CRITICAL: All functions must have complete error handling
-- ===============================================

-- ORDER TRIGGERS
CREATE OR REPLACE FUNCTION notify_order_created()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT p.name, c.name
    INTO v_product_name, v_collection_name
    FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'order_created',
          'New Order Received',
          format('New order for "%s" in collection "%s"', v_product_name, v_collection_name),
          jsonb_build_object(
            'order_number', NEW.order_number,
            'product_name', v_product_name,
            'collection_name', v_collection_name,
            'amount_sol', NEW.amount_sol,
            'customer_email', NEW.customer_email,
            'is_anonymous', CASE WHEN NEW.user_id IS NULL THEN true ELSE false END
          ),
          NEW.collection_id,
          NULL,
          NEW.product_id,
          NEW.id,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create order notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Order notification failed for order %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_order_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  BEGIN
    SELECT p.name, c.name
    INTO v_product_name, v_collection_name
    FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'order_status_changed',
          'Order Status Updated',
          format('Order status changed from "%s" to "%s" for "%s"', OLD.status, NEW.status, v_product_name),
          jsonb_build_object(
            'order_number', NEW.order_number,
            'product_name', v_product_name,
            'collection_name', v_collection_name,
            'old_status', OLD.status,
            'new_status', NEW.status
          ),
          NEW.collection_id,
          NULL,
          NEW.product_id,
          NEW.id,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create order status notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Order status notification failed for order %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_tracking_added()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_order_number TEXT;
  v_collection_id UUID;
  v_recipient RECORD;
BEGIN
  -- This function is for order_tracking table inserts
  BEGIN
    -- Get order details from the related order
    SELECT p.name, c.name, o.order_number, o.collection_id
    INTO v_product_name, v_collection_name, v_order_number, v_collection_id
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE o.id = NEW.order_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(v_collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'tracking_added',
          'Tracking Number Added',
          format('Tracking number added for order "%s"', v_order_number),
          jsonb_build_object(
            'order_number', v_order_number,
            'product_name', v_product_name,
            'collection_name', v_collection_name,
            'tracking_number', NEW.tracking_number,
            'carrier', NEW.carrier
          ),
          v_collection_id,
          NULL,
          (SELECT product_id FROM orders WHERE id = NEW.order_id),
          NEW.order_id,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create tracking added notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Tracking added notification failed for order_tracking %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_tracking_removed()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_order_number TEXT;
  v_collection_id UUID;
  v_recipient RECORD;
BEGIN
  -- This function is for order_tracking table deletions
  BEGIN
    -- Get order details from the related order
    SELECT p.name, c.name, o.order_number, o.collection_id
    INTO v_product_name, v_collection_name, v_order_number, v_collection_id
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE o.id = OLD.order_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(v_collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'tracking_removed',
          'Tracking Number Removed',
          format('Tracking number removed for order "%s"', v_order_number),
          jsonb_build_object(
            'order_number', v_order_number,
            'product_name', v_product_name,
            'collection_name', v_collection_name,
            'old_tracking_number', OLD.tracking_number,
            'carrier', OLD.carrier
          ),
          v_collection_id,
          NULL,
          (SELECT product_id FROM orders WHERE id = OLD.order_id),
          OLD.order_id,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create tracking removed notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Tracking removed notification failed for order_tracking %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CATEGORY TRIGGERS
CREATE OR REPLACE FUNCTION notify_category_created()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = NEW.collection_id;
    
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'category_created',
          'New Category Created',
          format('New category "%s" created in collection "%s" by %s', NEW.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'category_name', NEW.name,
            'collection_name', v_collection_name,
            'category_type', NEW.type,
            'actor_email', v_actor_email
          ),
          NEW.collection_id,
          NEW.id,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create category notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Category notification failed for category %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_category_edited()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = NEW.collection_id;
    
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'category_edited',
          'Category Updated',
          format('Category "%s" was updated in collection "%s" by %s', NEW.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'category_name', NEW.name,
            'collection_name', v_collection_name,
            'category_type', NEW.type,
            'old_name', OLD.name,
            'actor_email', v_actor_email
          ),
          NEW.collection_id,
          NEW.id,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create category edit notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Category edit notification failed for category %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_category_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT name INTO v_collection_name
    FROM collections
    WHERE id = OLD.collection_id;
    
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(OLD.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'category_deleted',
          'Category Deleted',
          format('Category "%s" was deleted from collection "%s" by %s', OLD.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'category_name', OLD.name,
            'collection_name', v_collection_name,
            'category_type', OLD.type,
            'actor_email', v_actor_email
          ),
          OLD.collection_id,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create category delete notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Category delete notification failed for category %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PRODUCT TRIGGERS
CREATE OR REPLACE FUNCTION notify_product_created()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_category_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, cat.name
    INTO v_collection_name, v_category_name
    FROM collections c
    LEFT JOIN categories cat ON cat.id = NEW.category_id
    WHERE c.id = NEW.collection_id;
    
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'product_created',
          'New Product Created',
          format('New product "%s" created in collection "%s" by %s', NEW.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'product_name', NEW.name,
            'collection_name', v_collection_name,
            'category_name', v_category_name,
            'price', NEW.price,
            'actor_email', v_actor_email
          ),
          NEW.collection_id,
          NEW.category_id,
          NEW.id,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create product notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Product notification failed for product %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_product_edited()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_category_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, cat.name
    INTO v_collection_name, v_category_name
    FROM collections c
    LEFT JOIN categories cat ON cat.id = NEW.category_id
    WHERE c.id = NEW.collection_id;
    
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'product_edited',
          'Product Updated',
          format('Product "%s" was updated in collection "%s" by %s', NEW.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'product_name', NEW.name,
            'collection_name', v_collection_name,
            'category_name', v_category_name,
            'price', NEW.price,
            'old_name', OLD.name,
            'old_price', OLD.price,
            'actor_email', v_actor_email
          ),
          NEW.collection_id,
          NEW.category_id,
          NEW.id,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create product edit notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Product edit notification failed for product %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_product_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_category_name TEXT;
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, cat.name
    INTO v_collection_name, v_category_name
    FROM collections c
    LEFT JOIN categories cat ON cat.id = OLD.category_id
    WHERE c.id = OLD.collection_id;
    
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(OLD.collection_id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'product_deleted',
          'Product Deleted',
          format('Product "%s" was deleted from collection "%s" by %s', OLD.name, v_collection_name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'product_name', OLD.name,
            'collection_name', v_collection_name,
            'category_name', v_category_name,
            'price', OLD.price,
            'actor_email', v_actor_email
          ),
          OLD.collection_id,
          OLD.category_id,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create product delete notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Product delete notification failed for product %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COLLECTION TRIGGERS
CREATE OR REPLACE FUNCTION notify_collection_created()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'collection_created',
          'New Collection Created',
          format('New collection "%s" was created by %s', NEW.name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'collection_name', NEW.name,
            'collection_description', NEW.description,
            'actor_email', v_actor_email
          ),
          NEW.id,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create collection notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Collection notification failed for collection %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_collection_edited()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'collection_edited',
          'Collection Updated',
          format('Collection "%s" was updated by %s', NEW.name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'collection_name', NEW.name,
            'collection_description', NEW.description,
            'old_name', OLD.name,
            'old_description', OLD.description,
            'actor_email', v_actor_email
          ),
          NEW.id,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create collection edit notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Collection edit notification failed for collection %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_collection_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    -- Get the email of the person who performed the action
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = auth.uid();
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(OLD.id)
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'collection_deleted',
          'Collection Deleted',
          format('Collection "%s" was deleted by %s', OLD.name, COALESCE(v_actor_email, 'System')),
          jsonb_build_object(
            'collection_name', OLD.name,
            'collection_description', OLD.description,
            'actor_email', v_actor_email
          ),
          OLD.id,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create collection delete notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Collection delete notification failed for collection %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USER ACCESS TRIGGERS
CREATE OR REPLACE FUNCTION notify_user_access_granted()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_granted_user_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, u.email
    INTO v_collection_name, v_granted_user_email
    FROM collections c, auth.users u
    WHERE c.id = NEW.collection_id AND u.id = NEW.user_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(NEW.collection_id)
      WHERE user_id != NEW.user_id
    LOOP
      BEGIN
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
          NEW.user_id,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create access granted notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Access granted notification failed: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_user_access_removed()
RETURNS TRIGGER AS $$
DECLARE
  v_collection_name TEXT;
  v_removed_user_email TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT c.name, u.email
    INTO v_collection_name, v_removed_user_email
    FROM collections c, auth.users u
    WHERE c.id = OLD.collection_id AND u.id = OLD.user_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(OLD.collection_id)
      WHERE user_id != OLD.user_id
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'user_access_removed',
          'User Access Removed',
          format('User "%s" access was removed from collection "%s"', v_removed_user_email, v_collection_name),
          jsonb_build_object(
            'removed_user_email', v_removed_user_email,
            'collection_name', v_collection_name,
            'access_type', OLD.access_type
          ),
          OLD.collection_id,
          NULL,
          NULL,
          NULL,
          OLD.user_id,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create access removed notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Access removed notification failed: %', SQLERRM;
  END;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USER TRIGGERS
CREATE OR REPLACE FUNCTION notify_user_created()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient RECORD;
  v_user_email TEXT;
BEGIN
  BEGIN
    -- Get the user's email from auth.users
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = NEW.id;
    
    -- Notify all admins about new user profile creation
    FOR v_recipient IN
      SELECT u.id as user_id, u.email, 'admin' as access_type
      FROM auth.users u
      JOIN user_profiles up ON up.id = u.id
      WHERE up.role = 'admin'
      AND u.id != NEW.id
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'user_created',
          'New User Profile Created',
          format('New user profile created for "%s" with role "%s"', COALESCE(v_user_email, 'unknown'), NEW.role),
          jsonb_build_object(
            'user_email', v_user_email,
            'user_id', NEW.id,
            'role', NEW.role,
            'full_name', NEW.full_name
          ),
          NULL,
          NULL,
          NULL,
          NULL,
          NEW.id,
          NULL
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create user creation notification for admin %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'User profile creation notification failed for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REVIEW TRIGGERS
CREATE OR REPLACE FUNCTION notify_review_added()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT p.name, c.name
    INTO v_product_name, v_collection_name
    FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(
        (SELECT collection_id FROM products WHERE id = NEW.product_id)
      )
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'review_added',
          'New Review Added',
          format('New review added for "%s" by wallet %s', v_product_name, COALESCE(LEFT(NEW.wallet_address, 8) || '...', 'anonymous')),
          jsonb_build_object(
            'product_name', v_product_name,
            'collection_name', v_collection_name,
            'wallet_address', NEW.wallet_address,
            'rating', NEW.product_rating,
            'review_text', LEFT(NEW.review_text, 100),
            'is_verified_purchase', NEW.is_verified_purchase
          ),
          (SELECT collection_id FROM products WHERE id = NEW.product_id),
          NULL,
          NEW.product_id,
          NEW.order_id,
          NULL,
          NEW.id
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create review added notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Review added notification failed for review %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_review_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_product_name TEXT;
  v_collection_name TEXT;
  v_recipient RECORD;
BEGIN
  BEGIN
    SELECT p.name, c.name
    INTO v_product_name, v_collection_name
    FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
    
    FOR v_recipient IN
      SELECT * FROM get_collection_notification_recipients(
        (SELECT collection_id FROM products WHERE id = NEW.product_id)
      )
    LOOP
      BEGIN
        PERFORM create_notification(
          v_recipient.user_id,
          'review_updated',
          'Review Updated',
          format('Review updated for "%s" by wallet %s', v_product_name, COALESCE(LEFT(NEW.wallet_address, 8) || '...', 'anonymous')),
          jsonb_build_object(
            'product_name', v_product_name,
            'collection_name', v_collection_name,
            'wallet_address', NEW.wallet_address,
            'old_rating', OLD.product_rating,
            'new_rating', NEW.product_rating,
            'review_text', LEFT(NEW.review_text, 100),
            'is_verified_purchase', NEW.is_verified_purchase
          ),
          (SELECT collection_id FROM products WHERE id = NEW.product_id),
          NULL,
          NEW.product_id,
          NEW.order_id,
          NULL,
          NEW.id
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create review updated notification for user %: %', v_recipient.user_id, SQLERRM;
      END;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Review updated notification failed for review %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- ===============================================
-- CREATE ALL TRIGGERS WITH PROPER NAMES
-- CRITICAL: Complete CRUD trigger coverage
-- ===============================================

-- Drop any existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS orders_notification_trigger ON orders;
DROP TRIGGER IF EXISTS categories_notification_trigger ON categories;
DROP TRIGGER IF EXISTS products_notification_trigger ON products;
DROP TRIGGER IF EXISTS collection_access_notification_trigger ON collection_access;
-- Note: Cannot drop triggers on auth.users (system table)
DROP TRIGGER IF EXISTS collections_notification_trigger ON collections;

-- Drop all specific triggers that we're about to create
DROP TRIGGER IF EXISTS categories_insert_trigger ON categories;
DROP TRIGGER IF EXISTS categories_update_trigger ON categories;
DROP TRIGGER IF EXISTS categories_delete_trigger ON categories;
DROP TRIGGER IF EXISTS products_insert_trigger ON products;
DROP TRIGGER IF EXISTS products_update_trigger ON products;
DROP TRIGGER IF EXISTS products_delete_trigger ON products;
DROP TRIGGER IF EXISTS collections_insert_trigger ON collections;
DROP TRIGGER IF EXISTS collections_update_trigger ON collections;
DROP TRIGGER IF EXISTS collections_delete_trigger ON collections;
DROP TRIGGER IF EXISTS collection_access_insert_trigger ON collection_access;
DROP TRIGGER IF EXISTS collection_access_delete_trigger ON collection_access;
DROP TRIGGER IF EXISTS orders_insert_trigger ON orders;
DROP TRIGGER IF EXISTS orders_status_update_trigger ON orders;
DROP TRIGGER IF EXISTS user_profiles_insert_trigger ON user_profiles;

-- Category triggers (INSERT, UPDATE, DELETE)
CREATE TRIGGER categories_insert_trigger
  AFTER INSERT ON categories
  FOR EACH ROW
  EXECUTE FUNCTION notify_category_created();

CREATE TRIGGER categories_update_trigger
  AFTER UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION notify_category_edited();

CREATE TRIGGER categories_delete_trigger
  AFTER DELETE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION notify_category_deleted();

-- Product triggers (INSERT, UPDATE, DELETE)
CREATE TRIGGER products_insert_trigger
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION notify_product_created();

CREATE TRIGGER products_update_trigger
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION notify_product_edited();

CREATE TRIGGER products_delete_trigger
  AFTER DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION notify_product_deleted();

-- Collection triggers (INSERT, UPDATE, DELETE)
CREATE TRIGGER collections_insert_trigger
  AFTER INSERT ON collections
  FOR EACH ROW
  EXECUTE FUNCTION notify_collection_created();

CREATE TRIGGER collections_update_trigger
  AFTER UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION notify_collection_edited();

CREATE TRIGGER collections_delete_trigger
  AFTER DELETE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION notify_collection_deleted();

-- Collection access triggers (INSERT, DELETE)
CREATE TRIGGER collection_access_insert_trigger
  AFTER INSERT ON collection_access
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_access_granted();

CREATE TRIGGER collection_access_delete_trigger
  AFTER DELETE ON collection_access
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_access_removed();

-- Order triggers (INSERT, UPDATE for status/tracking)
CREATE TRIGGER orders_insert_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_created();

CREATE TRIGGER orders_status_update_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_changed();

-- Tracking triggers for order_tracking table (INSERT, DELETE) - conditionally create if table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'order_tracking') THEN
    -- Drop existing tracking triggers first
    EXECUTE 'DROP TRIGGER IF EXISTS order_tracking_insert_trigger ON order_tracking';
    EXECUTE 'DROP TRIGGER IF EXISTS order_tracking_delete_trigger ON order_tracking';
    
    -- Create fresh tracking triggers
    EXECUTE 'CREATE TRIGGER order_tracking_insert_trigger
      AFTER INSERT ON order_tracking
      FOR EACH ROW
      EXECUTE FUNCTION notify_tracking_added()';
      
    EXECUTE 'CREATE TRIGGER order_tracking_delete_trigger
      AFTER DELETE ON order_tracking
      FOR EACH ROW
      EXECUTE FUNCTION notify_tracking_removed()';
  END IF;
END $$;

-- User profile creation trigger (when users become active in the system)
CREATE TRIGGER user_profiles_insert_trigger
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_created();

-- Review triggers (INSERT, UPDATE) - conditionally create if product_reviews table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_reviews') THEN
    -- Drop existing review triggers first
    EXECUTE 'DROP TRIGGER IF EXISTS product_reviews_insert_trigger ON product_reviews';
    EXECUTE 'DROP TRIGGER IF EXISTS product_reviews_update_trigger ON product_reviews';
    EXECUTE 'DROP TRIGGER IF EXISTS product_reviews_delete_trigger ON product_reviews';
    
    -- Create fresh triggers
    EXECUTE 'CREATE TRIGGER product_reviews_insert_trigger
      AFTER INSERT ON product_reviews
      FOR EACH ROW
      EXECUTE FUNCTION notify_review_added()';
      
    EXECUTE 'CREATE TRIGGER product_reviews_update_trigger
      AFTER UPDATE ON product_reviews
      FOR EACH ROW
      EXECUTE FUNCTION notify_review_updated()';
  END IF;
END $$;

-- Grant permissions for all functions to authenticated users
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_collection_notification_recipients(UUID) TO authenticated;

-- Grant permissions for system functions to anon (needed for anonymous orders/reviews)
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_collection_notification_recipients(UUID) TO anon;
GRANT INSERT ON notifications TO anon;
GRANT USAGE ON SCHEMA auth TO anon;
GRANT SELECT ON auth.users TO anon;

COMMIT; 