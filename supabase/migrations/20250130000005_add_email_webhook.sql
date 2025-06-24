-- Add webhook-based email notification system
-- This migration creates a more reliable email delivery system
BEGIN;

-- Create table to queue email notifications for webhook processing
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(notification_type);

-- Enable RLS on email_queue (only service role can access)
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access email queue
CREATE POLICY "Service role can manage email queue"
ON email_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Updated function to queue email notifications reliably
CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
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
  
  -- Log the queue entry
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    OR (eq.status = 'retry' AND eq.last_attempt_at < NOW() - INTERVAL '5 minutes')
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
    status = 'retry',
    updated_at = NOW()
  WHERE status = 'failed' 
    AND attempts < 3 
    AND last_attempt_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON email_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE ON email_queue TO anon;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION mark_email_sent(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_emails(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_failed_emails() TO authenticated;

-- Service role gets full access
GRANT ALL ON email_queue TO service_role;
GRANT EXECUTE ON FUNCTION mark_email_sent(UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_emails(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION retry_failed_emails() TO service_role;

COMMIT; 