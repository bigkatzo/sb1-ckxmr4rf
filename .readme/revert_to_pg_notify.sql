-- 🔄 REVERT TO PG_NOTIFY APPROACH
-- This reverses the HTTP approach and goes back to the working pg_notify method

-- ✅ Restore original send_notification_email function with pg_notify
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
    -- Queue for tracking
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
    
    -- Trigger immediate webhook processing using pg_notify  
    PERFORM pg_notify('send_email_immediate', jsonb_build_object(
      'queue_id', v_queue_id,
      'to', p_user_email,
      'type', p_notification_type,
      'data', p_notification_data,
      'priority', 'immediate',
      'timestamp', extract(epoch from NOW())
    )::text);
    
    RAISE NOTICE 'EMAIL_IMMEDIATE_TRIGGERED: queue_id=% type=% to=%', v_queue_id, p_notification_type, p_user_email;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'EMAIL_IMMEDIATE_FAILED: type=% to=% error=%', p_notification_type, p_user_email, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ Test the reverted function
DO $$
BEGIN
  RAISE NOTICE '🔄 Testing reverted pg_notify function...';
  
  PERFORM send_notification_email(
    'arikkatzc@gmail.com',
    'test',
    '{"message": "Testing reverted function", "timestamp": "2025-01-24"}'::jsonb
  );
  
  RAISE NOTICE '✅ Reverted function test complete!';
END $$; 