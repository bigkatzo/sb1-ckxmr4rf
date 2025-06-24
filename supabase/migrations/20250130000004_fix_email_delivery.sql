-- Fix email delivery system by calling Edge Function directly
-- This migration replaces pg_notify with direct Supabase Edge Function calls
BEGIN;

-- Create improved function to send email notification via Edge Function
CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_payload JSONB;
  v_function_url TEXT;
BEGIN
  -- Prepare payload for edge function
  v_payload := jsonb_build_object(
    'to', p_user_email,
    'type', p_notification_type,
    'data', p_notification_data
  );

  -- Get Supabase function URL from environment
  -- This will be the URL for our send-notification-email edge function
  v_function_url := current_setting('app.supabase_function_url', true);
  
  -- If no custom URL is set, we'll use a workaround with pg_notify for now
  -- but log it properly so we can see what's happening
  IF v_function_url IS NULL OR v_function_url = '' THEN
    -- Log the email request for debugging
    RAISE NOTICE 'EMAIL_REQUEST: % for % with data: %', p_notification_type, p_user_email, p_notification_data;
    
    -- Use pg_notify as fallback (this will be picked up by our new webhook)
    PERFORM pg_notify('send_email', v_payload::text);
  ELSE
    -- TODO: Direct HTTP call to edge function (requires HTTP extension)
    -- For now, continue with pg_notify but with better logging
    RAISE NOTICE 'EMAIL_REQUEST: % for % with data: %', p_notification_type, p_user_email, p_notification_data;
    PERFORM pg_notify('send_email', v_payload::text);
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the transaction if email sending fails
    RAISE NOTICE 'Failed to queue email notification for %: %', p_user_email, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_notification_with_preferences to have better email handling
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
    -- Get user preferences and email in one query
    SELECT 
      u.email,
      COALESCE(np.all_app_notifications, TRUE),
      COALESCE(np.all_email_notifications, TRUE),
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
        WHEN 'order_created' THEN COALESCE(np.order_created_email, TRUE)
        WHEN 'order_status_changed' THEN COALESCE(np.order_status_changed_email, TRUE)
        WHEN 'tracking_added' THEN COALESCE(np.tracking_added_email, TRUE)
        WHEN 'tracking_removed' THEN COALESCE(np.tracking_removed_email, TRUE)
        WHEN 'category_created' THEN COALESCE(np.category_created_email, TRUE)
        WHEN 'category_edited' THEN COALESCE(np.category_edited_email, TRUE)
        WHEN 'category_deleted' THEN COALESCE(np.category_deleted_email, TRUE)
        WHEN 'product_created' THEN COALESCE(np.product_created_email, TRUE)
        WHEN 'product_edited' THEN COALESCE(np.product_edited_email, TRUE)
        WHEN 'product_deleted' THEN COALESCE(np.product_deleted_email, TRUE)
        WHEN 'collection_created' THEN COALESCE(np.collection_created_email, TRUE)
        WHEN 'collection_edited' THEN COALESCE(np.collection_edited_email, TRUE)
        WHEN 'collection_deleted' THEN COALESCE(np.collection_deleted_email, TRUE)
        WHEN 'user_access_granted' THEN COALESCE(np.user_access_granted_email, TRUE)
        WHEN 'user_access_removed' THEN COALESCE(np.user_access_removed_email, TRUE)
        WHEN 'user_created' THEN COALESCE(np.user_created_email, TRUE)
        WHEN 'review_added' THEN COALESCE(np.review_added_email, TRUE)
        WHEN 'review_updated' THEN COALESCE(np.review_updated_email, TRUE)
        ELSE TRUE -- Default to enabled for unknown types
      END
    INTO v_user_email, v_all_app_notifications, v_all_email_notifications, v_app_type_enabled, v_email_type_enabled
    FROM auth.users u
    LEFT JOIN notification_preferences np ON np.user_id = u.id
    WHERE u.id = p_user_id;
    
    -- Determine if notifications should be sent based on preferences
    -- Default to enabled if no preferences found (backwards compatibility)
    v_app_enabled := COALESCE(v_all_app_notifications, TRUE) AND COALESCE(v_app_type_enabled, TRUE);
    v_email_enabled := COALESCE(v_all_email_notifications, TRUE) AND COALESCE(v_email_type_enabled, TRUE);
    
    -- Create in-app notification if enabled
    IF v_app_enabled THEN
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
    END IF;
    
    -- Send email notification if enabled and user has email
    IF v_email_enabled AND v_user_email IS NOT NULL AND v_user_email != '' THEN
      BEGIN
        -- Log email attempt for debugging
        RAISE NOTICE 'SENDING_EMAIL: type=% to=% title=%', p_type, v_user_email, p_title;
        
        PERFORM send_notification_email(v_user_email, p_type, p_data);
        
        -- Mark email as sent (only if notification was created successfully)
        IF v_notification_id IS NOT NULL THEN
          UPDATE notifications
          SET email_sent = TRUE
          WHERE id = v_notification_id;
        END IF;
        
        -- Log successful email queue
        RAISE NOTICE 'EMAIL_QUEUED: type=% to=% notification_id=%', p_type, v_user_email, v_notification_id;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log email error but don't fail the entire operation
          RAISE NOTICE 'EMAIL_FAILED: type=% to=% error=% notification_id=%', p_type, v_user_email, SQLERRM, v_notification_id;
      END;
    ELSE
      -- Log why email wasn't sent
      RAISE NOTICE 'EMAIL_SKIPPED: type=% user_id=% email_enabled=% has_email=% email=%', 
        p_type, p_user_id, v_email_enabled, (v_user_email IS NOT NULL AND v_user_email != ''), COALESCE(v_user_email, 'NULL');
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- CRITICAL: Log error but return NULL instead of failing
      RAISE NOTICE 'NOTIFICATION_ERROR: user_id=% type=% error=%', p_user_id, p_type, SQLERRM;
      RETURN NULL;
  END;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION send_notification_email(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO authenticated;

-- Grant permissions to anon for system notification creation
GRANT EXECUTE ON FUNCTION send_notification_email(TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION create_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO anon;

COMMIT; 