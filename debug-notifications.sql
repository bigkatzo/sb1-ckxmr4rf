-- Debug script to check notification system status
-- Run this in your Supabase SQL Editor to check the system

-- 1. Check if notification preferences table exists and has data
SELECT 'notification_preferences table' as check_type, count(*) as count FROM notification_preferences;

-- 2. Check if email_queue table exists and has data
SELECT 'email_queue table' as check_type, count(*) as count FROM email_queue;

-- 3. Check recent notifications
SELECT 'recent notifications' as check_type, count(*) as count 
FROM notifications 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 4. Check pending emails in queue
SELECT 'pending emails' as check_type, count(*) as count 
FROM email_queue 
WHERE status = 'pending';

-- 5. Check failed emails in queue
SELECT 'failed emails' as check_type, count(*) as count 
FROM email_queue 
WHERE status = 'failed';

-- 6. Check email queue status distribution
SELECT status, count(*) as count
FROM email_queue
GROUP BY status
ORDER BY count DESC;

-- 7. Check recent email queue entries (last 10)
SELECT 
  id,
  recipient_email,
  notification_type,
  status,
  attempts,
  error_message,
  created_at
FROM email_queue
ORDER BY created_at DESC
LIMIT 10;

-- 8. Check recent notifications with email status
SELECT 
  n.id,
  n.type,
  n.title,
  n.email_sent,
  n.created_at,
  u.email as user_email
FROM notifications n
JOIN auth.users u ON u.id = n.user_id
ORDER BY n.created_at DESC
LIMIT 10;

-- 9. Check user notification preferences (sample)
SELECT 
  np.user_id,
  np.all_email_notifications,
  np.order_created_email,
  np.category_created_email,
  np.product_created_email,
  u.email
FROM notification_preferences np
JOIN auth.users u ON u.id = np.user_id
LIMIT 5;

-- 10. Test notification creation (replace with real user ID)
-- SELECT create_notification_with_preferences(
--   'YOUR_USER_ID_HERE'::UUID,
--   'test',
--   'Test Notification',
--   'This is a test notification to check the system',
--   '{"test": true}'::JSONB
-- );

-- 11. Check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'create_notification',
  'create_notification_with_preferences',
  'send_notification_email',
  'get_pending_emails',
  'mark_email_sent'
)
ORDER BY routine_name; 