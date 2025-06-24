-- 🚀 REAL-TIME EMAIL PROCESSING 
-- This migration enables immediate email sending by calling HTTP endpoints directly from database triggers
-- No more pg_notify delays or scheduled processing needed!

BEGIN;

-- ================================================================
-- 1. HTTP EXTENSION SETUP
-- ================================================================

-- Enable the http extension for making HTTP requests from PostgreSQL
-- Note: This may require superuser privileges in some Supabase instances
CREATE EXTENSION IF NOT EXISTS http;

-- ================================================================
-- 2. REAL-TIME EMAIL FUNCTION USING HTTP
-- ================================================================

CREATE OR REPLACE FUNCTION send_notification_email_realtime(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
  v_response http_response;
  v_webhook_url TEXT;
BEGIN
  BEGIN
    -- Always queue the email for tracking/retry purposes
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
      'processing'  -- Mark as processing immediately
    )
    RETURNING id INTO v_queue_id;
    
    -- Get the webhook URL from environment or use default
    -- You'll need to set this in your Supabase settings
    v_webhook_url := current_setting('app.email_webhook_url', true);
    
    -- Default to your auto-process-email-queue function if not set
    IF v_webhook_url IS NULL OR v_webhook_url = '' THEN
      v_webhook_url := 'https://store.fun/.netlify/functions/auto-process-email-queue';
    END IF;
    
    -- Make immediate HTTP call to process the email
    SELECT * INTO v_response
    FROM http((
      'POST',
      v_webhook_url,
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('User-Agent', 'Supabase-RealTime-Email/1.0')
      ],
      jsonb_build_object(
        'queue_id', v_queue_id,
        'to', p_user_email,
        'type', p_notification_type,
        'data', p_notification_data,
        'priority', 'immediate',
        'source', 'realtime_trigger'
      )::text
    ));
    
    -- Update queue status based on HTTP response
    IF v_response.status >= 200 AND v_response.status < 300 THEN
      UPDATE email_queue 
      SET 
        status = 'sent',
        attempts = 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
      WHERE id = v_queue_id;
      
      RAISE NOTICE 'REALTIME_EMAIL_SUCCESS: queue_id=% status=% to=%', 
        v_queue_id, v_response.status, p_user_email;
    ELSE
      UPDATE email_queue 
      SET 
        status = 'failed',
        attempts = 1,
        last_attempt_at = NOW(),
        error_message = format('HTTP %s: %s', v_response.status, v_response.content),
        updated_at = NOW()
      WHERE id = v_queue_id;
      
      RAISE NOTICE 'REALTIME_EMAIL_FAILED: queue_id=% status=% error=% to=%', 
        v_queue_id, v_response.status, v_response.content, p_user_email;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- If HTTP call fails, mark as failed but don't break the transaction
      UPDATE email_queue 
      SET 
        status = 'failed',
        attempts = 1,
        last_attempt_at = NOW(),
        error_message = format('Exception: %s', SQLERRM),
        updated_at = NOW()
      WHERE id = v_queue_id;
      
      RAISE NOTICE 'REALTIME_EMAIL_EXCEPTION: queue_id=% error=% to=%', 
        v_queue_id, SQLERRM, p_user_email;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 3. FALLBACK FUNCTION (keeps pg_notify as backup)
-- ================================================================

CREATE OR REPLACE FUNCTION send_notification_email_hybrid(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
  v_http_success BOOLEAN := FALSE;
BEGIN
  BEGIN
    -- Try real-time HTTP first
    BEGIN
      PERFORM send_notification_email_realtime(p_user_email, p_notification_type, p_notification_data);
      v_http_success := TRUE;
      RAISE NOTICE 'HYBRID_EMAIL_HTTP_SUCCESS: type=% to=%', p_notification_type, p_user_email;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'HYBRID_EMAIL_HTTP_FAILED: type=% to=% error=% - falling back to pg_notify', 
          p_notification_type, p_user_email, SQLERRM;
        v_http_success := FALSE;
    END;
    
    -- If HTTP failed, use pg_notify as fallback
    IF NOT v_http_success THEN
      -- Queue for backup processing
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
      
      -- Send pg_notify for scheduled processing
      PERFORM pg_notify('send_email', jsonb_build_object(
        'queue_id', v_queue_id,
        'to', p_user_email,
        'type', p_notification_type,
        'data', p_notification_data,
        'priority', 'fallback'
      )::text);
      
      RAISE NOTICE 'HYBRID_EMAIL_FALLBACK_QUEUED: queue_id=% type=% to=%', 
        v_queue_id, p_notification_type, p_user_email;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'HYBRID_EMAIL_COMPLETELY_FAILED: type=% to=% error=%', 
        p_notification_type, p_user_email, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 4. UPDATE MAIN EMAIL FUNCTION TO USE REAL-TIME
-- ================================================================

-- Replace the main email function to use real-time processing
CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
BEGIN
  -- Use hybrid approach: real-time HTTP with pg_notify fallback
  PERFORM send_notification_email_hybrid(p_user_email, p_notification_type, p_notification_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 5. GRANT PERMISSIONS
-- ================================================================

GRANT EXECUTE ON FUNCTION send_notification_email_realtime(TEXT, TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION send_notification_email_hybrid(TEXT, TEXT, JSONB) TO authenticated, anon;

-- ================================================================
-- 6. TESTING FUNCTION
-- ================================================================

-- Test function to verify real-time processing
CREATE OR REPLACE FUNCTION test_realtime_email(p_email TEXT DEFAULT 'test@example.com')
RETURNS TEXT AS $$
BEGIN
  PERFORM send_notification_email_realtime(
    p_email,
    'realtime_test',
    jsonb_build_object(
      'test', true,
      'message', 'Testing real-time email processing',
      'timestamp', extract(epoch from NOW())
    )
  );
  
  RETURN format('Real-time email test triggered for %s', p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_realtime_email(TEXT) TO authenticated, anon;

COMMIT; 