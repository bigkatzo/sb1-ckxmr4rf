-- 🧪 SIMPLE WEBHOOK TEST for EMAIL_QUEUE
-- This test verifies that emails are processed by webhook
-- Updated for Supabase webhook format: {"type":"INSERT","table":"email_queue","record":{...}}

-- Insert a test email that should trigger webhook processing
INSERT INTO email_queue (
  recipient_email,
  notification_type,
  notification_data,
  status
) VALUES (
  'test@example.com',
  'order_created',
  jsonb_build_object(
    'order_id', 'TEST-12345',
    'customer_name', 'Test Customer',
    'total_amount', 99.99,
    'order_status', 'processing'
  ),
  'pending'
);

-- Check if the webhook processed it (status should change from 'pending')
SELECT 
  id,
  recipient_email,
  notification_type,
  status,
  created_at,
  last_attempt_at,
  attempts,
  error_message
FROM email_queue 
WHERE recipient_email = 'test@example.com'
ORDER BY created_at DESC 
LIMIT 1; 