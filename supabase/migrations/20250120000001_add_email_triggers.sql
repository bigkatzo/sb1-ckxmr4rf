-- Enhanced notification system with email sending
BEGIN;

-- Create function to queue email notification via pg_notify
CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_payload JSONB;
BEGIN
  -- Prepare payload for edge function
  v_payload := jsonb_build_object(
    'to', p_user_email,
    'type', p_notification_type,
    'data', p_notification_data
  );

  -- Use pg_notify to trigger async email sending
  -- This can be picked up by a background worker or webhook
  PERFORM pg_notify('send_email', v_payload::text);
  
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the transaction if email sending fails
    RAISE NOTICE 'Failed to queue email notification: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update notification creation function to include email sending
CREATE OR REPLACE FUNCTION create_notification_with_email(
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
BEGIN
  -- Create the notification
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
  
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Send email notification if user has email
  IF v_user_email IS NOT NULL AND v_user_email != '' THEN
    PERFORM send_notification_email(v_user_email, p_type, p_data);
    
    -- Mark email as sent
    UPDATE notifications
    SET email_sent = TRUE
    WHERE id = v_notification_id;
  END IF;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger functions to use the new email-enabled notification function
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
    PERFORM create_notification_with_email(
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

-- Update category notification trigger
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
    PERFORM create_notification_with_email(
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

-- Update product notification trigger
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
    PERFORM create_notification_with_email(
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION send_notification_email(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_with_email(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID) TO authenticated;

COMMIT; 