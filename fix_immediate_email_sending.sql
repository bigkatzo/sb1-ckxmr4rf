-- 🚀 FIX IMMEDIATE EMAIL SENDING
-- This makes emails send immediately when notifications are triggered

-- Create enhanced email sending function that calls Edge Function directly
CREATE OR REPLACE FUNCTION send_notification_email_immediate(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
  v_response_status INTEGER;
  v_response_body TEXT;
BEGIN
  BEGIN
    -- Still queue the email for tracking/retry purposes
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
    
    -- Log the attempt
    RAISE NOTICE 'EMAIL_IMMEDIATE_ATTEMPT: queue_id=% type=% to=%', v_queue_id, p_notification_type, p_user_email;
    
    -- Call Edge Function immediately via http extension
    -- Note: This requires the http extension to be enabled
    SELECT status, content INTO v_response_status, v_response_body
    FROM http((
      'POST',
      'https://sakysysfksculqobozxi.supabase.co/functions/v1/send-notification-email',
      ARRAY[
        http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNha3lzeXNma3NjdWxxb2JvenhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3OTY0NjgsImV4cCI6MjA1MDM3MjQ2OH0.Qm66XcNg8GyNp68rUY_Wgpw4bUOPHqvA3GrtjKBHi34'),
        http_header('Content-Type', 'application/json')
      ],
      jsonb_build_object(
        'to', p_user_email,
        'type', p_notification_type, 
        'data', p_notification_data
      )::text
    ));
    
    -- Update queue status based on response
    IF v_response_status >= 200 AND v_response_status < 300 THEN
      UPDATE email_queue 
      SET status = 'sent', 
          attempts = 1,
          last_attempt_at = NOW(),
          updated_at = NOW()
      WHERE id = v_queue_id;
      
      RAISE NOTICE 'EMAIL_IMMEDIATE_SUCCESS: queue_id=% status=% to=%', v_queue_id, v_response_status, p_user_email;
    ELSE
      UPDATE email_queue 
      SET status = 'failed',
          attempts = 1,
          last_attempt_at = NOW(),
          error_message = format('HTTP %s: %s', v_response_status, v_response_body),
          updated_at = NOW()
      WHERE id = v_queue_id;
      
      RAISE NOTICE 'EMAIL_IMMEDIATE_FAILED: queue_id=% status=% error=% to=%', v_queue_id, v_response_status, v_response_body, p_user_email;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Mark as failed and log error
      UPDATE email_queue 
      SET status = 'failed',
          attempts = 1,
          last_attempt_at = NOW(),
          error_message = format('Exception: %s', SQLERRM),
          updated_at = NOW()
      WHERE id = v_queue_id;
      
      RAISE NOTICE 'EMAIL_IMMEDIATE_EXCEPTION: queue_id=% error=% to=%', v_queue_id, SQLERRM, p_user_email;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative: Queue-based immediate processing with webhook trigger
CREATE OR REPLACE FUNCTION send_notification_email_webhook(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  BEGIN
    -- Insert into queue with high priority
    INSERT INTO email_queue (
      recipient_email,
      notification_type,
      notification_data,
      status,
      priority
    )
    VALUES (
      p_user_email,
      p_notification_type,
      p_notification_data,
      'pending',
      'immediate'
    )
    RETURNING id INTO v_queue_id;
    
    -- Trigger immediate webhook processing
    PERFORM pg_notify('send_email_immediate', jsonb_build_object(
      'queue_id', v_queue_id,
      'to', p_user_email,
      'type', p_notification_type,
      'data', p_notification_data,
      'priority', 'immediate',
      'timestamp', extract(epoch from NOW())
    )::text);
    
    RAISE NOTICE 'EMAIL_WEBHOOK_TRIGGERED: queue_id=% type=% to=%', v_queue_id, p_notification_type, p_user_email;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'EMAIL_WEBHOOK_FAILED: type=% to=% error=%', p_notification_type, p_user_email, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the main notification function to use immediate sending
CREATE OR REPLACE FUNCTION send_notification_email(
  p_user_email TEXT,
  p_notification_type TEXT,
  p_notification_data JSONB
)
RETURNS VOID AS $$
BEGIN
  -- Use webhook-based immediate processing
  PERFORM send_notification_email_webhook(p_user_email, p_notification_type, p_notification_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add priority column to email_queue if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'email_queue' AND column_name = 'priority') THEN
    ALTER TABLE email_queue ADD COLUMN priority TEXT DEFAULT 'normal';
    CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority, created_at);
  END IF;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION send_notification_email_immediate(TEXT, TEXT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION send_notification_email_webhook(TEXT, TEXT, JSONB) TO authenticated, anon; 