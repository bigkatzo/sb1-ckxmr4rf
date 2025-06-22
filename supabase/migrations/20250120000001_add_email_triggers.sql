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
-- CRITICAL: This function must handle all errors gracefully
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
  -- CRITICAL: Wrap all logic in exception handler
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
      BEGIN
        PERFORM send_notification_email(v_user_email, p_type, p_data);
        
        -- Mark email as sent (only if notification was created successfully)
        IF v_notification_id IS NOT NULL THEN
          UPDATE notifications
          SET email_sent = TRUE
          WHERE id = v_notification_id;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log email error but don't fail the entire operation
          RAISE NOTICE 'Failed to send email for notification %: %', v_notification_id, SQLERRM;
      END;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- CRITICAL: Log error but return NULL instead of failing
      RAISE NOTICE 'Failed to create notification with email for user %: %', p_user_id, SQLERRM;
      RETURN NULL;
  END;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REMOVED: Duplicate trigger function definitions
-- These are already defined with proper error handling in the first migration
-- The first migration now includes all necessary error handling

-- Grant permissions
GRANT EXECUTE ON FUNCTION send_notification_email(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_with_email(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID) TO authenticated;

COMMIT; 