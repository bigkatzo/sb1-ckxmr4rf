-- Perfect Harmony: Notification & Email System Integration
-- This migration ensures perfect synchronization between notifications and emails
BEGIN;

-- ======================================================
-- 1. ENHANCED EMAIL QUEUE WITH NOTIFICATION TRACKING
-- ======================================================

-- Add notification_id to email_queue for perfect tracking
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_email_queue_notification_id ON email_queue(notification_id);

-- ======================================================
-- 2. PERFECT HARMONY NOTIFICATION FUNCTION
-- Creates notification and email in perfect sync with comprehensive tracking
-- ======================================================

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
  v_queue_id UUID;
BEGIN
  -- CRITICAL: Wrap all logic in exception handler
  BEGIN
    -- Get user preferences and email in one query for efficiency
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
    v_app_enabled := COALESCE(v_all_app_notifications, TRUE) AND COALESCE(v_app_type_enabled, TRUE);
    v_email_enabled := COALESCE(v_all_email_notifications, TRUE) AND COALESCE(v_email_type_enabled, TRUE);
    
    -- 🎯 STEP 1: Create in-app notification if enabled
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
        review_id,
        email_sent -- Initialize as FALSE
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
        p_review_id,
        FALSE
      )
      RETURNING id INTO v_notification_id;
      
      RAISE NOTICE 'HARMONY_NOTIFICATION_CREATED: id=% type=% user_id=%', v_notification_id, p_type, p_user_id;
    ELSE
      RAISE NOTICE 'HARMONY_APP_NOTIFICATION_SKIPPED: type=% user_id=% app_enabled=%', p_type, p_user_id, v_app_enabled;
    END IF;
    
    -- 🎯 STEP 2: Send email notification if enabled (PERFECT SYNC)
    IF v_email_enabled AND v_user_email IS NOT NULL AND v_user_email != '' THEN
      BEGIN
        -- Prepare email data with notification context
        DECLARE
          v_email_data JSONB;
        BEGIN
          v_email_data := p_data || jsonb_build_object(
            'title', p_title,
            'message', p_message,
            'notification_id', v_notification_id,
            'user_id', p_user_id
          );
          
          -- Insert into email queue with notification tracking
          INSERT INTO email_queue (
            recipient_email,
            notification_type,
            notification_data,
            notification_id,
            status
          )
          VALUES (
            v_user_email,
            p_type,
            v_email_data,
            v_notification_id,
            'pending'
          )
          RETURNING id INTO v_queue_id;
          
          -- Send pg_notify for immediate processing
          PERFORM pg_notify('send_email', jsonb_build_object(
            'queue_id', v_queue_id,
            'notification_id', v_notification_id,
            'to', v_user_email,
            'type', p_type,
            'data', v_email_data,
            'priority', 'immediate'
          )::text);
          
          -- Update notification with email queue tracking
          IF v_notification_id IS NOT NULL THEN
            UPDATE notifications
            SET 
              email_sent = TRUE,
              updated_at = NOW()
            WHERE id = v_notification_id;
          END IF;
          
          RAISE NOTICE 'HARMONY_EMAIL_QUEUED: queue_id=% notification_id=% type=% to=%', 
            v_queue_id, v_notification_id, p_type, v_user_email;
        END;
        
      EXCEPTION
        WHEN OTHERS THEN
          -- Log email error but don't fail the entire operation
          RAISE NOTICE 'HARMONY_EMAIL_FAILED: notification_id=% type=% to=% error=%', 
            v_notification_id, p_type, v_user_email, SQLERRM;
      END;
    ELSE
      -- Log why email wasn't sent
      RAISE NOTICE 'HARMONY_EMAIL_SKIPPED: notification_id=% type=% user_id=% email_enabled=% has_email=%', 
        v_notification_id, p_type, p_user_id, v_email_enabled, (v_user_email IS NOT NULL AND v_user_email != '');
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- CRITICAL: Log error but return notification_id if created
      RAISE NOTICE 'HARMONY_ERROR: user_id=% type=% error=% notification_id=%', 
        p_user_id, p_type, SQLERRM, v_notification_id;
      RETURN v_notification_id; -- Return what we have
  END;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 3. ENHANCED EMAIL STATUS TRACKING WITH HARMONY
-- ======================================================

