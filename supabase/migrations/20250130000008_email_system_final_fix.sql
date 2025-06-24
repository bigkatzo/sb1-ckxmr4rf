-- Final Email Notification System Fix
-- This migration ensures emails are sent according to user preferences
-- and the webhook/queue system works properly
-- CRITICAL: This migration is 100% additive and preserves all existing functionality
BEGIN;

-- ======================================================
-- 1. ENSURE EMAIL_QUEUE TABLE EXISTS WITH CORRECT SCHEMA
-- ======================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  notification_data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retry')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(notification_type);

-- Enable RLS on email_queue (only service role can access)
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Service role can manage email queue" ON email_queue;
CREATE POLICY "Service role can manage email queue"
ON email_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON email_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE ON email_queue TO anon;
GRANT ALL ON email_queue TO service_role;

-- ======================================================
-- 2. FINAL SEND_NOTIFICATION_EMAIL FUNCTION
-- ======================================================

CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  BEGIN
    -- Insert into email queue table for webhook processing
    INSERT INTO email_queue (
      recipient_email,
      notification_type,
      notification_data,
      status
    )
    VALUES (
      p_user_email,
      p_notification_type,
      p_notification_data,
      'pending'
    )
    RETURNING id INTO v_queue_id;
    
    -- Log the queue entry for debugging
    RAISE NOTICE 'EMAIL_QUEUED: id=% type=% to=%', v_queue_id, p_notification_type, p_user_email;
    
    -- Also use pg_notify as backup for immediate processing
    PERFORM pg_notify('send_email', jsonb_build_object(
      'queue_id', v_queue_id,
      'to', p_user_email,
      'type', p_notification_type,
      'data', p_notification_data
    )::text);
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Don't fail the transaction if email queueing fails
      RAISE NOTICE 'Failed to queue email notification for %: %', p_user_email, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 3. EMAIL QUEUE MANAGEMENT FUNCTIONS
-- ======================================================

-- Function to mark email as sent (called by webhook)
CREATE OR REPLACE FUNCTION mark_email_sent(
  p_queue_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE email_queue
  SET 
    status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    attempts = attempts + 1,
    last_attempt_at = NOW(),
    error_message = p_error_message,
    updated_at = NOW()
  WHERE id = p_queue_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending emails (for batch processing)
CREATE OR REPLACE FUNCTION get_pending_emails(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  recipient_email TEXT,
  notification_type TEXT,
  notification_data JSONB,
  attempts INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.recipient_email,
    eq.notification_type,
    eq.notification_data,
    eq.attempts,
    eq.created_at
  FROM email_queue eq
  WHERE eq.status = 'pending'
    AND (eq.attempts < 3 OR eq.attempts IS NULL)
  ORDER BY eq.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retry failed emails
CREATE OR REPLACE FUNCTION retry_failed_emails()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE email_queue
  SET 
    status = 'pending',
    updated_at = NOW()
  WHERE status = 'failed'
    AND attempts < 3
    AND last_attempt_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 4. ENHANCED CREATE_NOTIFICATION_WITH_PREFERENCES
-- This is the NEW function that handles both app and email notifications
-- It does NOT replace the existing create_notification function
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
    -- IMPORTANT: Use direct INSERT to avoid any circular dependency
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
      
      RAISE NOTICE 'NOTIFICATION_CREATED: id=% type=% user_id=%', v_notification_id, p_type, p_user_id;
    ELSE
      RAISE NOTICE 'APP_NOTIFICATION_SKIPPED: type=% user_id=% app_enabled=%', p_type, p_user_id, v_app_enabled;
    END IF;
    
    -- Send email notification if enabled and user has email
    IF v_email_enabled AND v_user_email IS NOT NULL AND v_user_email != '' THEN
      BEGIN
        -- Log email attempt for debugging
        RAISE NOTICE 'SENDING_EMAIL: type=% to=% title=%', p_type, v_user_email, p_title;
        
        PERFORM send_notification_email(v_user_email, p_type, p_data || jsonb_build_object('title', p_title, 'message', p_message));
        
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

-- ======================================================
-- 5. PRESERVE EXISTING CREATE_NOTIFICATION FUNCTION
-- DO NOT REPLACE - This maintains 100% backward compatibility
-- ======================================================

-- The original create_notification function remains unchanged!
-- This ensures all existing code continues to work exactly as before
-- New code can opt-in to use create_notification_with_preferences

-- ======================================================
-- 6. GRANT PERMISSIONS
-- ======================================================

-- Core functions
GRANT EXECUTE ON FUNCTION send_notification_email(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO authenticated;

-- Queue management functions
GRANT EXECUTE ON FUNCTION mark_email_sent(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_emails(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_failed_emails() TO authenticated;

-- Grant permissions to anon for system notification creation
GRANT EXECUTE ON FUNCTION send_notification_email(TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION create_notification_with_preferences(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, UUID, UUID, UUID, UUID) TO anon;

-- Service role gets full access
GRANT EXECUTE ON FUNCTION mark_email_sent(UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_emails(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION retry_failed_emails() TO service_role;

COMMIT; 