-- Enhanced notification system with email sending
-- This migration adds email functionality to the enhanced notification system
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

-- Enhanced notification creation function that includes email sending and preference checking
-- CRITICAL: This function must handle all errors gracefully and never block core operations
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
  v_all_app_notifications BOOLEAN;
  v_all_email_notifications BOOLEAN;
  v_app_type_enabled BOOLEAN;
  v_email_type_enabled BOOLEAN;
  v_app_enabled BOOLEAN := FALSE;
  v_email_enabled BOOLEAN := FALSE;
BEGIN
  -- CRITICAL: Wrap all logic in exception handler
  BEGIN
    -- Get user preferences and email
    SELECT 
      u.email,
      COALESCE(np.all_app_notifications, TRUE),
      COALESCE(np.all_email_notifications, FALSE),
      -- Check specific type preferences (using dynamic column access)
      CASE p_type
        WHEN 'order_created' THEN COALESCE(np.order_created_app, TRUE)
        WHEN 'order_status_changed' THEN COALESCE(np.order_status_changed_app, TRUE)
        WHEN 'tracking_added' THEN COALESCE(np.tracking_added_app, TRUE)
        WHEN 'tracking_removed' THEN COALESCE(np.tracking_removed_app, TRUE)
        WHEN 'category_created' THEN COALESCE(np.category_created_app, TRUE)
        WHEN 'category_edited' THEN COALESCE(np.category_edited_app, TRUE)
        WHEN 'category_deleted' THEN COALESCE(np.category_deleted_app, TRUE)
        WHEN 'product_created' THEN COALESCE(np.product_created_app, TRUE)
        WHEN 'product_edited' THEN COALESCE(np.product_edited_app, TRUE)
        WHEN 'product_deleted' THEN COALESCE(np.product_deleted_app, TRUE)
        WHEN 'collection_created' THEN COALESCE(np.collection_created_app, TRUE)
        WHEN 'collection_edited' THEN COALESCE(np.collection_edited_app, TRUE)
        WHEN 'collection_deleted' THEN COALESCE(np.collection_deleted_app, TRUE)
        WHEN 'user_access_granted' THEN COALESCE(np.user_access_granted_app, TRUE)
        WHEN 'user_access_removed' THEN COALESCE(np.user_access_removed_app, TRUE)
        WHEN 'user_created' THEN COALESCE(np.user_created_app, TRUE)
        WHEN 'review_added' THEN COALESCE(np.review_added_app, TRUE)
        WHEN 'review_updated' THEN COALESCE(np.review_updated_app, TRUE)
        ELSE TRUE -- Default to enabled for unknown types
      END,
      CASE p_type
        WHEN 'order_created' THEN COALESCE(np.order_created_email, FALSE)
        WHEN 'order_status_changed' THEN COALESCE(np.order_status_changed_email, FALSE)
        WHEN 'tracking_added' THEN COALESCE(np.tracking_added_email, FALSE)
        WHEN 'tracking_removed' THEN COALESCE(np.tracking_removed_email, FALSE)
        WHEN 'category_created' THEN COALESCE(np.category_created_email, FALSE)
        WHEN 'category_edited' THEN COALESCE(np.category_edited_email, FALSE)
        WHEN 'category_deleted' THEN COALESCE(np.category_deleted_email, FALSE)
        WHEN 'product_created' THEN COALESCE(np.product_created_email, FALSE)
        WHEN 'product_edited' THEN COALESCE(np.product_edited_email, FALSE)
        WHEN 'product_deleted' THEN COALESCE(np.product_deleted_email, FALSE)
        WHEN 'collection_created' THEN COALESCE(np.collection_created_email, FALSE)
        WHEN 'collection_edited' THEN COALESCE(np.collection_edited_email, FALSE)
        WHEN 'collection_deleted' THEN COALESCE(np.collection_deleted_email, FALSE)
        WHEN 'user_access_granted' THEN COALESCE(np.user_access_granted_email, FALSE)
        WHEN 'user_access_removed' THEN COALESCE(np.user_access_removed_email, FALSE)
        WHEN 'user_created' THEN COALESCE(np.user_created_email, FALSE)
        WHEN 'review_added' THEN COALESCE(np.review_added_email, FALSE)
        WHEN 'review_updated' THEN COALESCE(np.review_updated_email, FALSE)
        ELSE FALSE -- Default to disabled for unknown types
      END
    INTO v_user_email, v_all_app_notifications, v_all_email_notifications, v_app_type_enabled, v_email_type_enabled
    FROM auth.users u
    LEFT JOIN notification_preferences np ON np.user_id = u.id
    WHERE u.id = p_user_id;
    
    -- Determine if notifications should be sent based on preferences
    -- Default to enabled if no preferences found (backwards compatibility)
    v_app_enabled := v_all_app_notifications AND v_app_type_enabled;
    v_email_enabled := v_all_email_notifications AND v_email_type_enabled;
    
    -- Create in-app notification if enabled
    IF v_app_enabled THEN
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
        p_target_user_id,
        p_review_id
      ) INTO v_notification_id;
    END IF;
    
    -- Send email notification if enabled and user has email
    IF v_email_enabled AND v_user_email IS NOT NULL AND v_user_email != '' THEN
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
      RAISE NOTICE 'Failed to create notification with preferences for user %: %', p_user_id, SQLERRM;
      RETURN NULL;
  END;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the main notification creation function to use preferences by default
-- This maintains backwards compatibility while adding preference support
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
BEGIN
  -- Use the preference-aware function for all new notifications
  RETURN create_notification_with_preferences(
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
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION send_notification_email(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO authenticated;

-- Grant permissions to anon for system notification creation
GRANT EXECUTE ON FUNCTION send_notification_email(TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION create_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO anon;

COMMIT; 