-- Function to update email status and notification in perfect sync
CREATE OR REPLACE FUNCTION mark_email_sent_with_harmony(
  p_queue_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_notification_id UUID;
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Update email queue and get notification_id
  UPDATE email_queue
  SET 
    status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    attempts = attempts + 1,
    last_attempt_at = NOW(),
    error_message = p_error_message,
    updated_at = NOW()
  WHERE id = p_queue_id
  RETURNING notification_id INTO v_notification_id;
  
  v_updated := FOUND;
  
  -- If email failed and we have a notification, update its status
  IF NOT p_success AND v_notification_id IS NOT NULL THEN
    UPDATE notifications
    SET 
      email_sent = FALSE,
      updated_at = NOW()
    WHERE id = v_notification_id;
    
    RAISE NOTICE 'HARMONY_EMAIL_FAILED_SYNC: queue_id=% notification_id=% error=%', 
      p_queue_id, v_notification_id, p_error_message;
  ELSIF p_success AND v_notification_id IS NOT NULL THEN
    -- Confirm email was sent successfully
    UPDATE notifications
    SET 
      email_sent = TRUE,
      updated_at = NOW()
    WHERE id = v_notification_id;
    
    RAISE NOTICE 'HARMONY_EMAIL_SUCCESS_SYNC: queue_id=% notification_id=%', 
      p_queue_id, v_notification_id;
  END IF;
  
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 4. ENHANCED SEND_NOTIFICATION_EMAIL FOR HARMONY
-- ======================================================

CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
  v_notification_id UUID;
  v_immediate_success BOOLEAN := FALSE;
BEGIN
  BEGIN
    -- Extract notification_id if provided in data
    v_notification_id := (p_notification_data->>'notification_id')::UUID;
    
    RAISE NOTICE 'HARMONY_ATTEMPTING_EMAIL: type=% to=% notification_id=%', 
      p_notification_type, p_user_email, v_notification_id;
    
    -- Method 1: Try immediate processing via pg_notify
    BEGIN
      -- Insert into email queue with notification tracking
      INSERT INTO email_queue (
        recipient_email,
        notification_type,
        notification_data,
        notification_id,
        status
      )
      VALUES (
        p_user_email,
        p_notification_type,
        p_notification_data,
        v_notification_id,
        'pending'
      )
      RETURNING id INTO v_queue_id;
      
      -- Send pg_notify for immediate webhook processing
      PERFORM pg_notify('send_email', jsonb_build_object(
        'queue_id', v_queue_id,
        'notification_id', v_notification_id,
        'to', p_user_email,
        'type', p_notification_type,
        'data', p_notification_data,
        'priority', 'immediate'
      )::text);
      
      v_immediate_success := TRUE;
      RAISE NOTICE 'HARMONY_EMAIL_QUEUED_FOR_IMMEDIATE: queue_id=% notification_id=% type=% to=%', 
        v_queue_id, v_notification_id, p_notification_type, p_user_email;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'HARMONY_PG_NOTIFY_FAILED: notification_id=% type=% to=% error=% - using queue only', 
          v_notification_id, p_notification_type, p_user_email, SQLERRM;
        v_immediate_success := FALSE;
    END;
    
    -- Method 2: If immediate notification failed, ensure it's queued
    IF NOT v_immediate_success THEN
      IF v_queue_id IS NULL THEN
        INSERT INTO email_queue (
          recipient_email,
          notification_type,
          notification_data,
          notification_id,
          status
        )
        VALUES (
          p_user_email,
          p_notification_type,
          p_notification_data,
          v_notification_id,
          'pending'
        )
        RETURNING id INTO v_queue_id;
      END IF;
      
      RAISE NOTICE 'HARMONY_EMAIL_FALLBACK_QUEUED: queue_id=% notification_id=% type=% to=%', 
        v_queue_id, v_notification_id, p_notification_type, p_user_email;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'HARMONY_EMAIL_COMPLETELY_FAILED: notification_id=% type=% to=% error=%', 
        v_notification_id, p_notification_type, p_user_email, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 5. GRANT PERMISSIONS FOR HARMONY FUNCTIONS
-- ======================================================

GRANT EXECUTE ON FUNCTION mark_email_sent_with_harmony(UUID, BOOLEAN, TEXT) TO authenticated, anon, service_role;

-- Update existing function references
CREATE OR REPLACE FUNCTION mark_email_sent(
  p_queue_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Delegate to harmony function for consistency
  RETURN mark_email_sent_with_harmony(p_queue_id, p_success, p_error_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 6. REAL-TIME NOTIFICATION UPDATE TRIGGER
-- ======================================================

-- Function to trigger real-time updates when notifications change
CREATE OR REPLACE FUNCTION notify_notification_changed()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify real-time subscribers about notification changes
  PERFORM pg_notify('notification_changed', jsonb_build_object(
    'id', NEW.id,
    'user_id', NEW.user_id,
    'type', NEW.type,
    'email_sent', NEW.email_sent,
    'read', NEW.read,
    'action', TG_OP
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for real-time updates
DROP TRIGGER IF EXISTS notifications_realtime_trigger ON notifications;
CREATE TRIGGER notifications_realtime_trigger
  AFTER INSERT OR UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION notify_notification_changed();

COMMIT; 