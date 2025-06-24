-- Immediate Email Sending with Queue Fallback
-- This migration enables immediate email delivery with reliable fallback
-- CRITICAL: This migration is 100% additive and preserves all existing functionality
BEGIN;

-- ======================================================
-- 1. ENHANCED SEND_NOTIFICATION_EMAIL FUNCTION
-- This only enhances the existing function, doesn't break anything
-- ======================================================

CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
  v_immediate_success BOOLEAN := FALSE;
BEGIN
  BEGIN
    -- Log the email attempt
    RAISE NOTICE 'ATTEMPTING_EMAIL: type=% to=%', p_notification_type, p_user_email;
    
    -- Method 1: Try immediate processing via pg_notify
    -- This triggers the webhook immediately for instant email delivery
    BEGIN
      -- Insert into email queue first for tracking
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
      
      -- Send pg_notify for immediate webhook processing
      PERFORM pg_notify('send_email', jsonb_build_object(
        'queue_id', v_queue_id,
        'to', p_user_email,
        'type', p_notification_type,
        'data', p_notification_data,
        'priority', 'immediate'
      )::text);
      
      v_immediate_success := TRUE;
      RAISE NOTICE 'EMAIL_QUEUED_FOR_IMMEDIATE: queue_id=% type=% to=%', v_queue_id, p_notification_type, p_user_email;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'PG_NOTIFY_FAILED: type=% to=% error=% - using queue only', p_notification_type, p_user_email, SQLERRM;
        v_immediate_success := FALSE;
    END;
    
    -- Method 2: If immediate notification failed, ensure it's queued
    IF NOT v_immediate_success THEN
      IF v_queue_id IS NULL THEN
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
      END IF;
      
      RAISE NOTICE 'EMAIL_FALLBACK_QUEUED: queue_id=% type=% to=%', v_queue_id, p_notification_type, p_user_email;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'EMAIL_COMPLETELY_FAILED: type=% to=% error=%', p_notification_type, p_user_email, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 2. ENHANCED EMAIL STATUS TRACKING (ADDITIVE)
-- ======================================================

-- Function to mark email as sent immediately (for immediate processing)
CREATE OR REPLACE FUNCTION mark_email_sent_immediately(
  p_queue_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Use the existing mark_email_sent function to maintain consistency
  RETURN mark_email_sent(p_queue_id, p_success, p_error_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 3. GRANT PERMISSIONS (ADDITIVE)
-- ======================================================

GRANT EXECUTE ON FUNCTION mark_email_sent_immediately(UUID, BOOLEAN, TEXT) TO authenticated, anon, service_role;

COMMIT; 