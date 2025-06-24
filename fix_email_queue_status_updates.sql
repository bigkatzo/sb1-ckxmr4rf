-- Fix Email Queue Status Updates
-- This script ensures email queue status is properly updated after webhook success
BEGIN;

-- ======================================================
-- 1. ENSURE WEBHOOK CALLS PROPER STATUS UPDATE FUNCTION
-- ======================================================

-- Enhanced mark_email_sent_with_harmony function with better logging
CREATE OR REPLACE FUNCTION mark_email_sent_with_harmony(
  p_queue_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_notification_id UUID;
  v_updated BOOLEAN := FALSE;
  v_old_status TEXT;
  v_recipient_email TEXT;
  v_notification_type TEXT;
BEGIN
  -- Get current status and details for logging
  SELECT status, recipient_email, notification_type, notification_id
  INTO v_old_status, v_recipient_email, v_notification_type, v_notification_id
  FROM email_queue
  WHERE id = p_queue_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'HARMONY_EMAIL_NOT_FOUND: queue_id=% not found in email_queue', p_queue_id;
    RETURN FALSE;
  END IF;
  
  RAISE NOTICE 'HARMONY_EMAIL_STATUS_UPDATE_START: queue_id=% old_status=% new_status=% success=% to=% type=%', 
    p_queue_id, v_old_status, CASE WHEN p_success THEN 'sent' ELSE 'failed' END, p_success, v_recipient_email, v_notification_type;
  
  -- Update email queue status
  UPDATE email_queue
  SET 
    status = CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    attempts = attempts + 1,
    last_attempt_at = NOW(),
    error_message = CASE WHEN p_success THEN NULL ELSE p_error_message END,
    updated_at = NOW()
  WHERE id = p_queue_id;
  
  v_updated := FOUND;
  
  IF v_updated THEN
    RAISE NOTICE 'HARMONY_EMAIL_QUEUE_UPDATED: queue_id=% status=% attempts=% to=%', 
      p_queue_id, CASE WHEN p_success THEN 'sent' ELSE 'failed' END, 
      (SELECT attempts FROM email_queue WHERE id = p_queue_id), v_recipient_email;
  ELSE
    RAISE NOTICE 'HARMONY_EMAIL_QUEUE_UPDATE_FAILED: queue_id=% - row not found or not updated', p_queue_id;
  END IF;
  
  -- Update corresponding notification if it exists
  IF v_notification_id IS NOT NULL THEN
    IF p_success THEN
      -- Mark notification as email sent successfully
      UPDATE notifications
      SET 
        email_sent = TRUE,
        updated_at = NOW()
      WHERE id = v_notification_id;
      
      IF FOUND THEN
        RAISE NOTICE 'HARMONY_NOTIFICATION_EMAIL_SUCCESS: queue_id=% notification_id=% marked_as_sent=true', 
          p_queue_id, v_notification_id;
      ELSE
        RAISE NOTICE 'HARMONY_NOTIFICATION_NOT_FOUND: queue_id=% notification_id=% not found for success update', 
          p_queue_id, v_notification_id;
      END IF;
    ELSE
      -- Mark notification as email failed
      UPDATE notifications
      SET 
        email_sent = FALSE,
        updated_at = NOW()
      WHERE id = v_notification_id;
      
      IF FOUND THEN
        RAISE NOTICE 'HARMONY_NOTIFICATION_EMAIL_FAILED: queue_id=% notification_id=% marked_as_failed=true error=%', 
          p_queue_id, v_notification_id, p_error_message;
      ELSE
        RAISE NOTICE 'HARMONY_NOTIFICATION_NOT_FOUND: queue_id=% notification_id=% not found for failure update', 
          p_queue_id, v_notification_id;
      END IF;
    END IF;
  ELSE
    RAISE NOTICE 'HARMONY_NO_NOTIFICATION_ID: queue_id=% has no associated notification_id', p_queue_id;
  END IF;
  
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure mark_email_sent delegates to harmony function
CREATE OR REPLACE FUNCTION mark_email_sent(
  p_queue_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Always use harmony function for consistency
  RETURN mark_email_sent_with_harmony(p_queue_id, p_success, p_error_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 2. WEBHOOK STATUS UPDATE HELPER FUNCTION
-- ======================================================

-- Function specifically for webhook calls with enhanced validation
CREATE OR REPLACE FUNCTION webhook_mark_email_sent(
  p_queue_id UUID,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL,
  p_email_id TEXT DEFAULT NULL -- From email service (like Resend)
)
RETURNS JSONB AS $$
DECLARE
  v_result BOOLEAN;
  v_queue_info RECORD;
  v_response JSONB;
BEGIN
  -- Get queue information before update
  SELECT id, recipient_email, notification_type, status, attempts, created_at
  INTO v_queue_info
  FROM email_queue
  WHERE id = p_queue_id;
  
  IF NOT FOUND THEN
    v_response := jsonb_build_object(
      'success', false,
      'error', 'Email queue entry not found',
      'queue_id', p_queue_id
    );
    RAISE NOTICE 'WEBHOOK_EMAIL_NOT_FOUND: queue_id=%', p_queue_id;
    RETURN v_response;
  END IF;
  
  RAISE NOTICE 'WEBHOOK_EMAIL_STATUS_UPDATE: queue_id=% recipient=% type=% old_status=% new_status=% success=%', 
    p_queue_id, v_queue_info.recipient_email, v_queue_info.notification_type, 
    v_queue_info.status, CASE WHEN p_success THEN 'sent' ELSE 'failed' END, p_success;
  
  -- Call harmony function to update status
  SELECT mark_email_sent_with_harmony(p_queue_id, p_success, p_error_message) INTO v_result;
  
  -- Build response
  v_response := jsonb_build_object(
    'success', v_result,
    'queue_id', p_queue_id,
    'recipient_email', v_queue_info.recipient_email,
    'notification_type', v_queue_info.notification_type,
    'old_status', v_queue_info.status,
    'new_status', CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
    'attempts', v_queue_info.attempts + 1,
    'email_service_id', p_email_id,
    'updated_at', NOW()
  );
  
  IF v_result THEN
    RAISE NOTICE 'WEBHOOK_EMAIL_SUCCESS: queue_id=% updated successfully', p_queue_id;
  ELSE
    v_response := v_response || jsonb_build_object('error', 'Failed to update email queue status');
    RAISE NOTICE 'WEBHOOK_EMAIL_FAILURE: queue_id=% update failed', p_queue_id;
  END IF;
  
  RETURN v_response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 3. EMAIL QUEUE MONITORING FUNCTIONS
-- ======================================================

-- Function to get email queue statistics
CREATE OR REPLACE FUNCTION get_email_queue_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_emails', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE status = 'processing'),
    'sent', COUNT(*) FILTER (WHERE status = 'sent'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'retry', COUNT(*) FILTER (WHERE status = 'retry'),
    'last_24h_total', COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'),
    'last_24h_sent', COUNT(*) FILTER (WHERE status = 'sent' AND updated_at > NOW() - INTERVAL '24 hours'),
    'last_24h_failed', COUNT(*) FILTER (WHERE status = 'failed' AND updated_at > NOW() - INTERVAL '24 hours'),
    'oldest_pending', MIN(created_at) FILTER (WHERE status = 'pending'),
    'latest_activity', MAX(updated_at)
  ) INTO v_stats
  FROM email_queue;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent email activity
CREATE OR REPLACE FUNCTION get_recent_email_activity(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  queue_id UUID,
  recipient_email TEXT,
  notification_type TEXT,
  status TEXT,
  attempts INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  error_message TEXT,
  notification_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.recipient_email,
    eq.notification_type,
    eq.status,
    eq.attempts,
    eq.created_at,
    eq.updated_at,
    eq.error_message,
    eq.notification_id
  FROM email_queue eq
  ORDER BY eq.updated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for stuck emails (pending too long)
CREATE OR REPLACE FUNCTION check_stuck_emails()
RETURNS TABLE(
  queue_id UUID,
  recipient_email TEXT,
  notification_type TEXT,
  age_minutes INTEGER,
  attempts INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id,
    eq.recipient_email,
    eq.notification_type,
    EXTRACT(EPOCH FROM (NOW() - eq.created_at))::INTEGER / 60,
    eq.attempts,
    eq.created_at
  FROM email_queue eq
  WHERE eq.status = 'pending' 
    AND eq.created_at < NOW() - INTERVAL '5 minutes'
  ORDER BY eq.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 4. EMAIL QUEUE HEALTH CHECK FUNCTION
-- ======================================================

CREATE OR REPLACE FUNCTION email_queue_health_check()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
  v_stuck_count INTEGER;
  v_failure_rate NUMERIC;
  v_health_status TEXT;
  v_issues TEXT[] := '{}';
BEGIN
  -- Get basic stats
  SELECT get_email_queue_stats() INTO v_stats;
  
  -- Check for stuck emails
  SELECT COUNT(*) INTO v_stuck_count FROM check_stuck_emails();
  
  -- Calculate failure rate for last 24h
  SELECT 
    CASE 
      WHEN (v_stats->>'last_24h_total')::INTEGER > 0 
      THEN ROUND(((v_stats->>'last_24h_failed')::NUMERIC / (v_stats->>'last_24h_total')::NUMERIC) * 100, 2)
      ELSE 0 
    END 
  INTO v_failure_rate;
  
  -- Determine health status and issues
  v_health_status := 'healthy';
  
  IF v_stuck_count > 0 THEN
    v_issues := array_append(v_issues, format('%s emails stuck pending > 5 minutes', v_stuck_count));
    v_health_status := 'warning';
  END IF;
  
  IF v_failure_rate > 10 THEN
    v_issues := array_append(v_issues, format('High failure rate: %s%% in last 24h', v_failure_rate));
    v_health_status := 'critical';
  ELSIF v_failure_rate > 5 THEN
    v_issues := array_append(v_issues, format('Elevated failure rate: %s%% in last 24h', v_failure_rate));
    IF v_health_status = 'healthy' THEN
      v_health_status := 'warning';
    END IF;
  END IF;
  
  IF (v_stats->>'pending')::INTEGER > 100 THEN
    v_issues := array_append(v_issues, format('%s emails pending (high queue)', (v_stats->>'pending')::INTEGER));
    IF v_health_status = 'healthy' THEN
      v_health_status := 'warning';
    END IF;
  END IF;
  
  RETURN v_stats || jsonb_build_object(
    'health_status', v_health_status,
    'stuck_emails', v_stuck_count,
    'failure_rate_24h', v_failure_rate,
    'issues', to_jsonb(v_issues),
    'checked_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================
-- 5. GRANT PERMISSIONS
-- ======================================================

GRANT EXECUTE ON FUNCTION mark_email_sent_with_harmony(UUID, BOOLEAN, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION mark_email_sent(UUID, BOOLEAN, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION webhook_mark_email_sent(UUID, BOOLEAN, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_email_queue_stats() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_recent_email_activity(INTEGER) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION check_stuck_emails() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION email_queue_health_check() TO authenticated, anon, service_role;

COMMIT; 