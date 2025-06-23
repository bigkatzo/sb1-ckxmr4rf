-- FIX: Replace the circular dependency in create_notification_with_preferences
-- The function was calling create_notification which calls itself = infinite loop!

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
  p_target_user_id UUID DEFAULT NULL,
  p_review_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_user_email TEXT;
  v_should_send_app BOOLEAN;
  v_should_send_email BOOLEAN;
BEGIN
  -- CRITICAL: Wrap all logic in exception handler
  BEGIN
    -- Check if user wants app notifications (defaults to TRUE on error)
    v_should_send_app := should_send_notification(p_user_id, p_type, 'app');
    
    -- Check if user wants email notifications (defaults to TRUE on error)
    v_should_send_email := should_send_notification(p_user_id, p_type, 'email');
    
    -- Create app notification if user wants it
    IF v_should_send_app THEN
      BEGIN
        -- FIX: Use direct INSERT instead of calling create_notification (infinite recursion)
        INSERT INTO notifications (
          user_id, type, title, message, data,
          collection_id, category_id, product_id, order_id, target_user_id, review_id
        )
        VALUES (
          p_user_id, p_type, p_title, p_message, p_data,
          p_collection_id, p_category_id, p_product_id, p_order_id, p_target_user_id, p_review_id
        )
        RETURNING id INTO v_notification_id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to create app notification for user %: %', p_user_id, SQLERRM;
      END;
    END IF;
    
    -- Send email notification if user wants it
    IF v_should_send_email THEN
      BEGIN
        SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
        
        IF v_user_email IS NOT NULL AND v_user_email != '' THEN
          PERFORM pg_notify('send_email', jsonb_build_object(
            'to', v_user_email, 'type', p_type, 'data', p_data
          )::text);
          
          IF v_notification_id IS NOT NULL THEN
            UPDATE notifications SET email_sent = TRUE WHERE id = v_notification_id;
          END IF;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to send email notification for user %: %', p_user_id, SQLERRM;
      END;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Critical error in create_notification_with_preferences for user %: %', p_user_id, SQLERRM;
  END;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 